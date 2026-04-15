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
import { getActiveBudgetPeriod, getCompletedBudgetPeriods } from '../firebase/budgetPeriods'
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
import FinancialMood, { getFinancialMood } from '../components/FinancialMood'
import { LeafDecor, PlantDecor } from '../components/Decorations'
import styles from './Dashboard.module.css'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function getFirstName(user) {
  if (!user) return ''
  const display = user.displayName || user.email || ''
  return display.split(' ')[0].split('@')[0]
}

export default function Dashboard() {
  const [settings, setSettings] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [transfers, setTransfers] = useState([])
  const [budgets, setBudgets] = useState([])
  const [bills, setBills] = useState([])
  const [savingsGoals, setSavingsGoals] = useState([])
  const [debts, setDebts] = useState([])
  const [activePeriod, setActivePeriod] = useState(null)
  const [lastPeriod, setLastPeriod] = useState(null)
  const [loading, setLoading] = useState(true)
  const [balancesHidden, setBalancesHidden] = useState(() => localStorage.getItem('pesowise_hide_balances') === 'true')
  const [netCashHidden, setNetCashHidden] = useState(() => localStorage.getItem('pesowise_hide_netcash') === 'true')

  function toggleBalances() {
    setBalancesHidden(prev => {
      const next = !prev
      localStorage.setItem('pesowise_hide_balances', String(next))
      return next
    })
  }

  function toggleNetCash() {
    setNetCashHidden(prev => {
      const next = !prev
      localStorage.setItem('pesowise_hide_netcash', String(next))
      return next
    })
  }
  const { currentUser } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    loadAll()
  }, [currentUser])

  async function loadAll() {
    if (!currentUser) return
    setLoading(true)
    try {
      const [s, txns, xfers, b, bl, sg, d, ap, cp] = await Promise.all([
        getUserSettings(currentUser.uid),
        getTransactions(currentUser.uid),
        getTransfers(currentUser.uid),
        getBudgets(currentUser.uid),
        getBills(currentUser.uid),
        getSavingsGoals(currentUser.uid),
        getDebts(currentUser.uid),
        getActiveBudgetPeriod(currentUser.uid),
        getCompletedBudgetPeriods(currentUser.uid),
      ])
      setSettings(s)
      setTransactions(txns)
      setTransfers(xfers)
      setBudgets(b)
      setBills(bl)
      setSavingsGoals(sg)
      setDebts(d)
      setActivePeriod(ap)
      setLastPeriod(cp && cp.length > 0 ? cp[0] : null)
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

  const bankBalanceMap = useMemo(() => {
    const map = {}
    bankBalances.forEach(b => { map[b.name] = b.balance })
    return map
  }, [bankBalances])

  function getEffectiveSaved(g) {
    if (g.linkedBank && g.bank && bankBalanceMap[g.bank] !== undefined) {
      return Math.max(0, bankBalanceMap[g.bank])
    }
    return g.savedAmount || 0
  }

  const monthTotals = useMemo(() => getMonthTotals(transactions, monthLabel), [transactions, monthLabel])
  const prevMonthLabel = getPreviousMonthLabel(monthLabel)
  const prevTotals = useMemo(() => getMonthTotals(transactions, prevMonthLabel), [transactions, prevMonthLabel])
  const rollover = calculateRollover(prevTotals.income, prevTotals.expenses)

  const netCash = monthTotals.income - monthTotals.expenses
  const netCashPositive = netCash >= 0

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

  const mood = getFinancialMood(healthScore.total)

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.headerBar}>
          <div className={styles.logoRow}>
            <div className={styles.logoIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L15 8H9L12 2Z" fill="white" opacity="0.9"/>
                <circle cx="12" cy="15" r="6" fill="white" opacity="0.7"/>
                <path d="M9 14h6M12 11v8" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.9"/>
              </svg>
            </div>
            <span className={styles.logoText}>Peso Wise</span>
          </div>
        </div>
        {[1,2,3,4].map(i => (
          <div key={i} className="skeleton" style={{ height: 80, marginBottom: 16, borderRadius: 16 }} />
        ))}
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* Decorative elements */}
      <LeafDecor className={styles.leafDecor} />
      <PlantDecor className={styles.plantDecor} />

      {/* Header with greeting */}
      <div className={styles.headerBar}>
        <div className={styles.logoRow}>
          <div className={styles.logoIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L15 8H9L12 2Z" fill="white" opacity="0.9"/>
              <circle cx="12" cy="15" r="6" fill="white" opacity="0.7"/>
              <path d="M9 14h6M12 11v8" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.9"/>
            </svg>
          </div>
          <span className={styles.logoText}>Peso Wise</span>
        </div>
        <span className={styles.monthLabel}>{monthLabel.replace('-', ' ')}</span>
      </div>

      {/* Greeting + mood card */}
      <div className={styles.greetingCard}>
        <div className={styles.greetingText}>
          <div className={styles.greeting}>{getGreeting()}, {getFirstName(currentUser)}</div>
          <div className={styles.greetingSub}>Here's how your finances are feeling today</div>
        </div>
        <FinancialMood mood={mood} showLabel={false} />
      </div>

      {/* Net cash hero — simple & readable */}
      <div className={`${styles.netCashCard} ${netCashPositive ? styles.netPositive : styles.netNegative}`}>
        <div className={styles.netCashTopRow}>
          <div className={styles.netCashLabel}>
            {netCashPositive ? 'You saved this month' : 'You overspent this month'}
          </div>
          <button className={styles.eyeBtn} onClick={toggleNetCash} aria-label={netCashHidden ? 'Show amount' : 'Hide amount'}>
            {netCashHidden ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            )}
          </button>
        </div>
        <div className={styles.netCashAmount}>
          {netCashHidden ? '••••••' : formatCurrency(Math.abs(netCash))}
        </div>
        {rollover !== 0 && (
          <div className={styles.rollover}>
            Leftover from {prevMonthLabel.replace('-', ' ')}: {netCashHidden ? '••••' : formatCurrency(rollover)}
          </div>
        )}
      </div>

      {/* Burn rate — friendly language */}
      {burnRate && (
        <div
          className={`${styles.burnAlert} ${styles[getBurnRateStatus(burnRate.dailyAverage, burnRate.safeDailyTarget)]}`}
          onClick={() => navigate('/burn-rate')}
        >
          <span className={styles.burnIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C12 2 7 8 7 13C7 16.87 9.24 19 12 19C14.76 19 17 16.87 17 13C17 8 12 2 12 2Z" fill="currentColor" opacity="0.2"/>
              <path d="M12 5C12 5 9 9 9 12C9 14.21 10.34 16 12 16C13.66 16 15 14.21 15 12C15 9 12 5 12 5Z" fill="currentColor" opacity="0.3"/>
            </svg>
          </span>
          <span>
            Spending {formatCurrency(burnRate.dailyAverage)}/day — budget lasts {burnRate.daysRemaining} more days
          </span>
        </div>
      )}

      {/* Last period summary */}
      {lastPeriod?.summary && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            Last Budget Period
            <button className={styles.seeAll} onClick={() => navigate('/reports')}>View all</button>
          </div>
          <div className={styles.card} style={{ padding: 16 }}>
            <div className={styles.periodDateLabel}>
              {new Date(lastPeriod.summary.startDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} – {new Date(lastPeriod.summary.endDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
            <div className={styles.breakdownRow}>
              <span className={styles.breakdownLabel}>Expenses</span>
              <span className={styles.breakdownValue} style={{ color: lastPeriod.summary.expensesOnBudget ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {formatCurrency(lastPeriod.summary.expensesSpent)} / {formatCurrency(lastPeriod.summary.expensesBudget)}
                {lastPeriod.summary.expensesOnBudget ? ' ✓' : ' ✕'}
              </span>
            </div>
            <div className={styles.breakdownRow}>
              <span className={styles.breakdownLabel}>Bills</span>
              <span className={styles.breakdownValue} style={{ color: lastPeriod.summary.billsOnBudget ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {formatCurrency(lastPeriod.summary.billsTotal)} / {formatCurrency(lastPeriod.summary.billsBudget)}
                {lastPeriod.summary.billsOnBudget ? ' ✓' : ' ✕'}
              </span>
            </div>
            {lastPeriod.summary.savingsBudget > 0 && (
              <div className={styles.breakdownRow}>
                <span className={styles.breakdownLabel}>Savings set aside</span>
                <span className={styles.breakdownValue} style={{ color: 'var(--color-success)' }}>
                  {formatCurrency(lastPeriod.summary.savingsBudget)}
                </span>
              </div>
            )}
            <div className={styles.breakdownDivider} />
            <div className={styles.breakdownRow}>
              <span className={styles.breakdownTotal}>
                {lastPeriod.summary.expensesOnBudget && lastPeriod.summary.billsOnBudget ? 'Stayed on budget' : 'Went over budget'}
              </span>
              <span className={`${styles.verdictBadge} ${lastPeriod.summary.expensesOnBudget && lastPeriod.summary.billsOnBudget ? styles.verdictGood : styles.verdictBad}`}>
                {lastPeriod.summary.expensesOnBudget && lastPeriod.summary.billsOnBudget ? 'On track' : 'Over'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Bank balances */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <span className={styles.sectionTitleLeft}>
            Your Accounts
            <button className={styles.eyeBtn} onClick={toggleBalances} aria-label={balancesHidden ? 'Show balances' : 'Hide balances'}>
              {balancesHidden ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </span>
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
              hidden={balancesHidden}
            />
          )) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-hint)" strokeWidth="1.5" strokeLinecap="round">
                  <rect x="3" y="6" width="18" height="13" rx="2"/>
                  <path d="M3 10h18"/>
                </svg>
              </div>
              No accounts set up yet
            </div>
          )}
        </div>
      </div>

      {/* Budget status */}
      {topBudgets.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            Budget Status
            <button className={styles.seeAll} onClick={() => navigate('/budget-tracker')}>See all</button>
          </div>
          <div className={styles.budgetList}>
            {topBudgets.map(b => {
              const pct = b.monthlyLimit > 0 ? Math.min(b.spent / b.monthlyLimit, 1) : 0
              return (
                <div key={b.category} className={styles.budgetRow}>
                  <div className={styles.budgetHeader}>
                    <span className={styles.budgetCategory}>{b.category}</span>
                    <span className={styles.budgetValues}>
                      {formatCurrency(b.spent)}
                      <span className={styles.budgetLimit}> of {formatCurrency(b.monthlyLimit)}</span>
                    </span>
                  </div>
                  <ProgressBar value={b.spent} max={b.monthlyLimit} showLabel={false} />
                  <div className={styles.budgetHint}>
                    {pct >= 1 ? 'Over budget' : `${formatCurrency(b.monthlyLimit - b.spent)} left to spend`}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Bills due soon */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          Bills Coming Up
          <button className={styles.seeAll} onClick={() => navigate('/bills')}>View all</button>
        </div>
        {upcomingBills.length > 0 ? (
          <div className={styles.billsList}>
            {upcomingBills.map(b => {
              const daysUntil = b.dueDay - new Date().getDate()
              return (
                <div key={b.id} className={styles.billRow} onClick={() => navigate('/bills')}>
                  <div className={styles.billIconCircle}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" strokeWidth="2" strokeLinecap="round">
                      <rect x="5" y="4" width="14" height="17" rx="2"/>
                      <path d="M9 9h6M9 13h4"/>
                    </svg>
                  </div>
                  <div className={styles.billInfo}>
                    <span className={styles.billName}>{b.name}</span>
                    <span className={styles.billDue}>
                      {daysUntil <= 0 ? 'Due today!' : daysUntil === 1 ? 'Due tomorrow' : `Due in ${daysUntil} days`}
                    </span>
                  </div>
                  <span className={styles.billAmount}>{formatCurrency(b.amount)}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-hint)" strokeWidth="1.5" strokeLinecap="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            All clear! No bills due this week
          </div>
        )}
      </div>

      {/* Health score — friendly */}
      <div className={styles.healthCard} onClick={() => navigate('/health-score')}>
        <FinancialMood mood={mood} size="normal" />
        <div className={styles.healthScoreBubble} style={{
          backgroundColor: mood === 'great' || mood === 'good' ? 'var(--pastel-mint)' :
            mood === 'okay' ? 'var(--pastel-butter)' : 'var(--pastel-rose)',
        }}>
          <span className={styles.healthScoreNum}>{healthScore.total}</span>
          <span className={styles.healthScoreMax}>/100</span>
        </div>
      </div>

      {/* Money breakdown — easy to read */}
      {(() => {
        const savingsPct = settings?.savingsPercentage || 0
        const activeBillsTotal = bills.filter(b => b.isActive).reduce((s, b) => s + b.amount, 0)
        const savingsDeduction = savingsPct > 0 ? monthTotals.income * savingsPct / 100 : 0
        const availableMoney = monthTotals.income - savingsDeduction - activeBillsTotal
        if (monthTotals.income > 0) {
          return (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Your Money This Month</div>
              <div className={styles.card} style={{ padding: 18 }}>
                <div className={styles.breakdownRow}>
                  <span className={styles.breakdownLabel}>Money came in</span>
                  <span className={styles.breakdownValue}>{netCashHidden ? '••••••' : formatCurrency(monthTotals.income)}</span>
                </div>
                {savingsPct > 0 && (
                  <div className={styles.breakdownRow}>
                    <span className={styles.breakdownLabel}>Set aside for savings ({savingsPct}%)</span>
                    <span className={styles.breakdownValue} style={{ color: 'var(--color-success)' }}>{netCashHidden ? '••••••' : `-${formatCurrency(savingsDeduction)}`}</span>
                  </div>
                )}
                <div className={styles.breakdownRow}>
                  <span className={styles.breakdownLabel}>Bills to pay</span>
                  <span className={styles.breakdownValue} style={{ color: 'var(--color-warning)' }}>{netCashHidden ? '••••••' : `-${formatCurrency(activeBillsTotal)}`}</span>
                </div>
                <div className={styles.breakdownDivider} />
                <div className={styles.breakdownRow}>
                  <span className={styles.breakdownTotal}>You can spend</span>
                  <span className={styles.breakdownTotalValue} style={{ color: availableMoney >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {netCashHidden ? '••••••' : formatCurrency(availableMoney)}
                  </span>
                </div>
              </div>
            </div>
          )
        }
        return null
      })()}

      {/* Insight */}
      {insights.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 6, verticalAlign: -2 }}>
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4M12 8h.01"/>
              </svg>
              Tip for You
            </span>
          </div>
          <InsightCard
            type={insights[0].type}
            headline={insights[0].headline}
            detail={insights[0].detail}
            tip={insights[0].tip}
            onClick={() => navigate('/insights')}
          />
        </div>
      )}

      {/* Savings goals */}
      {savingsGoals.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            Savings Goals
            <button className={styles.seeAll} onClick={() => navigate('/savings-goals')}>See all</button>
          </div>
          <div className={styles.goalsList}>
            {savingsGoals.map(g => {
              const effectiveSaved = getEffectiveSaved(g)
              const pct = g.targetAmount > 0 ? Math.min(effectiveSaved / g.targetAmount, 1) : 0
              return (
                <div key={g.id} className={styles.goalRow} onClick={() => navigate('/savings-goals')}>
                  <div className={styles.goalHeader}>
                    <span className={styles.goalName}>{g.name}{g.linkedBank ? ' (linked)' : ''}</span>
                    <span className={styles.goalPct}>{(pct * 100).toFixed(0)}%</span>
                  </div>
                  <ProgressBar value={effectiveSaved} max={g.targetAmount} showLabel={false} />
                  <div className={styles.goalValues}>
                    {formatCurrency(effectiveSaved)} saved of {formatCurrency(g.targetAmount)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
