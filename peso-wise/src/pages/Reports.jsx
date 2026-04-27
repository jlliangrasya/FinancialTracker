import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../auth/AuthContext'
import { getTransactions } from '../firebase/transactions'
import { getBudgets } from '../firebase/budgets'
import { getDebts } from '../firebase/debts'
import { getInvestments } from '../firebase/investments'
import { getUserSettings } from '../firebase/settings'
import { getTransfers } from '../firebase/transfers'
import { getCompletedBudgetPeriods } from '../firebase/budgetPeriods'
import { getTotalBalance } from '../engine/bankBalance'
import { formatCurrency } from '../utils/formatCurrency'
import { getMonthLabel } from '../utils/dateHelpers'
import ProgressBar from '../components/ProgressBar'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement,
  PointElement, LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import VerseCard from '../components/VerseCard'
import { PAGE_VERSES } from '../utils/verses'
import styles from './Reports.module.css'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function Reports() {
  const [transactions, setTransactions] = useState([])
  const [budgets, setBudgets] = useState([])
  const [debts, setDebts] = useState([])
  const [investments, setInvestments] = useState([])
  const [settings, setSettings] = useState(null)
  const [transfers, setTransfers] = useState([])
  const [completedPeriods, setCompletedPeriods] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const { currentUser } = useAuth()

  useEffect(() => {
    async function load() {
      if (!currentUser) return; setLoading(true)
      try {
        const [t, b, d, inv, s, xf, cp] = await Promise.all([
          getTransactions(currentUser.uid), getBudgets(currentUser.uid),
          getDebts(currentUser.uid), getInvestments(currentUser.uid),
          getUserSettings(currentUser.uid), getTransfers(currentUser.uid),
          getCompletedBudgetPeriods(currentUser.uid),
        ])
        setTransactions(t); setBudgets(b); setDebts(d); setInvestments(inv); setSettings(s); setTransfers(xf)
        setCompletedPeriods(cp || [])
      } catch (err) { console.error(err) }
      setLoading(false)
    }
    load()
  }, [currentUser])

  const currentLabel = MONTHS[selectedDate.getMonth()] + '-' + selectedDate.getFullYear()

  function prevMonth() { setSelectedDate(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n }) }
  function nextMonth() { setSelectedDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n }) }

  const filterMonth = (txns, label) => txns.filter(t => {
    const d = t.date?.toDate ? t.date.toDate() : new Date(t.date)
    return MONTHS[d.getMonth()] + '-' + d.getFullYear() === label
  })

  // Chart 1: Income vs Expenses - last 12 months
  const last12 = useMemo(() => {
    const labels = []; const incomeData = []; const expenseData = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - i, 1)
      const label = MONTHS[d.getMonth()] + '-' + d.getFullYear()
      labels.push(MONTHS[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2))
      const month = filterMonth(transactions, label)
      incomeData.push(month.filter(t => t.isIncome).reduce((s, t) => s + t.amount, 0))
      expenseData.push(month.filter(t => !t.isIncome).reduce((s, t) => s + t.amount, 0))
    }
    return { labels, incomeData, expenseData }
  }, [transactions, selectedDate])

  // Chart 2: Spending by Category (current month doughnut)
  const categoryData = useMemo(() => {
    const month = filterMonth(transactions, currentLabel).filter(t => !t.isIncome)
    const map = {}
    month.forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount })
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1])
    return { labels: sorted.map(s => s[0]), data: sorted.map(s => s[1]) }
  }, [transactions, currentLabel])

  const totalExpenses = categoryData.data.reduce((s, v) => s + v, 0)
  const topExpenses = categoryData.labels.slice(0, 5).map((label, i) => ({
    category: label, amount: categoryData.data[i],
    pct: totalExpenses > 0 ? ((categoryData.data[i] / totalExpenses) * 100).toFixed(1) : 0,
  }))

  // Chart 3: Budget vs Actual
  const budgetActual = useMemo(() => {
    const month = filterMonth(transactions, currentLabel).filter(t => !t.isIncome)
    return budgets.map(b => {
      const spent = month.filter(t => t.category === b.category).reduce((s, t) => s + t.amount, 0)
      return { category: b.category, budget: b.monthlyLimit, actual: spent }
    })
  }, [transactions, budgets, currentLabel])

  const CHART_COLORS = ['#1565C0','#2E7D32','#E65100','#C62828','#6A1B9A','#00838F','#4E342E','#283593','#558B2F','#AD1457','#00695C','#D84315','#37474F','#1B5E20']

  if (loading) return <div className={styles.container}><h1 className={styles.title}>Reports</h1>{[1,2].map(i => <div key={i} className="skeleton" style={{ height: 200, borderRadius: 10, marginBottom: 16 }} />)}</div>

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Reports & Charts</h1>
      <VerseCard quote={PAGE_VERSES.reports.quote} reference={PAGE_VERSES.reports.reference} context="bills" />
      <div className={styles.monthSelector}>
        <button className={styles.monthBtn} onClick={prevMonth}>◀</button>
        <span className={styles.monthLabel}>{MONTHS[selectedDate.getMonth()]} {selectedDate.getFullYear()}</span>
        <button className={styles.monthBtn} onClick={nextMonth}>▶</button>
      </div>

      <div className={styles.chartCard}>
        <div className={styles.chartTitle}>Income vs Expenses</div>
        <Bar data={{
          labels: last12.labels,
          datasets: [
            { label: 'Income', data: last12.incomeData, backgroundColor: 'rgba(46,125,50,0.7)', borderRadius: 4 },
            { label: 'Expenses', data: last12.expenseData, backgroundColor: 'rgba(183,28,28,0.7)', borderRadius: 4 },
          ]
        }} options={{ responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { callback: v => '₱' + (v/1000).toFixed(0) + 'k' } } } }} />
      </div>

      {categoryData.data.length > 0 && (
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Spending by Category</div>
          <Doughnut data={{
            labels: categoryData.labels,
            datasets: [{ data: categoryData.data, backgroundColor: CHART_COLORS.slice(0, categoryData.labels.length), borderWidth: 0 }]
          }} options={{ responsive: true, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } } }} />
        </div>
      )}

      {budgetActual.length > 0 && (
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Budget vs Actual</div>
          <Bar data={{
            labels: budgetActual.map(b => b.category.length > 12 ? b.category.slice(0, 12) + '...' : b.category),
            datasets: [
              { label: 'Budget', data: budgetActual.map(b => b.budget), backgroundColor: 'rgba(21,101,192,0.3)', borderRadius: 4 },
              { label: 'Actual', data: budgetActual.map(b => b.actual), backgroundColor: budgetActual.map(b => b.actual > b.budget ? 'rgba(183,28,28,0.7)' : 'rgba(21,101,192,0.7)'), borderRadius: 4 },
            ]
          }} options={{ indexAxis: 'y', responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { x: { beginAtZero: true } } }} />
        </div>
      )}

      {topExpenses.length > 0 && (
        <div className={`${styles.chartCard} ${styles.topExpenses}`}>
          <div className={styles.chartTitle}>Top 5 Expenses</div>
          <table>
            <thead><tr><th>Category</th><th>Amount</th><th>% Total</th></tr></thead>
            <tbody>
              {topExpenses.map((e, i) => (
                <tr key={i}><td>{e.category}</td><td>{formatCurrency(e.amount)}</td><td>{e.pct}%</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {completedPeriods.length > 0 && (
        <>
          <div className={styles.chartTitle} style={{ marginTop: 24, marginBottom: 12, fontSize: '1.0625rem', fontWeight: 700 }}>
            Past Budget Periods
          </div>
          {completedPeriods.map(p => {
            const s = p.summary
            if (!s) return null
            const start = new Date(s.startDate)
            const end = new Date(s.endDate)
            const expPct = s.expensesBudget > 0 ? Math.min(s.expensesSpent / s.expensesBudget, 1.5) : 0
            const billPct = s.billsBudget > 0 ? Math.min(s.billsTotal / s.billsBudget, 1.5) : 0
            const allOnBudget = s.expensesOnBudget && s.billsOnBudget
            return (
              <div key={p.id} className={styles.periodCard}>
                <div className={styles.periodHeader}>
                  <div className={styles.periodDates}>
                    {start.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} – {end.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <span className={`${styles.periodBadge} ${allOnBudget ? styles.periodBadgeGood : styles.periodBadgeBad}`}>
                    {allOnBudget ? 'On Budget' : 'Over Budget'}
                  </span>
                </div>

                <div className={styles.periodRow}>
                  <span className={styles.periodLabel}>Expenses</span>
                  <span className={styles.periodValues}>
                    <span style={{ color: s.expensesOnBudget ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {formatCurrency(s.expensesSpent)}
                    </span>
                    <span className={styles.periodLimit}> / {formatCurrency(s.expensesBudget)}</span>
                  </span>
                </div>
                <ProgressBar value={s.expensesSpent} max={s.expensesBudget || 1} showLabel={false} />

                <div className={styles.periodRow} style={{ marginTop: 8 }}>
                  <span className={styles.periodLabel}>Bills</span>
                  <span className={styles.periodValues}>
                    <span style={{ color: s.billsOnBudget ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {formatCurrency(s.billsTotal)}
                    </span>
                    <span className={styles.periodLimit}> / {formatCurrency(s.billsBudget)}</span>
                  </span>
                </div>
                <ProgressBar value={s.billsTotal} max={s.billsBudget || 1} showLabel={false} />

                {s.savingsBudget > 0 && (
                  <div className={styles.periodRow} style={{ marginTop: 8 }}>
                    <span className={styles.periodLabel}>Savings allocated</span>
                    <span style={{ color: 'var(--color-success)', fontWeight: 600, fontSize: '0.8125rem' }}>{formatCurrency(s.savingsBudget)}</span>
                  </div>
                )}

                <div className={styles.periodTotal}>
                  Total budget: {formatCurrency(s.totalBudget || (s.expensesBudget + s.billsBudget + s.savingsBudget))}
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
