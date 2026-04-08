import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getTransactions } from '../firebase/transactions'
import { getActiveBudgetPeriod } from '../firebase/budgetPeriods'
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
import styles from './BudgetTracker.module.css'

export default function BudgetTracker() {
  const [transactions, setTransactions] = useState([])
  const [period, setPeriod] = useState(null)
  const [bills, setBills] = useState([])
  const [budgets, setBudgets] = useState([])
  const [savingsGoals, setSavingsGoals] = useState([])
  const [settings, setSettings] = useState(null)
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('type') // 'type' | 'category'
  const [activeTab, setActiveTab] = useState('expenses')
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
      setPeriod(ap)
      setBills(bl)
      setBudgets(bg || [])
      setSavingsGoals(sg || [])
      setSettings(st)
      setTransfers(xfers || [])
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

  // Per-type values
  const expensesBudget = period?.expensesBudget || 0
  const billsBudget = period?.billsBudget || 0
  const savingsBudget = period?.savingsBudget || 0
  const expensesRemaining = expensesBudget - totalExpensesSpent
  const billsRemaining = billsBudget - billsTotal

  // Resolve savedAmount: use bank balance if goal is linked
  const banks = settings?.banks || []
  function getEffectiveSaved(g) {
    if (g.linkedBank && g.bank) {
      const bankInfo = banks.find(b => b.name === g.bank)
      if (bankInfo) return Math.max(0, calculateBankBalance(bankInfo.name, bankInfo.openingBalance, transactions, transfers))
    }
    return g.savedAmount || 0
  }

  // Savings calculations
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

  // Hero values depend on active tab in "By Type" view
  const typeHeroAmount = activeTab === 'expenses' ? expensesBudget : activeTab === 'bills' ? billsBudget : savingsBudget
  const typeHeroSpent = activeTab === 'expenses' ? totalExpensesSpent : activeTab === 'bills' ? billsTotal : 0
  const typePercentUsed = typeHeroAmount > 0 ? typeHeroSpent / typeHeroAmount : 0
  const typeStatus = typePercentUsed >= 1 ? 'Over budget!' : typePercentUsed >= 0.8 ? 'Running low' : 'On track'
  const typeStatusColor = typePercentUsed >= 1 ? 'var(--color-danger)' : typePercentUsed >= 0.8 ? 'var(--color-warning)' : 'var(--color-success)'

  // Category spending map (all transactions, not just period)
  const categorySpending = useMemo(() => {
    const map = {}
    periodTxns.forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount
    })
    return map
  }, [periodTxns])

  // All categories that have either a budget or spending this period
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

  if (loading) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Budget Tracker</h1>
        {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 10, marginBottom: 12 }} />)}
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Budget Tracker</h1>

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
            <div className={styles.dateRange}>
              {formatDate(periodStart)} – {formatDate(periodEnd)} · {daysLeft} days left
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
              <p>No active budget period.</p>
              <p style={{ marginTop: 8, marginBottom: 20 }}>Set a budget to track your expenses and bills.</p>
              <button className="btn-primary" onClick={() => navigate('/paycheck-allocator')}>
                Set Budget Period
              </button>
            </div>
          ) : (
            <>
              <div className={styles.hero}>
                <div className={styles.heroTopRow}>
                  <div className={styles.heroLabel}>
                    {activeTab === 'expenses' ? 'Daily expenses budget' : activeTab === 'bills' ? 'Bills budget' : 'Savings allocation'}
                  </div>
                  <button className={styles.editBudgetBtn} onClick={() => navigate('/paycheck-allocator?edit=1')}>
                    Edit Budget
                  </button>
                </div>
                {activeTab === 'savings' ? (
                  savingsBudget > 0 ? (
                    <>
                      <div className={styles.heroAmount}>{formatCurrency(savingsBudget)}</div>
                      <div className={styles.heroSub}>
                        allocated this period for savings
                      </div>
                      {totalMonthlyNeeded > 0 && (
                        <div className={styles.heroSub} style={{ marginTop: 4, color: totalMonthlyNeeded > savingsBudget ? 'var(--color-warning)' : 'var(--color-success)' }}>
                          Goals need {formatCurrency(totalMonthlyNeeded)}/month
                        </div>
                      )}
                    </>
                  ) : (
                    <div className={styles.heroSub} style={{ marginTop: 8 }}>No savings allocation set. Edit your budget to add one.</div>
                  )
                ) : typeHeroAmount > 0 ? (
                  <>
                    <div className={styles.heroAmount}>{formatCurrency(typeHeroAmount)}</div>
                    <ProgressBar value={typeHeroSpent} max={typeHeroAmount} showLabel={false} />
                    <div className={styles.heroSub}>
                      {formatCurrency(typeHeroSpent)} {activeTab === 'expenses' ? 'spent' : 'total'} — {(typePercentUsed * 100).toFixed(0)}% used
                    </div>
                  </>
                ) : (
                  <div className={styles.heroSub} style={{ marginTop: 8 }}>No budget set for this type</div>
                )}
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
                      <p>No savings goals yet.</p>
                      <p style={{ marginTop: 8, marginBottom: 20 }}>Create goals to track your savings progress.</p>
                      <button className="btn-primary" onClick={() => navigate('/savings-goals')}>
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
                        <span className={styles.footerLabel}>Expenses budget</span>
                        <span className={styles.footerValue}>{formatCurrency(expensesBudget)}</span>
                      </div>
                      <div className={styles.footerRow}>
                        <span className={styles.footerLabel}>Spent</span>
                        <span className={styles.footerValue} style={{ color: 'var(--color-danger)' }}>-{formatCurrency(totalExpensesSpent)}</span>
                      </div>
                      <div className={styles.footerDivider} />
                      <div className={styles.footerRemaining}>
                        <span>Remaining</span>
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
                        <span className={styles.footerLabel}>Paid</span>
                        <span className={styles.footerValue} style={{ color: 'var(--color-success)' }}>-{formatCurrency(billsPaid)}</span>
                      </div>
                      <div className={styles.footerRow}>
                        <span className={styles.footerLabel}>Unpaid</span>
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
                        <span className={styles.footerLabel}>Total saved (all goals)</span>
                        <span className={styles.footerValue} style={{ color: 'var(--color-success)' }}>{formatCurrency(totalSaved)}</span>
                      </div>
                      <div className={styles.footerRow}>
                        <span className={styles.footerLabel}>Still needed (all goals)</span>
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
              <p>No spending or category budgets found.</p>
              <p style={{ marginTop: 8 }}>Log expenses via the <strong>+</strong> button, or set budget limits per category in <strong>Settings → Monthly Budgets</strong>.</p>
            </div>
          ) : (
            <>
              {budgets.length === 0 && (
                <div className={styles.catHint}>
                  No limits set — showing spending only. Go to <strong>Settings → Monthly Budgets</strong> to set limits per category.
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
