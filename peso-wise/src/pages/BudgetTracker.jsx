import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getTransactions } from '../firebase/transactions'
import { getActiveBudgetPeriod, completeBudgetPeriod, updateBudgetPeriod } from '../firebase/budgetPeriods'
import { getBills, markBillPaid, markBillUnpaid } from '../firebase/bills'
import { getBudgets } from '../firebase/budgets'
import { getSavingsGoals } from '../firebase/savingsGoals'
import { getUserSettings } from '../firebase/settings'
import { getTransfers } from '../firebase/transfers'
import { calculateBankBalance } from '../engine/bankBalance'
import { useToast } from '../components/Toast'
import ProgressBar from '../components/ProgressBar'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, getCurrentMonthString, differenceInDays } from '../utils/dateHelpers'
import VerseCard from '../components/VerseCard'
import { PAGE_VERSES } from '../utils/verses'
import styles from './BudgetTracker.module.css'

function toInputDate(d) {
  if (!d) return ''
  const date = d.toDate ? d.toDate() : new Date(d)
  return date.toISOString().split('T')[0]
}

export default function BudgetTracker() {
  const [transactions, setTransactions] = useState([])
  const [period, setPeriod] = useState(null)
  const [bills, setBills] = useState([])
  const [budgets, setBudgets] = useState([])
  const [savingsGoals, setSavingsGoals] = useState([])
  const [settings, setSettings] = useState(null)
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('type')
  const [activeTab, setActiveTab] = useState('expenses')
  const [expiredSummary, setExpiredSummary] = useState(null)
  const [editingDates, setEditingDates] = useState(false)
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [savingDates, setSavingDates] = useState(false)
  const { currentUser } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const currentMonthStr = getCurrentMonthString()

  useEffect(() => { loadData() }, [currentUser])

  async function loadData() {
    if (!currentUser) return
    setLoading(true)
    try {
      const [txns, ap, bl, bg, sg, st, xfers] = await Promise.all([
        getTransactions(currentUser.uid),
        getActiveBudgetPeriod(currentUser.uid),
        getBills(currentUser.uid),
        getBudgets(currentUser.uid),
        getSavingsGoals(currentUser.uid),
        getUserSettings(currentUser.uid),
        getTransfers(currentUser.uid),
      ])
      setTransactions(txns)
      setBills(bl)
      setBudgets(bg || [])
      setSavingsGoals(sg || [])
      setSettings(st)
      setTransfers(xfers || [])

      if (ap) {
        const endDate = ap.endDate?.toDate ? ap.endDate.toDate() : new Date(ap.endDate)
        const startDate = ap.startDate?.toDate ? ap.startDate.toDate() : new Date(ap.startDate)
        const now = new Date()
        if (endDate < now) {
          const periodTxnsList = txns.filter(t => {
            const d = t.date?.toDate ? t.date.toDate() : new Date(t.date)
            return d >= startDate && d <= endDate && !t.isIncome
          })
          const expensesSpent = periodTxnsList.reduce((s, t) => s + t.amount, 0)
          const endMs = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`
          const periodMonthStr = endMs
          const paidBills = bl.filter(b => b.isActive && b.paidMonths && b.paidMonths.includes(periodMonthStr)).reduce((s, b) => s + b.amount, 0)
          const unpaidBills = bl.filter(b => b.isActive && (!b.paidMonths || !b.paidMonths.includes(periodMonthStr))).reduce((s, b) => s + b.amount, 0)

          const summary = {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            periodType: ap.periodType || 'monthly',
            expensesBudget: ap.expensesBudget || 0,
            billsBudget: ap.billsBudget || 0,
            savingsBudget: ap.savingsBudget || 0,
            totalBudget: ap.totalBudget || 0,
            expensesSpent,
            billsPaid: paidBills,
            billsUnpaid: unpaidBills,
            billsTotal: paidBills + unpaidBills,
            expensesOnBudget: expensesSpent <= (ap.expensesBudget || 0),
            billsOnBudget: (paidBills + unpaidBills) <= (ap.billsBudget || 0),
          }

          await completeBudgetPeriod(ap.id, summary)
          setExpiredSummary({ ...summary, periodId: ap.id })
          setPeriod(null)
        } else {
          setPeriod(ap)
        }
      } else {
        setPeriod(ap)
      }
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  const periodStart = period?.startDate?.toDate ? period.startDate.toDate() : period?.startDate ? new Date(period.startDate) : null
  const periodEnd = period?.endDate?.toDate ? period.endDate.toDate() : period?.endDate ? new Date(period.endDate) : null
  const daysLeft = periodEnd ? Math.max(0, differenceInDays(periodEnd, new Date())) : 0
  const totalDays = periodStart && periodEnd ? Math.max(1, differenceInDays(periodEnd, periodStart)) : 1
  const daysElapsed = totalDays - daysLeft
  const timeProgress = Math.min(daysElapsed / totalDays, 1)

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

  const totalExpensesSpent = periodTxns.reduce((s, t) => s + t.amount, 0)
  const billsPaid = periodBills.filter(b => b.isPaid).reduce((s, b) => s + b.amount, 0)
  const billsUnpaid = periodBills.filter(b => !b.isPaid).reduce((s, b) => s + b.amount, 0)
  const billsTotal = billsPaid + billsUnpaid

  const expensesBudget = period?.expensesBudget || 0
  const billsBudget = period?.billsBudget || 0
  const savingsBudget = period?.savingsBudget || 0
  const expensesRemaining = expensesBudget - totalExpensesSpent
  const billsRemaining = billsBudget - billsTotal

  const banks = settings?.banks || []
  function getEffectiveSaved(g) {
    if (g.linkedBank && g.bank) {
      const bankInfo = banks.find(b => b.name === g.bank)
      if (bankInfo) return Math.max(0, calculateBankBalance(bankInfo.name, bankInfo.openingBalance, transactions, transfers))
    }
    return g.savedAmount || 0
  }

  const totalSaved = savingsGoals.reduce((s, g) => s + getEffectiveSaved(g), 0)
  const totalSavingsTarget = savingsGoals.reduce((s, g) => s + (g.targetAmount || 0), 0)
  const savingsGoalDetails = savingsGoals.map(g => {
    const effectiveSaved = getEffectiveSaved(g)
    const target = g.targetDate?.toDate ? g.targetDate.toDate() : new Date(g.targetDate)
    const now = new Date()
    const monthsLeft = Math.max(1, (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()))
    const remaining = Math.max(0, (g.targetAmount || 0) - effectiveSaved)
    const monthlyNeeded = remaining / monthsLeft
    const pct = g.targetAmount > 0 ? Math.min(effectiveSaved / g.targetAmount, 1) : 0
    return { ...g, savedAmount: effectiveSaved, monthsLeft, remaining, monthlyNeeded, pct }
  })
  const totalMonthlyNeeded = savingsGoalDetails.reduce((s, g) => s + g.monthlyNeeded, 0)

  const typeHeroAmount = activeTab === 'expenses' ? expensesBudget : activeTab === 'bills' ? billsBudget : savingsBudget
  const typeHeroSpent = activeTab === 'expenses' ? totalExpensesSpent : activeTab === 'bills' ? billsTotal : 0
  const typePercentUsed = typeHeroAmount > 0 ? typeHeroSpent / typeHeroAmount : 0
  const typeStatus = typePercentUsed >= 1 ? 'Over budget' : typePercentUsed >= 0.8 ? 'Almost there' : 'Looking good'
  const typeStatusColor = typePercentUsed >= 1 ? 'var(--color-danger)' : typePercentUsed >= 0.8 ? 'var(--color-warning)' : 'var(--color-success)'

  const categorySpending = useMemo(() => {
    const map = {}
    periodTxns.forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount
    })
    return map
  }, [periodTxns])

  const categoryRows = useMemo(() => {
    const cats = new Set([
      ...budgets.map(b => b.category),
      ...Object.keys(categorySpending),
    ])
    return Array.from(cats).map(cat => {
      const budget = budgets.find(b => b.category === cat)
      const spent = categorySpending[cat] || 0
      return { cat, limit: budget?.monthlyLimit || 0, spent, id: budget?.id }
    }).sort((a, b) => b.spent - a.spent)
  }, [budgets, categorySpending])

  async function handleTogglePaid(bill) {
    try {
      if (bill.isPaid) {
        await markBillUnpaid(bill.id, currentMonthStr)
      } else {
        await markBillPaid(bill.id, currentMonthStr)
      }
      await loadData()
    } catch {
      showToast('Failed to update bill', 'error')
    }
  }

  function openDateEditor() {
    setEditStart(toInputDate(period?.startDate))
    setEditEnd(toInputDate(period?.endDate))
    setEditingDates(true)
  }

  async function saveDateChanges() {
    if (!period || !editStart || !editEnd) return
    const newStart = new Date(editStart)
    const newEnd = new Date(editEnd)
    if (newEnd <= newStart) {
      showToast('End date must be after start date', 'error')
      return
    }
    setSavingDates(true)
    try {
      await updateBudgetPeriod(period.id, {
        startDate: newStart,
        endDate: newEnd,
      })
      showToast('Period dates updated')
      setEditingDates(false)
      await loadData()
    } catch {
      showToast('Failed to update dates', 'error')
    }
    setSavingDates(false)
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Budget Tracker</h1>
        {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 16, marginBottom: 12 }} />)}
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Budget Tracker</h1>
      <VerseCard quote={PAGE_VERSES.budgetTracker.quote} reference={PAGE_VERSES.budgetTracker.reference} context="default" />

      {/* Expired period summary modal */}
      {expiredSummary && (
        <div className={styles.expiredOverlay} onClick={() => setExpiredSummary(null)}>
          <div className={styles.expiredModal} onClick={e => e.stopPropagation()}>
            <div className={styles.expiredHeader}>
              <h2 className={styles.expiredTitle}>Budget Period Ended</h2>
              <button className={styles.expiredClose} onClick={() => setExpiredSummary(null)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className={styles.expiredBody}>
              <div className={styles.expiredDates}>
                {formatDate(expiredSummary.startDate)} – {formatDate(expiredSummary.endDate)}
              </div>

              <div className={styles.expiredSection}>
                <div className={styles.expiredSectionTitle}>Daily Expenses</div>
                <div className={styles.expiredRow}>
                  <span>Budget</span>
                  <span>{formatCurrency(expiredSummary.expensesBudget)}</span>
                </div>
                <div className={styles.expiredRow}>
                  <span>Spent</span>
                  <span style={{ color: 'var(--color-danger)' }}>{formatCurrency(expiredSummary.expensesSpent)}</span>
                </div>
                <ProgressBar value={expiredSummary.expensesSpent} max={expiredSummary.expensesBudget || 1} showLabel={false} />
                <div className={`${styles.expiredVerdict} ${expiredSummary.expensesOnBudget ? styles.verdictGood : styles.verdictBad}`}>
                  {expiredSummary.expensesOnBudget
                    ? `On budget — ${formatCurrency(expiredSummary.expensesBudget - expiredSummary.expensesSpent)} under`
                    : `Over budget by ${formatCurrency(expiredSummary.expensesSpent - expiredSummary.expensesBudget)}`
                  }
                </div>
              </div>

              <div className={styles.expiredSection}>
                <div className={styles.expiredSectionTitle}>Bills</div>
                <div className={styles.expiredRow}>
                  <span>Budget</span>
                  <span>{formatCurrency(expiredSummary.billsBudget)}</span>
                </div>
                <div className={styles.expiredRow}>
                  <span>Total bills</span>
                  <span>{formatCurrency(expiredSummary.billsTotal)}</span>
                </div>
                <div className={styles.expiredRow}>
                  <span>Paid</span>
                  <span style={{ color: 'var(--color-success)' }}>{formatCurrency(expiredSummary.billsPaid)}</span>
                </div>
                {expiredSummary.billsUnpaid > 0 && (
                  <div className={styles.expiredRow}>
                    <span>Unpaid</span>
                    <span style={{ color: 'var(--color-warning)' }}>{formatCurrency(expiredSummary.billsUnpaid)}</span>
                  </div>
                )}
                <div className={`${styles.expiredVerdict} ${expiredSummary.billsOnBudget ? styles.verdictGood : styles.verdictBad}`}>
                  {expiredSummary.billsOnBudget ? 'Bills within budget' : 'Bills exceeded budget'}
                </div>
              </div>

              {expiredSummary.savingsBudget > 0 && (
                <div className={styles.expiredSection}>
                  <div className={styles.expiredSectionTitle}>Savings</div>
                  <div className={styles.expiredRow}>
                    <span>Set aside</span>
                    <span style={{ color: 'var(--color-success)' }}>{formatCurrency(expiredSummary.savingsBudget)}</span>
                  </div>
                </div>
              )}

              <div className={styles.expiredActions}>
                <button className="btn-primary" onClick={() => {
                  const params = new URLSearchParams({
                    amount: String(expiredSummary.totalBudget || 0),
                    carryBills: String(expiredSummary.billsBudget || 0),
                    carrySavings: String(expiredSummary.savingsBudget || 0),
                    carrySpending: String(expiredSummary.expensesBudget || 0),
                  })
                  setExpiredSummary(null)
                  navigate(`/paycheck-allocator?${params.toString()}`)
                }}>
                  Start New Period (carry forward)
                </button>
                <button className="btn-secondary" style={{ marginTop: 8 }} onClick={() => {
                  setExpiredSummary(null)
                  navigate('/paycheck-allocator')
                }}>
                  Start Fresh
                </button>
                <button className={styles.expiredDismiss} onClick={() => setExpiredSummary(null)}>
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Date editing modal */}
      {editingDates && (
        <div className={styles.expiredOverlay} onClick={() => setEditingDates(false)}>
          <div className={styles.dateEditModal} onClick={e => e.stopPropagation()}>
            <div className={styles.expiredHeader}>
              <h2 className={styles.expiredTitle}>Edit Period Dates</h2>
              <button className={styles.expiredClose} onClick={() => setEditingDates(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className={styles.dateEditBody}>
              <p className={styles.dateEditHint}>Adjust when this budget period starts and ends.</p>
              <div className={styles.dateEditFields}>
                <div className={styles.dateEditField}>
                  <label className={styles.dateEditLabel}>Start date</label>
                  <input type="date" className="input-field" value={editStart} onChange={e => setEditStart(e.target.value)} />
                </div>
                <div className={styles.dateEditField}>
                  <label className={styles.dateEditLabel}>End date</label>
                  <input type="date" className="input-field" value={editEnd} onChange={e => setEditEnd(e.target.value)} />
                </div>
              </div>
              <button className="btn-primary" onClick={saveDateChanges} disabled={savingDates} style={{ marginTop: 16 }}>
                {savingDates ? 'Saving...' : 'Save Changes'}
              </button>
              <button className={styles.expiredDismiss} onClick={() => setEditingDates(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* View toggle */}
      <div className={styles.modeToggle}>
        <button className={`${styles.modeTab} ${view === 'type' ? styles.active : ''}`} onClick={() => setView('type')}>
          By Type
        </button>
        <button className={`${styles.modeTab} ${view === 'category' ? styles.active : ''}`} onClick={() => setView('category')}>
          By Category
        </button>
      </div>

      {/* ── BY TYPE VIEW ── */}
      {view === 'type' && (
        <>
          {periodStart && periodEnd && (
            <div className={styles.dateRangeCard}>
              <div className={styles.dateRangeInfo}>
                <div className={styles.dateRangeText}>
                  {formatDate(periodStart)} – {formatDate(periodEnd)}
                </div>
                <div className={styles.dateRangeDays}>
                  {daysLeft === 0 ? 'Last day!' : daysLeft === 1 ? '1 day left' : `${daysLeft} days left`}
                </div>
              </div>
              <div className={styles.dateRangeActions}>
                <button className={styles.dateEditBtn} onClick={openDateEditor} title="Edit dates">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </button>
              </div>
              <div className={styles.timeProgressBar}>
                <div className={styles.timeProgressFill} style={{ width: `${timeProgress * 100}%` }} />
              </div>
            </div>
          )}

          <div className={styles.tabNav}>
            <button className={`${styles.tabBtn} ${activeTab === 'expenses' ? styles.active : ''}`} onClick={() => setActiveTab('expenses')}>
              Daily Expenses
            </button>
            <button className={`${styles.tabBtn} ${activeTab === 'bills' ? styles.active : ''}`} onClick={() => setActiveTab('bills')}>
              Bills
            </button>
            <button className={`${styles.tabBtn} ${activeTab === 'savings' ? styles.active : ''}`} onClick={() => setActiveTab('savings')}>
              Savings
            </button>
          </div>

          {!period ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-hint)" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              </div>
              <p className={styles.emptyTitle}>No active budget period</p>
              <p className={styles.emptyDesc}>Set a budget to start tracking your spending and bills.</p>
              <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/paycheck-allocator')}>
                Set Budget Period
              </button>
            </div>
          ) : (
            <>
              <div className={styles.hero}>
                <div className={styles.heroTopRow}>
                  <div className={styles.heroLabel}>
                    {activeTab === 'expenses' ? 'Spending budget' : activeTab === 'bills' ? 'Bills budget' : 'Savings allocation'}
                  </div>
                  <button className={styles.editBudgetBtn} onClick={() => navigate('/paycheck-allocator?edit=1')}>
                    Edit
                  </button>
                </div>
                {activeTab === 'savings' ? (
                  savingsBudget > 0 ? (
                    <>
                      <div className={styles.heroAmount}>{formatCurrency(savingsBudget)}</div>
                      <div className={styles.heroSub}>
                        set aside this period for savings
                      </div>
                      {totalMonthlyNeeded > 0 && (
                        <div className={styles.heroSub} style={{ marginTop: 4, color: totalMonthlyNeeded > savingsBudget ? 'var(--color-warning)' : 'var(--color-success)' }}>
                          Your goals need {formatCurrency(totalMonthlyNeeded)}/month
                        </div>
                      )}
                    </>
                  ) : (
                    <div className={styles.heroSub} style={{ marginTop: 8 }}>No savings set aside yet. Tap Edit to add one.</div>
                  )
                ) : typeHeroAmount > 0 ? (
                  <>
                    <div className={styles.heroAmount}>{formatCurrency(typeHeroAmount)}</div>
                    <ProgressBar value={typeHeroSpent} max={typeHeroAmount} showLabel={false} />
                    <div className={styles.heroSub}>
                      {formatCurrency(typeHeroSpent)} {activeTab === 'expenses' ? 'spent' : 'total'} — {(typePercentUsed * 100).toFixed(0)}% used
                    </div>
                    <div className={styles.heroRemaining}>
                      {typePercentUsed >= 1
                        ? `Over by ${formatCurrency(typeHeroSpent - typeHeroAmount)}`
                        : `${formatCurrency(typeHeroAmount - typeHeroSpent)} remaining`
                      }
                    </div>
                  </>
                ) : (
                  <div className={styles.heroSub} style={{ marginTop: 8 }}>No budget set for this category</div>
                )}
              </div>

              {activeTab === 'expenses' && (
                <>
                  {periodTxns.length > 0 ? (
                    <div className={styles.txnList}>
                      {periodTxns.map(t => (
                        <div key={t.id} className={styles.txnRow}>
                          <div className={styles.txnIconCircle}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round">
                              <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
                              <polyline points="17 18 23 18 23 12"/>
                            </svg>
                          </div>
                          <div className={styles.txnInfo}>
                            <div className={styles.txnDesc}>{t.description || t.category}</div>
                            <div className={styles.txnMeta}>{t.category} · {formatDate(t.date)} · {t.bank}</div>
                          </div>
                          <div className={styles.txnAmount}>-{formatCurrency(t.amount)}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.empty}>
                      <div className={styles.emptyIcon}>
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-hint)" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                          <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                      </div>
                      No expenses logged yet this period
                    </div>
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
                          <label className={styles.paidToggleLabel}>
                            <input type="checkbox" className={styles.paidToggle} checked={b.isPaid} onChange={() => handleTogglePaid(b)} />
                            <span className={styles.paidToggleSlider} />
                          </label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.empty}>No bills added yet. Add bills in the Bills section.</div>
                  )}
                </>
              )}

              {activeTab === 'savings' && (
                <>
                  {savingsGoalDetails.length > 0 ? (
                    <div className={styles.savingsGoalList}>
                      {savingsGoalDetails.map(g => (
                        <div key={g.id} className={styles.savingsGoalCard} onClick={() => navigate('/savings-goals')}>
                          <div className={styles.savingsGoalHeader}>
                            <div>
                              <div className={styles.savingsGoalName}>{g.name}</div>
                              {g.bank && <div className={styles.savingsGoalBank}>{g.bank}</div>}
                            </div>
                            <span className={`${styles.badge} ${g.pct >= 1 ? styles.paid : g.remaining <= 0 ? styles.paid : styles.upcoming}`}>
                              {g.pct >= 1 ? 'Complete' : `${(g.pct * 100).toFixed(0)}%`}
                            </span>
                          </div>
                          <ProgressBar value={g.savedAmount || 0} max={g.targetAmount || 1} showLabel={false} />
                          <div className={styles.savingsGoalMeta}>
                            <span>{formatCurrency(g.savedAmount || 0)} of {formatCurrency(g.targetAmount)}</span>
                            <span>{formatCurrency(g.monthlyNeeded)}/mo needed</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.empty}>
                      <div className={styles.emptyIcon}>
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-hint)" strokeWidth="1.5" strokeLinecap="round">
                          <circle cx="12" cy="12" r="10"/>
                          <path d="M12 6v6l4 2"/>
                        </svg>
                      </div>
                      <p className={styles.emptyTitle}>No savings goals yet</p>
                      <p className={styles.emptyDesc}>Create goals to track your progress.</p>
                      <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => navigate('/savings-goals')}>
                        Add Savings Goal
                      </button>
                    </div>
                  )}
                </>
              )}

              <div style={{ height: 120 }} />

              <div className={styles.footer}>
                <div className={styles.footerInner}>
                  {activeTab === 'expenses' ? (
                    <>
                      <div className={styles.footerRow}>
                        <span className={styles.footerLabel}>Budget</span>
                        <span className={styles.footerValue}>{formatCurrency(expensesBudget)}</span>
                      </div>
                      <div className={styles.footerRow}>
                        <span className={styles.footerLabel}>Spent so far</span>
                        <span className={styles.footerValue} style={{ color: 'var(--color-danger)' }}>-{formatCurrency(totalExpensesSpent)}</span>
                      </div>
                      <div className={styles.footerDivider} />
                      <div className={styles.footerRemaining}>
                        <span>You can still spend</span>
                        <span style={{ color: expensesRemaining < 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                          {formatCurrency(expensesRemaining)}
                        </span>
                      </div>
                    </>
                  ) : activeTab === 'bills' ? (
                    <>
                      <div className={styles.footerRow}>
                        <span className={styles.footerLabel}>Bills budget</span>
                        <span className={styles.footerValue}>{formatCurrency(billsBudget)}</span>
                      </div>
                      <div className={styles.footerRow}>
                        <span className={styles.footerLabel}>Already paid</span>
                        <span className={styles.footerValue} style={{ color: 'var(--color-success)' }}>-{formatCurrency(billsPaid)}</span>
                      </div>
                      <div className={styles.footerRow}>
                        <span className={styles.footerLabel}>Still unpaid</span>
                        <span className={styles.footerValue} style={{ color: 'var(--color-warning)' }}>-{formatCurrency(billsUnpaid)}</span>
                      </div>
                      <div className={styles.footerDivider} />
                      <div className={styles.footerRemaining}>
                        <span>Remaining</span>
                        <span style={{ color: billsRemaining < 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                          {formatCurrency(billsRemaining)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={styles.footerRow}>
                        <span className={styles.footerLabel}>Savings allocation</span>
                        <span className={styles.footerValue}>{formatCurrency(savingsBudget)}</span>
                      </div>
                      <div className={styles.footerRow}>
                        <span className={styles.footerLabel}>Total saved</span>
                        <span className={styles.footerValue} style={{ color: 'var(--color-success)' }}>{formatCurrency(totalSaved)}</span>
                      </div>
                      <div className={styles.footerRow}>
                        <span className={styles.footerLabel}>Still needed</span>
                        <span className={styles.footerValue}>{formatCurrency(totalSavingsTarget - totalSaved)}</span>
                      </div>
                      <div className={styles.footerDivider} />
                      <div className={styles.footerRemaining}>
                        <span>Monthly needed</span>
                        <span style={{ color: totalMonthlyNeeded > savingsBudget ? 'var(--color-warning)' : 'var(--color-success)' }}>
                          {formatCurrency(totalMonthlyNeeded)}
                        </span>
                      </div>
                    </>
                  )}
                  {typeHeroAmount > 0 && (
                    <div className={styles.footerStatus}>
                      <span className={styles.statusPill} style={{ backgroundColor: typeStatusColor + '20', color: typeStatusColor }}>{typeStatus}</span>
                      <span>{periodEnd ? `Resets ${formatDate(periodEnd)}` : ''}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── BY CATEGORY VIEW ── */}
      {view === 'category' && (
        <>
          {categoryRows.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-hint)" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M18 20V10M12 20V4M6 20v-6"/>
                </svg>
              </div>
              <p className={styles.emptyTitle}>No spending data yet</p>
              <p className={styles.emptyDesc}>Log expenses via the + button, or set budget limits per category in Settings.</p>
            </div>
          ) : (
            <>
              {budgets.length === 0 && (
                <div className={styles.catHint}>
                  No limits set — showing spending only. Go to Settings to set limits per category.
                </div>
              )}
              <div className={styles.catList}>
                {categoryRows.map(({ cat, limit, spent }) => {
                  const pct = limit > 0 ? spent / limit : 0
                  const color = pct >= 1 ? 'var(--color-danger)' : pct >= 0.8 ? 'var(--color-warning)' : 'var(--color-success)'
                  return (
                    <div key={cat} className={styles.catRow}>
                      <div className={styles.catHeader}>
                        <span className={styles.catName}>{cat}</span>
                        <span className={styles.catAmounts}>
                          <span style={{ color: 'var(--color-danger)' }}>{formatCurrency(spent)}</span>
                          {limit > 0 && <span className={styles.catLimit}> / {formatCurrency(limit)}</span>}
                        </span>
                      </div>
                      {limit > 0 ? (
                        <>
                          <ProgressBar value={spent} max={limit} showLabel={false} />
                          <div className={styles.catSub}>
                            {pct >= 1
                              ? <span style={{ color: 'var(--color-danger)' }}>Over by {formatCurrency(spent - limit)}</span>
                              : <span style={{ color }}>
                                  {formatCurrency(limit - spent)} left · {(pct * 100).toFixed(0)}% used
                                </span>
                            }
                          </div>
                        </>
                      ) : (
                        <div className={styles.catSub} style={{ color: 'var(--color-text-secondary)' }}>No limit set</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
