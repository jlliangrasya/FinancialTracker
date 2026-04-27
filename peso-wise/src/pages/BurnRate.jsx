import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../auth/AuthContext'
import { getTransactions } from '../firebase/transactions'
import { getActiveBudgetPeriod } from '../firebase/budgetPeriods'
import { calculateBurnRate, getBurnRateStatus, getDailySpending } from '../engine/burnRate'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate } from '../utils/dateHelpers'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend
} from 'chart.js'
import VerseCard from '../components/VerseCard'
import { PAGE_VERSES } from '../utils/verses'
import styles from './BurnRate.module.css'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

export default function BurnRate() {
  const [transactions, setTransactions] = useState([])
  const [period, setPeriod] = useState(null)
  const [loading, setLoading] = useState(true)
  const { currentUser } = useAuth()

  useEffect(() => {
    async function load() {
      if (!currentUser) return
      setLoading(true)
      try {
        const [txns, ap] = await Promise.all([
          getTransactions(currentUser.uid),
          getActiveBudgetPeriod(currentUser.uid),
        ])
        setTransactions(txns)
        setPeriod(ap)
      } catch (err) { console.error(err) }
      setLoading(false)
    }
    load()
  }, [currentUser])

  const burnData = useMemo(() => {
    if (!period) return null
    const start = period.startDate?.toDate ? period.startDate.toDate() : new Date(period.startDate)
    const end = period.endDate?.toDate ? period.endDate.toDate() : new Date(period.endDate)
    const periodTxns = transactions.filter(t => {
      if (t.isIncome) return false
      const d = t.date?.toDate ? t.date.toDate() : new Date(t.date)
      return d >= start && d <= end
    })
    const totalSpent = periodTxns.reduce((s, t) => s + t.amount, 0)
    const totalBudget = period.mode === 'combined'
      ? period.totalBudget
      : (period.expensesBudget || 0) + (period.billsBudget || 0)
    return calculateBurnRate(totalSpent, totalBudget - totalSpent, start, end)
  }, [period, transactions])

  const dailyData = useMemo(() => {
    if (!period) return []
    const start = period.startDate?.toDate ? period.startDate.toDate() : new Date(period.startDate)
    const end = period.endDate?.toDate ? period.endDate.toDate() : new Date(period.endDate)
    return getDailySpending(transactions, start, end)
  }, [period, transactions])

  if (loading) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Burn Rate</h1>
        <div className="skeleton" style={{ height: 120, borderRadius: 16, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 80, borderRadius: 10, marginBottom: 16 }} />
      </div>
    )
  }

  if (!period || !burnData) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Burn Rate</h1>
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🔥</div>
          <p>No active budget period. Add income and set up a budget to start tracking your burn rate.</p>
        </div>
      </div>
    )
  }

  const status = getBurnRateStatus(burnData.dailyAverage, burnData.safeDailyTarget)
  const statusColor = status === 'safe' ? 'var(--color-success)' : status === 'warning' ? 'var(--color-warning)' : 'var(--color-danger)'
  const velocityPct = burnData.safeDailyTarget > 0 ? Math.min((burnData.dailyAverage / burnData.safeDailyTarget) * 100, 100) : 100

  const chartData = {
    labels: dailyData.map(d => d.date.split('-').slice(1).join('/')),
    datasets: [{
      label: 'Daily Spending',
      data: dailyData.map(d => d.amount),
      backgroundColor: dailyData.map(d =>
        d.amount > (burnData.safeDailyTarget || 0) ? 'rgba(183, 28, 28, 0.7)' : 'rgba(21, 101, 192, 0.7)'
      ),
      borderRadius: 4,
    }],
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: ctx => '₱' + ctx.parsed.y.toLocaleString('en-PH', { minimumFractionDigits: 2 }) }
      }
    },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, ticks: { callback: v => '₱' + v.toLocaleString() } },
    }
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Burn Rate</h1>
      <VerseCard quote={PAGE_VERSES.burnRate.quote} reference={PAGE_VERSES.burnRate.reference} context="default" />

      <div className={styles.bigStat}>
        <div className={styles.bigStatLabel}>Current burn rate</div>
        <div className={styles.bigStatValue} style={{ color: statusColor }}>
          {formatCurrency(burnData.dailyAverage)}<span className={styles.bigStatUnit}>/day</span>
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Days remaining</div>
          <div className={styles.statValue}>{burnData.daysRemaining}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Safe daily target</div>
          <div className={styles.statValue} style={{ color: 'var(--color-success)' }}>{formatCurrency(burnData.safeDailyTarget)}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Projected total</div>
          <div className={styles.statValue}>{formatCurrency(burnData.projectedTotal)}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total budget</div>
          <div className={styles.statValue}>{formatCurrency(burnData.totalBudget)}</div>
        </div>
      </div>

      {burnData.willOverspend && (
        <div className={`${styles.alertBanner} ${styles.critical}`}>
          At this pace you'll overspend by {formatCurrency(burnData.overAmount)}
        </div>
      )}

      {!burnData.willOverspend && (
        <div className={`${styles.alertBanner} ${styles[status]}`}>
          Stay under {formatCurrency(burnData.safeDailyTarget)}/day to stay on budget
        </div>
      )}

      <div className={styles.velocityBar}>
        <div className={styles.velocityLabel}>
          <span>Slow</span>
          <span>Fast</span>
        </div>
        <div className={styles.velocityTrack}>
          <div className={styles.velocityFill} style={{
            width: `${velocityPct}%`,
            backgroundColor: statusColor,
          }} />
        </div>
      </div>

      <div className={styles.chartSection}>
        <div className={styles.chartTitle}>Daily Spending</div>
        <Bar data={chartData} options={chartOptions} />
      </div>
    </div>
  )
}
