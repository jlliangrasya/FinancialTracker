import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../auth/AuthContext'
import { getTransactions } from '../firebase/transactions'
import { getActiveBudgetPeriod, addBudgetPeriod } from '../firebase/budgetPeriods'
import { getBills, markBillPaid, markBillUnpaid } from '../firebase/bills'
import { useToast } from '../components/Toast'
import ProgressBar from '../components/ProgressBar'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, getCurrentMonthString, differenceInDays } from '../utils/dateHelpers'
import styles from './BudgetTracker.module.css'

export default function BudgetTracker() {
  const [transactions, setTransactions] = useState([])
  const [period, setPeriod] = useState(null)
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('combined')
  const [activeTab, setActiveTab] = useState('expenses')
  const [periodType, setPeriodType] = useState('monthly')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const { currentUser } = useAuth()
  const { showToast } = useToast()
  const currentMonthStr = getCurrentMonthString()

  useEffect(() => { loadData() }, [currentUser])

  async function loadData() {
    if (!currentUser) return
    setLoading(true)
    try {
      const [txns, ap, bl] = await Promise.all([
        getTransactions(currentUser.uid),
        getActiveBudgetPeriod(currentUser.uid),
        getBills(currentUser.uid),
      ])
      setTransactions(txns)
      setPeriod(ap)
      setBills(bl)
      if (ap?.mode) setMode(ap.mode)
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  const periodStart = period?.startDate?.toDate ? period.startDate.toDate() : period?.startDate ? new Date(period.startDate) : null
  const periodEnd = period?.endDate?.toDate ? period.endDate.toDate() : period?.endDate ? new Date(period.endDate) : null
  const daysLeft = periodEnd ? Math.max(0, differenceInDays(periodEnd, new Date())) : 0

  const periodTxns = useMemo(() => {
    if (!periodStart || !periodEnd) return []
    return transactions.filter(t => {
      const d = t.date?.toDate ? t.date.toDate() : new Date(t.date)
      return d >= periodStart && d <= periodEnd && !t.isIncome
    }).sort((a, b) => {
      const da = a.date?.toDate ? a.date.toDate() : new Date(a.date)
      const db = b.date?.toDate ? b.date.toDate() : new Date(b.date)
      return db - da
    })
  }, [transactions, periodStart, periodEnd])

  const totalSpent = periodTxns.reduce((s, t) => s + t.amount, 0)
  const totalBudget = period ? (mode === 'combined' ? (period.totalBudget || 0) : ((period.expensesBudget || 0) + (period.billsBudget || 0))) : 0
  const remaining = totalBudget - totalSpent

  const periodBills = useMemo(() => {
    const today = new Date()
    return bills.filter(b => b.isActive).map(b => {
      const isPaid = b.paidMonths && b.paidMonths.includes(currentMonthStr)
      const daysUntilDue = b.dueDay - today.getDate()
      let status = 'upcoming'
      if (isPaid) status = 'paid'
      else if (daysUntilDue < 0) status = 'overdue'
      else if (daysUntilDue <= 7) status = 'dueSoon'
      return { ...b, isPaid, daysUntilDue, status }
    }).sort((a, b) => {
      const order = { overdue: 0, dueSoon: 1, upcoming: 2, paid: 3 }
      return order[a.status] - order[b.status]
    })
  }, [bills, currentMonthStr])

  const billsPaid = periodBills.filter(b => b.isPaid).reduce((s, b) => s + b.amount, 0)
  const billsUnpaid = periodBills.filter(b => !b.isPaid).reduce((s, b) => s + b.amount, 0)

  async function handleTogglePaid(bill) {
    try {
      if (bill.isPaid) {
        await markBillUnpaid(bill.id, currentMonthStr)
      } else {
        await markBillPaid(bill.id, currentMonthStr)
      }
      await loadData()
    } catch (err) {
      showToast('Failed to update bill', 'error')
    }
  }

  const percentUsed = totalBudget > 0 ? totalSpent / totalBudget : 0
  const budgetStatus = percentUsed >= 1 ? 'Over budget!' : percentUsed >= 0.8 ? 'Running low' : 'On track'
  const statusColor = percentUsed >= 1 ? 'var(--color-danger)' : percentUsed >= 0.8 ? 'var(--color-warning)' : 'var(--color-success)'

  if (loading) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Budget Tracker</h1>
        {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 10, marginBottom: 12 }} />)}
      </div>
    )
  }

  if (!period) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Budget Tracker</h1>
        <div className={styles.empty}>
          <p>No active budget period.</p>
          <p style={{ marginTop: 8 }}>Add income via the + button and use the Paycheck Allocator to set up your budget.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Budget Tracker</h1>

      <div className={styles.periodTabs}>
        {['weekly', 'biweekly', 'monthly', 'custom'].map(p => (
          <button key={p} className={`${styles.periodPill} ${periodType === p ? styles.active : ''}`} onClick={() => setPeriodType(p)}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {periodStart && periodEnd && (
        <div className={styles.dateRange}>
          {formatDate(periodStart)} – {formatDate(periodEnd)} · {daysLeft} days left
        </div>
      )}

      <div className={styles.modeToggle}>
        <button className={`${styles.modeTab} ${mode === 'combined' ? styles.active : ''}`} onClick={() => setMode('combined')}>
          Combined
        </button>
        <button className={`${styles.modeTab} ${mode === 'separate' ? styles.active : ''}`} onClick={() => setMode('separate')}>
          Separate
        </button>
      </div>

      <div className={styles.hero}>
        <div className={styles.heroLabel}>
          {mode === 'combined' ? 'Total allocated budget' : activeTab === 'expenses' ? 'Expenses budget' : 'Bills budget'}
        </div>
        <div className={styles.heroAmount}>{formatCurrency(totalBudget)}</div>
        <ProgressBar value={totalSpent} max={totalBudget} showLabel={false} />
        <div className={styles.heroSub}>
          {formatCurrency(totalSpent)} spent — {(percentUsed * 100).toFixed(0)}% used
        </div>
      </div>

      <div className={styles.tabNav}>
        <button className={`${styles.tabBtn} ${activeTab === 'expenses' ? styles.active : ''}`} onClick={() => setActiveTab('expenses')}>
          Expenses
        </button>
        <button className={`${styles.tabBtn} ${activeTab === 'bills' ? styles.active : ''}`} onClick={() => setActiveTab('bills')}>
          Bills
        </button>
      </div>

      {activeTab === 'expenses' && (
        <>
          {periodTxns.length > 0 ? (
            <div className={styles.txnList}>
              {periodTxns.map(t => (
                <div key={t.id} className={styles.txnRow}>
                  <div className={styles.dot} style={{ backgroundColor: 'var(--color-primary)' }} />
                  <div className={styles.txnInfo}>
                    <div className={styles.txnDesc}>{t.description || t.category}</div>
                    <div className={styles.txnMeta}>{t.category} · {formatDate(t.date)} · {t.bank}</div>
                  </div>
                  <div className={styles.txnAmount}>-{formatCurrency(t.amount)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>No expenses logged this period yet.</div>
          )}
        </>
      )}

      {activeTab === 'bills' && (
        <>
          {periodBills.length > 0 ? (
            <div className={styles.txnList}>
              {periodBills.map(b => (
                <div key={b.id} className={styles.billRow}>
                  <span className={`${styles.badge} ${styles[b.status]}`}>{b.status === 'dueSoon' ? 'Due Soon' : b.status}</span>
                  <div className={styles.billInfo}>
                    <div className={styles.billName}>{b.name}</div>
                    <div className={styles.billDue}>Due day {b.dueDay} · {b.bank}</div>
                  </div>
                  <div className={styles.billAmount}>{formatCurrency(b.amount)}</div>
                  <input type="checkbox" className={styles.paidToggle} checked={b.isPaid} onChange={() => handleTogglePaid(b)} />
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>No bills due this period.</div>
          )}
        </>
      )}

      <div style={{ height: 140 }} />

      <div className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerRow}>
            <span className={styles.footerLabel}>Total expenses</span>
            <span className={styles.footerValue} style={{ color: 'var(--color-danger)' }}>-{formatCurrency(totalSpent)}</span>
          </div>
          <div className={styles.footerRow}>
            <span className={styles.footerLabel}>Bills paid</span>
            <span className={styles.footerValue}>-{formatCurrency(billsPaid)}</span>
          </div>
          <div className={styles.footerRow}>
            <span className={styles.footerLabel}>Bills unpaid</span>
            <span className={styles.footerValue} style={{ color: 'var(--color-warning)' }}>-{formatCurrency(billsUnpaid)}</span>
          </div>
          <div className={styles.footerDivider} />
          <div className={styles.footerRemaining}>
            <span>Remaining</span>
            <span style={{ color: statusColor }}>{formatCurrency(remaining)}</span>
          </div>
          <div className={styles.footerStatus}>
            <span className={styles.statusPill} style={{ backgroundColor: statusColor + '20', color: statusColor }}>{budgetStatus}</span>
            <span>Resets {periodEnd ? formatDate(periodEnd) : ''}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
