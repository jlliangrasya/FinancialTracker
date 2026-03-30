import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getUserSettings } from '../firebase/settings'
import { getTransactions } from '../firebase/transactions'
import { getTransfers } from '../firebase/transfers'
import { getBudgets } from '../firebase/budgets'
import { getBills } from '../firebase/bills'
import { getSavingsGoals } from '../firebase/savingsGoals'
import { getDebts } from '../firebase/debts'
import { getActiveBudgetPeriod } from '../firebase/budgetPeriods'
import { calculateAllBankBalances } from '../engine/bankBalance'
import { calculateBudgetStatus } from '../engine/budgetStatus'
import { calculateBurnRate, getBurnRateStatus } from '../engine/burnRate'
import { calculateRollover, getMonthTotals, getPreviousMonthLabel } from '../engine/rollover'
import { calculateHealthScore, getScoreColor } from '../engine/healthScore'
import { generateInsights } from '../engine/insightsEngine'
import { formatCurrency } from '../utils/formatCurrency'
import { getMonthLabel, getCurrentMonthString } from '../utils/dateHelpers'
import BankCard from '../components/BankCard'
import ProgressBar from '../components/ProgressBar'
import InsightCard from '../components/InsightCard'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  const [settings, setSettings] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [transfers, setTransfers] = useState([])
  const [budgets, setBudgets] = useState([])
  const [bills, setBills] = useState([])
  const [savingsGoals, setSavingsGoals] = useState([])
  const [debts, setDebts] = useState([])
  const [activePeriod, setActivePeriod] = useState(null)
  const [loading, setLoading] = useState(true)
  const { currentUser } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    loadAll()
  }, [currentUser])

  async function loadAll() {
    if (!currentUser) return
    setLoading(true)
    try {
      const [s, txns, xfers, b, bl, sg, d, ap] = await Promise.all([
        getUserSettings(currentUser.uid),
        getTransactions(currentUser.uid),
        getTransfers(currentUser.uid),
        getBudgets(currentUser.uid),
        getBills(currentUser.uid),
        getSavingsGoals(currentUser.uid),
        getDebts(currentUser.uid),
        getActiveBudgetPeriod(currentUser.uid),
      ])
      setSettings(s)
      setTransactions(txns)
      setTransfers(xfers)
      setBudgets(b)
      setBills(bl)
      setSavingsGoals(sg)
      setDebts(d)
      setActivePeriod(ap)
    } catch (err) {
      console.error('Dashboard load error:', err)
    }
    setLoading(false)
  }

  const monthLabel = getMonthLabel()
  const currentMonthStr = getCurrentMonthString()
  const banks = settings?.banks || []
  const lowThreshold = settings?.lowBalanceAlert || 1000

  const bankBalances = useMemo(
    () => calculateAllBankBalances(banks, transactions, transfers),
    [banks, transactions, transfers]
  )

  const monthTotals = useMemo(() => getMonthTotals(transactions, monthLabel), [transactions, monthLabel])
  const prevMonthLabel = getPreviousMonthLabel(monthLabel)
  const prevTotals = useMemo(() => getMonthTotals(transactions, prevMonthLabel), [transactions, prevMonthLabel])
  const rollover = calculateRollover(prevTotals.income, prevTotals.expenses)

  const netCash = monthTotals.income - monthTotals.expenses
  const netCashColor = netCash >= 0 ? 'var(--color-success)' : 'var(--color-danger)'
  const netCashBg = netCash >= 0 ? 'var(--color-success-light)' : 'var(--color-danger-light)'

  const topBudgets = useMemo(() => {
    return budgets
      .map(b => calculateBudgetStatus(b.category, b.monthlyLimit, transactions, monthLabel))
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 5)
  }, [budgets, transactions, monthLabel])

  const upcomingBills = useMemo(() => {
    const today = new Date()
    const in7Days = new Date()
    in7Days.setDate(today.getDate() + 7)
    return bills
      .filter(b => {
        if (!b.isActive) return false
        if (b.paidMonths && b.paidMonths.includes(currentMonthStr)) return false
        return b.dueDay >= today.getDate() && b.dueDay <= in7Days.getDate() + (in7Days.getMonth() > today.getMonth() ? 31 : 0)
      })
      .sort((a, b) => a.dueDay - b.dueDay)
  }, [bills, currentMonthStr])

  const burnRate = useMemo(() => {
    if (!activePeriod) return null
    const start = activePeriod.startDate?.toDate ? activePeriod.startDate.toDate() : new Date(activePeriod.startDate)
    const end = activePeriod.endDate?.toDate ? activePeriod.endDate.toDate() : new Date(activePeriod.endDate)
    const periodTxns = transactions.filter(t => {
      if (t.isIncome) return false
      const d = t.date?.toDate ? t.date.toDate() : new Date(t.date)
      return d >= start && d <= end
    })
    const totalSpent = periodTxns.reduce((s, t) => s + t.amount, 0)
    const totalBudget = activePeriod.mode === 'combined'
      ? activePeriod.totalBudget
      : (activePeriod.expensesBudget || 0) + (activePeriod.billsBudget || 0)
    return calculateBurnRate(totalSpent, totalBudget - totalSpent, start, end)
  }, [activePeriod, transactions])

  const healthScore = useMemo(
    () => calculateHealthScore({ transactions, budgets, bills, debts, savingsGoals, monthLabel }),
    [transactions, budgets, bills, debts, savingsGoals, monthLabel]
  )

  const currentMonthTxns = useMemo(() => {
    return transactions.filter(t => {
      const date = t.date?.toDate ? t.date.toDate() : new Date(t.date)
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      return months[date.getMonth()] + '-' + date.getFullYear() === monthLabel
    })
  }, [transactions, monthLabel])

  const prevMonthTxns = useMemo(() => {
    return transactions.filter(t => {
      const date = t.date?.toDate ? t.date.toDate() : new Date(t.date)
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      return months[date.getMonth()] + '-' + date.getFullYear() === prevMonthLabel
    })
  }, [transactions, prevMonthLabel])

  const insights = useMemo(
    () => generateInsights(currentMonthTxns, prevMonthTxns, budgets, bills),
    [currentMonthTxns, prevMonthTxns, budgets, bills]
  )

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.headerBar}>
          <div className={styles.logoRow}>
            <div className={styles.logoIcon}>P</div>
            <span className={styles.logoText}>Peso Wise</span>
          </div>
        </div>
        {[1,2,3,4].map(i => (
          <div key={i} className="skeleton" style={{ height: 80, marginBottom: 16, borderRadius: 10 }} />
        ))}
      </div>
    )
  }

  const scoreColor = getScoreColor(healthScore.total)
  const scoreBg = scoreColor === 'success' ? 'var(--color-success)' : scoreColor === 'warning' ? 'var(--color-warning)' : 'var(--color-danger)'

  return (
    <div className={styles.container}>
      <div className={styles.headerBar}>
        <div className={styles.logoRow}>
          <div className={styles.logoIcon}>P</div>
          <span className={styles.logoText}>Peso Wise</span>
        </div>
        <span className={styles.monthLabel}>{monthLabel.replace('-', ' ')}</span>
      </div>

      <div className={styles.netCashCard} style={{ backgroundColor: netCashBg }}>
        <div className={styles.netCashLabel}>This month</div>
        <div className={styles.netCashAmount} style={{ color: netCashColor }}>
          {formatCurrency(netCash)}
        </div>
        {rollover !== 0 && (
          <div className={styles.rollover}>
            Leftover from {prevMonthLabel.replace('-', ' ')}: {formatCurrency(rollover)}
          </div>
        )}
      </div>

      {burnRate && (
        <div
          className={`${styles.burnAlert} ${styles[getBurnRateStatus(burnRate.dailyAverage, burnRate.safeDailyTarget)]}`}
          onClick={() => navigate('/burn-rate')}
        >
          🔥 Burning {formatCurrency(burnRate.dailyAverage)}/day — budget runs out in {burnRate.daysRemaining} days
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          Bank Balances
          <button className={styles.seeAll} onClick={() => navigate('/banks')}>See all</button>
        </div>
        <div className={styles.bankScroll}>
          {bankBalances.length > 0 ? bankBalances.map(b => (
            <BankCard
              key={b.name}
              name={b.name}
              balance={b.balance}
              color={b.color}
              lowBalanceThreshold={lowThreshold}
              onClick={() => navigate('/banks')}
            />
          )) : (
            <div className={styles.emptyState}>No banks set up yet</div>
          )}
        </div>
      </div>

      {topBudgets.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            Budget Status
            <button className={styles.seeAll} onClick={() => navigate('/budget-tracker')}>See all</button>
          </div>
          <div className={styles.budgetList}>
            {topBudgets.map(b => (
              <div key={b.category} className={styles.budgetRow}>
                <div className={styles.budgetHeader}>
                  <span className={styles.budgetCategory}>{b.category}</span>
                  <span className={styles.budgetValues}>{formatCurrency(b.spent)} of {formatCurrency(b.monthlyLimit)}</span>
                </div>
                <ProgressBar value={b.spent} max={b.monthlyLimit} showLabel={false} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          Bills Due Soon
          <button className={styles.seeAll} onClick={() => navigate('/bills')}>View all</button>
        </div>
        {upcomingBills.length > 0 ? (
          <div className={styles.billsList}>
            {upcomingBills.map(b => {
              const daysUntil = b.dueDay - new Date().getDate()
              return (
                <div key={b.id} className={styles.billRow} onClick={() => navigate('/bills')}>
                  <div className={styles.billInfo}>
                    <span className={styles.billName}>{b.name}</span>
                    <span className={styles.billDue}>{daysUntil <= 0 ? 'Due today' : `Due in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`}</span>
                  </div>
                  <span className={styles.billAmount}>{formatCurrency(b.amount)}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>No bills due in the next 7 days</div>
        )}
      </div>

      <div className={styles.healthMini} onClick={() => navigate('/health-score')}>
        <div className={styles.healthScore} style={{ backgroundColor: scoreBg }}>
          {healthScore.total}
        </div>
        <div>
          <div className={styles.healthLabel}>Financial Health Score</div>
          <div className={styles.healthDesc}>{healthScore.label} — {healthScore.total >= 71 ? 'keep it up!' : healthScore.total >= 41 ? 'room to improve' : 'needs attention'}</div>
        </div>
      </div>

      {insights.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Insight of the Day</div>
          <InsightCard
            type={insights[0].type}
            headline={insights[0].headline}
            detail={insights[0].detail}
            tip={insights[0].tip}
            onClick={() => navigate('/insights')}
          />
        </div>
      )}

      {savingsGoals.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            Savings Goals
            <button className={styles.seeAll} onClick={() => navigate('/savings-goals')}>See all</button>
          </div>
          <div className={styles.goalsList}>
            {savingsGoals.map(g => {
              const pct = g.targetAmount > 0 ? Math.min(g.savedAmount / g.targetAmount, 1) : 0
              return (
                <div key={g.id} className={styles.goalRow} onClick={() => navigate('/savings-goals')}>
                  <div className={styles.goalName}>{g.name}</div>
                  <ProgressBar value={g.savedAmount} max={g.targetAmount} showLabel={false} />
                  <div className={styles.goalValues}>{formatCurrency(g.savedAmount)} of {formatCurrency(g.targetAmount)} · {(pct * 100).toFixed(0)}%</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
