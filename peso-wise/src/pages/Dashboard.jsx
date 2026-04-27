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
import PesoWiseLogo from '../components/PesoWiseLogo'
import VerseCard from '../components/VerseCard'
import { getDashboardVerse } from '../utils/verses'
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

  const spendingByCategory = useMemo(() => {
    const map = {}
    currentMonthTxns.forEach(t => {
      if (t.isIncome) return
      const cat = t.category || 'Miscellaneous'
      map[cat] = (map[cat] || 0) + t.amount
    })
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1])
    return entries
  }, [currentMonthTxns])

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
          <PesoWiseLogo size={38} />
          <span className={styles.logoText}>Peso Wise</span>
        </div>
        <span className={styles.monthLabel}>{monthLabel.replace('-', ' ')}</span>
      </div>

      {/* Daily verse */}
      {(() => { const v = getDashboardVerse(); return <VerseCard quote={v.quote} reference={v.reference} context="default" /> })()}

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

      {/* Last period summary — only show rows with actual data */}
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

            {/* Only show expenses if there was a budget or spending */}
            {(lastPeriod.summary.expensesBudget > 0 || lastPeriod.summary.expensesSpent > 0) && (
              <div className={styles.breakdownRow}>
                <span className={styles.breakdownLabel}>
                  Spent {formatCurrency(lastPeriod.summary.expensesSpent)}
                  {lastPeriod.summary.expensesBudget > 0 && ` of ${formatCurrency(lastPeriod.summary.expensesBudget)}`}
                </span>
                <span className={styles.verdictBadge} style={{
                  backgroundColor: lastPeriod.summary.expensesOnBudget ? 'var(--color-success-light)' : 'var(--color-danger-light)',
                  color: lastPeriod.summary.expensesOnBudget ? 'var(--color-success)' : 'var(--color-danger)',
                }}>
                  {lastPeriod.summary.expensesOnBudget ? 'On budget' : 'Over'}
                </span>
              </div>
            )}

            {/* Only show bills if there was a bills budget or any bill activity */}
            {(lastPeriod.summary.billsBudget > 0 || lastPeriod.summary.billsTotal > 0) && (
              <div className={styles.breakdownRow}>
                <span className={styles.breakdownLabel}>
                  Bills {formatCurrency(lastPeriod.summary.billsTotal)}
                  {lastPeriod.summary.billsBudget > 0 && ` of ${formatCurrency(lastPeriod.summary.billsBudget)}`}
                </span>
                <span className={styles.verdictBadge} style={{
                  backgroundColor: lastPeriod.summary.billsOnBudget ? 'var(--color-success-light)' : 'var(--color-danger-light)',
                  color: lastPeriod.summary.billsOnBudget ? 'var(--color-success)' : 'var(--color-danger)',
                }}>
                  {lastPeriod.summary.billsOnBudget ? 'On budget' : 'Over'}
                </span>
              </div>
            )}

            {/* Only show savings if there was an allocation */}
            {lastPeriod.summary.savingsBudget > 0 && (
              <div className={styles.breakdownRow}>
                <span className={styles.breakdownLabel}>Savings set aside</span>
                <span className={styles.breakdownValue} style={{ color: 'var(--color-success)' }}>
                  {formatCurrency(lastPeriod.summary.savingsBudget)}
                </span>
              </div>
            )}

            {/* Simple overall verdict */}
            <div className={styles.breakdownDivider} />
            <div className={styles.breakdownRow}>
              <span className={styles.breakdownTotal}>
                {(() => {
                  const hadExpenses = lastPeriod.summary.expensesBudget > 0 || lastPeriod.summary.expensesSpent > 0
                  const hadBills = lastPeriod.summary.billsBudget > 0 || lastPeriod.summary.billsTotal > 0
                  const expensesOk = !hadExpenses || lastPeriod.summary.expensesOnBudget
                  const billsOk = !hadBills || lastPeriod.summary.billsOnBudget
                  return expensesOk && billsOk ? 'Stayed on budget' : 'Went over budget'
                })()}
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
          backgroundColor: mood === 'great' || mood === 'good' ? 'var(--accent-teal)' :
            mood === 'okay' ? 'var(--color-warning-light)' : 'var(--color-danger-light)',
        }}>
          <span className={styles.healthScoreNum}>{healthScore.total}</span>
          <span className={styles.healthScoreMax}>/100</span>
        </div>
      </div>

      {/* Income allocation breakdown */}
      {(() => {
        if (monthTotals.income <= 0) return null
        const allocs = settings?.incomeAllocation || (
          settings?.savingsPercentage > 0
            ? [{ label: 'Savings', percentage: settings.savingsPercentage }]
            : []
        )
        const activeAllocs = allocs.filter(a => a.percentage > 0)
        const totalPct = activeAllocs.reduce((s, a) => s + a.percentage, 0)
        const unallocatedPct = Math.max(0, 100 - totalPct)
        const allocColors = [
          'var(--color-success)', 'var(--color-primary)', 'var(--color-warning)',
          '#b87cbf', '#5b9bd5', '#e07b54', '#6bbf8e',
        ]
        return (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              Income Allocation
              <button className={styles.seeAll} onClick={() => navigate('/settings')}>Edit</button>
            </div>
            <div className={styles.card} style={{ padding: 18 }}>
              <div className={styles.breakdownRow}>
                <span className={styles.breakdownLabel}>Total income</span>
                <span className={styles.breakdownValue}>{netCashHidden ? '••••••' : formatCurrency(monthTotals.income)}</span>
              </div>
              {activeAllocs.length === 0 && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-hint)', padding: '8px 0' }}>
                  No allocations set — tap Edit to set up your budget percentages.
                </div>
              )}
              {activeAllocs.map((a, i) => {
                const amt = monthTotals.income * a.percentage / 100
                return (
                  <div key={a.label} className={styles.allocBreakdownRow}>
                    <span className={styles.allocDot} style={{ backgroundColor: allocColors[i % allocColors.length] }} />
                    <span className={styles.allocBreakdownLabel}>{a.label}</span>
                    <span className={styles.allocBreakdownPct} style={{ color: allocColors[i % allocColors.length] }}>{a.percentage}%</span>
                    <span className={styles.breakdownValue}>{netCashHidden ? '••••' : formatCurrency(amt)}</span>
                  </div>
                )
              })}
              {activeAllocs.length > 0 && unallocatedPct > 0 && (
                <div className={styles.allocBreakdownRow}>
                  <span className={styles.allocDot} style={{ backgroundColor: 'var(--color-border-solid)' }} />
                  <span className={styles.allocBreakdownLabel} style={{ color: 'var(--color-text-hint)' }}>Unallocated</span>
                  <span className={styles.allocBreakdownPct} style={{ color: 'var(--color-text-hint)' }}>{unallocatedPct}%</span>
                  <span className={styles.breakdownValue} style={{ color: 'var(--color-text-hint)' }}>{netCashHidden ? '••••' : formatCurrency(monthTotals.income * unallocatedPct / 100)}</span>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Spending by category pie chart */}
      {spendingByCategory.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            Spending by Category
            <button className={styles.seeAll} onClick={() => navigate('/reports')}>Full report</button>
          </div>
          <div className={styles.card} style={{ padding: '18px 8px' }}>
            {(() => {
              const PIE_COLORS = [
                '#4a7c6f','#708e9f','#e07b54','#e8c547','#6bbf8e',
                '#b87cbf','#5b9bd5','#e87272','#7dbfa5','#f0a05a',
                '#9b8dcc','#6db8c6','#d98a8a','#88b04b','#c88b5a',
              ]
              const total = spendingByCategory.reduce((s, [, amt]) => s + amt, 0)

              // Generous viewBox so labels never clip — pie sits in the center
              // with 110px of breathing room on each side for labels
              const VW = 500
              const VH = 420
              const CX = VW / 2
              const CY = VH / 2
              const R = 90         // pie outer radius
              const INNER = 50     // donut hole
              const ELBOW_R = 112  // where the angled line kinks
              const TICK = 22      // length of horizontal tick
              const MIN_LABEL_PCT = 0.04

              let cursor = -Math.PI / 2
              const slices = spendingByCategory.map(([cat, amt], i) => {
                const pct = amt / total
                const angle = pct * 2 * Math.PI
                const start = cursor
                const end = cursor + angle
                cursor = end
                const mid = start + angle / 2

                const x1 = CX + R * Math.cos(start), y1 = CY + R * Math.sin(start)
                const x2 = CX + R * Math.cos(end),   y2 = CY + R * Math.sin(end)
                const ix1 = CX + INNER * Math.cos(end),   iy1 = CY + INNER * Math.sin(end)
                const ix2 = CX + INNER * Math.cos(start), iy2 = CY + INNER * Math.sin(start)
                const large = angle > Math.PI ? 1 : 0
                const path = `M${x1},${y1} A${R},${R},0,${large},1,${x2},${y2} L${ix1},${iy1} A${INNER},${INNER},0,${large},0,${ix2},${iy2} Z`

                const isRight = Math.cos(mid) >= 0
                // line starts just outside the arc
                const lx1 = CX + (R + 3) * Math.cos(mid)
                const ly1 = CY + (R + 3) * Math.sin(mid)
                // elbow point
                const lx2 = CX + ELBOW_R * Math.cos(mid)
                const ly2 = CY + ELBOW_R * Math.sin(mid)
                // end of horizontal tick
                const lx3 = lx2 + (isRight ? TICK : -TICK)
                const ly3 = ly2
                // text starts just past tick end
                const tx = lx3 + (isRight ? 3 : -3)
                const anchor = isRight ? 'start' : 'end'

                return {
                  cat, amt, pct, mid, isRight, angle,
                  color: PIE_COLORS[i % PIE_COLORS.length],
                  path, lx1, ly1, lx2, ly2, lx3, ly3, tx, ty: ly3, anchor,
                }
              })

              return (
                <svg
                  viewBox={`0 0 ${VW} ${VH}`}
                  width="100%"
                  style={{ display: 'block' }}
                >
                  {/* Slices */}
                  {slices.map(s => (
                    <path key={s.cat} d={s.path} fill={s.color} stroke="#fff" strokeWidth="2" />
                  ))}

                  {/* Leader lines + labels */}
                  {slices.map(s => {
                    if (s.pct < MIN_LABEL_PCT) return null
                    const short = s.cat.length > 14 ? s.cat.slice(0, 13) + '…' : s.cat
                    const pctLabel = (s.pct * 100).toFixed(1) + '%'
                    const amtLabel = formatCurrency(s.amt)
                    return (
                      <g key={`lbl-${s.cat}`}>
                        <polyline
                          points={`${s.lx1},${s.ly1} ${s.lx2},${s.ly2} ${s.lx3},${s.ly3}`}
                          fill="none"
                          stroke={s.color}
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <text x={s.tx} y={s.ty - 4} textAnchor={s.anchor} fontSize="11" fontWeight="700" fill={s.color}>
                          {short}
                        </text>
                        <text x={s.tx} y={s.ty + 9} textAnchor={s.anchor} fontSize="10" fontWeight="500" fill={s.color} opacity="0.8">
                          {pctLabel} · {amtLabel}
                        </text>
                      </g>
                    )
                  })}
                </svg>
              )
            })()}
          </div>
        </div>
      )}

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
