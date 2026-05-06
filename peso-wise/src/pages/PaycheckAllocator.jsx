import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getBills } from '../firebase/bills'
import { getSavingsGoals } from '../firebase/savingsGoals'
import { addBudgetPeriod, updateBudgetPeriod, getActiveBudgetPeriod } from '../firebase/budgetPeriods'
import { getUserSettings } from '../firebase/settings'
import { useToast } from '../components/Toast'
import { calculateDefaultAllocation, validateAllocation } from '../engine/paycheckAllocator'
import { formatCurrency } from '../utils/formatCurrency'
import { getCurrentMonthString } from '../utils/dateHelpers'
import styles from './PaycheckAllocator.module.css'

const BUCKET_COLORS = [
  'var(--color-warning)',
  'var(--color-success)',
  'var(--color-primary)',
  '#a78bfa',
  '#f97316',
  '#06b6d4',
  '#ec4899',
]

const DEFAULT_BUCKETS = [
  { label: 'Bills' },
  { label: 'Savings' },
  { label: 'Daily Expenses' },
]

function isBillsLabel(label) { return (label || '').toLowerCase().includes('bill') }
function isSavingsLabel(label) { return (label || '').toLowerCase().includes('saving') }

export default function PaycheckAllocator() {
  const [searchParams] = useSearchParams()
  const rawAmount = Number(searchParams.get('amount'))
  const editMode = searchParams.get('edit') === '1'
  const carryBills = Number(searchParams.get('carryBills')) || 0
  const carrySavings = Number(searchParams.get('carrySavings')) || 0
  const carrySpending = Number(searchParams.get('carrySpending')) || 0
  const isCarryForward = carryBills > 0 || carrySavings > 0 || carrySpending > 0

  const [totalBudget, setTotalBudget] = useState(rawAmount || 0)
  const [periodType, setPeriodType] = useState('monthly')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [allocations, setAllocations] = useState([])
  const [settingsAllocation, setSettingsAllocation] = useState([])
  const [billsData, setBillsData] = useState([])
  const [goalsData, setGoalsData] = useState([])
  const [existingPeriodId, setExistingPeriodId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loadingPeriod, setLoadingPeriod] = useState(editMode)
  const { currentUser } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const incomeAmount = totalBudget

  function allocsFromSettings(settingsAlloc, amount) {
    return settingsAlloc.map(a => ({
      label: a.label,
      amount: Math.round(amount * (a.percentage || 0) / 100 * 100) / 100,
    }))
  }

  useEffect(() => {
    async function load() {
      if (!currentUser) return
      const [bills, goals, settings] = await Promise.all([
        getBills(currentUser.uid),
        getSavingsGoals(currentUser.uid),
        getUserSettings(currentUser.uid),
      ])
      setBillsData(bills)
      setGoalsData(goals)

      const settingsAlloc = settings?.incomeAllocation || []
      setSettingsAllocation(settingsAlloc)

      if (editMode) {
        const period = await getActiveBudgetPeriod(currentUser.uid)
        if (period) {
          setExistingPeriodId(period.id)
          const total = (period.expensesBudget || 0) + (period.billsBudget || 0) + (period.savingsBudget || 0)
          setTotalBudget(total)
          if (period.periodType) setPeriodType(period.periodType)

          if (settingsAlloc.length > 0) {
            // Re-distribute saved totals across settings categories proportionally
            const billsTotal = period.billsBudget || 0
            const savingsTotal = period.savingsBudget || 0
            const spendingTotal = period.expensesBudget || 0
            setAllocations(settingsAlloc.map(a => {
              const label = a.label || ''
              if (isBillsLabel(label)) return { label, amount: billsTotal }
              if (isSavingsLabel(label)) return { label, amount: savingsTotal }
              return { label, amount: spendingTotal }
            }))
          } else {
            setAllocations([
              { label: 'Bills', amount: period.billsBudget || 0 },
              { label: 'Savings', amount: period.savingsBudget || 0 },
              { label: 'Daily Expenses', amount: period.expensesBudget || 0 },
            ])
          }
        }
        setLoadingPeriod(false)
        return
      }

      if (isCarryForward) {
        const buckets = settingsAlloc.length > 0 ? settingsAlloc : DEFAULT_BUCKETS
        setAllocations(buckets.map(a => {
          const label = a.label || ''
          if (isBillsLabel(label)) return { label, amount: carryBills }
          if (isSavingsLabel(label)) return { label, amount: carrySavings }
          return { label, amount: carrySpending }
        }))
      } else if (rawAmount > 0) {
        if (settingsAlloc.length > 0) {
          setAllocations(allocsFromSettings(settingsAlloc, rawAmount))
        } else {
          const currentMonth = getCurrentMonthString()
          const unpaidBills = bills.filter(b => b.isActive && (!b.paidMonths || !b.paidMonths.includes(currentMonth)))
          const defaults = calculateDefaultAllocation(rawAmount, unpaidBills, goals)
          setAllocations([
            { label: 'Bills', amount: defaults.bills },
            { label: 'Savings', amount: defaults.savings },
            { label: 'Daily Expenses', amount: defaults.spending },
          ])
        }
      } else {
        const buckets = settingsAlloc.length > 0 ? settingsAlloc : DEFAULT_BUCKETS
        setAllocations(buckets.map(a => ({ label: a.label, amount: 0 })))
      }
    }
    load()
  }, [currentUser, rawAmount, editMode])

  function updateAlloc(index, val) {
    const v = Math.max(0, Number(val) || 0)
    setAllocations(prev => prev.map((a, i) => i === index ? { ...a, amount: v } : a))
  }

  function handleTotalBudgetChange(val) {
    const v = Math.max(0, Number(val) || 0)
    setTotalBudget(v)
    if (v > 0 && settingsAllocation.length > 0) {
      setAllocations(allocsFromSettings(settingsAllocation, v))
    } else {
      setAllocations(prev => prev.map(a => ({ ...a, amount: 0 })))
    }
  }

  const totalAlloc = allocations.reduce((s, a) => s + a.amount, 0)

  const validation = incomeAmount > 0
    ? (() => {
        const diff = Math.round((incomeAmount - totalAlloc) * 100) / 100
        return {
          isBalanced: Math.abs(diff) < 0.01,
          unallocated: diff > 0 ? diff : 0,
          overAllocated: diff < 0 ? Math.abs(diff) : 0,
        }
      })()
    : { isBalanced: true, unallocated: 0, overAllocated: 0 }

  function getPeriodDates() {
    if (periodType === 'custom' && customStart && customEnd) {
      return { start: new Date(customStart), end: new Date(customEnd) }
    }
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let end
    if (periodType === 'weekly') {
      end = new Date(start); end.setDate(end.getDate() + 6)
    } else if (periodType === 'biweekly') {
      end = new Date(start); end.setDate(end.getDate() + 13)
    } else {
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    }
    return { start, end }
  }

  function getMappedBudgets() {
    const billsBudget = allocations.filter(a => isBillsLabel(a.label)).reduce((s, a) => s + a.amount, 0)
    const savingsBudget = allocations.filter(a => isSavingsLabel(a.label)).reduce((s, a) => s + a.amount, 0)
    const expensesBudget = allocations
      .filter(a => !isBillsLabel(a.label) && !isSavingsLabel(a.label))
      .reduce((s, a) => s + a.amount, 0)
    return { billsBudget, savingsBudget, expensesBudget }
  }

  async function handleConfirm() {
    setSaving(true)
    try {
      const { billsBudget, savingsBudget, expensesBudget } = getMappedBudgets()
      const totalBudgetSaved = billsBudget + savingsBudget + expensesBudget

      if (editMode && existingPeriodId) {
        await updateBudgetPeriod(existingPeriodId, {
          periodType,
          totalBudget: totalBudgetSaved,
          expensesBudget,
          billsBudget,
          savingsBudget,
          customAllocations: allocations,
        })
        showToast('Budget updated ✓')
      } else {
        const { start, end } = getPeriodDates()
        await addBudgetPeriod(currentUser.uid, {
          periodType,
          startDate: start,
          endDate: end,
          mode: 'separate',
          totalBudget: totalBudgetSaved,
          expensesBudget,
          billsBudget,
          savingsBudget,
          customAllocations: allocations,
        })
        showToast('Budget period created ✓')
      }
      navigate('/budget-tracker')
    } catch (err) {
      showToast('Failed to save', 'error')
      console.error(err)
    }
    setSaving(false)
  }

  if (loadingPeriod) {
    return (
      <div className={styles.container}>
        <div className="skeleton" style={{ height: 40, borderRadius: 8, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 80, borderRadius: 8, marginBottom: 16 }} />
      </div>
    )
  }

  const isFromIncome = rawAmount > 0 && !editMode && !isCarryForward
  const activeBillsTotal = billsData.filter(b => b.isActive).reduce((s, b) => s + b.amount, 0)
  const goalsNeeded = goalsData.reduce((s, g) => s + Math.max(0, (g.targetAmount || 0) - (g.savedAmount || 0)), 0)

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        {isCarryForward ? 'New Period (Carry Forward)' : isFromIncome ? 'You received' : editMode ? 'Edit Budget Period' : 'Set Budget Period'}
      </h1>

      {isFromIncome ? (
        <div className={styles.incomeAmount}>{formatCurrency(incomeAmount)}</div>
      ) : (
        <div className={styles.totalBudgetRow}>
          <label className={styles.totalBudgetLabel}>Total budget to allocate (₱)</label>
          <input
            type="number"
            className={styles.totalBudgetInput}
            value={totalBudget || ''}
            onChange={e => handleTotalBudgetChange(e.target.value)}
            placeholder="e.g. 30000"
            inputMode="decimal"
          />
        </div>
      )}

      <p className={styles.subtitle}>
        {isFromIncome ? "Let's allocate every peso" : 'Set how much to budget for each category'}
      </p>

      {!editMode && (
        <>
          <div className={styles.periodSelect}>
            {['weekly', 'biweekly', 'monthly', 'custom'].map(p => (
              <button
                key={p}
                className={`${styles.periodPill} ${periodType === p ? styles.active : ''}`}
                onClick={() => setPeriodType(p)}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          {periodType === 'custom' && (
            <div className={styles.dateRange}>
              <div className={styles.dateField}>
                <label className={styles.dateLabel}>Start date</label>
                <input type="date" className="input-field" value={customStart} onChange={e => setCustomStart(e.target.value)} />
              </div>
              <div className={styles.dateField}>
                <label className={styles.dateLabel}>End date</label>
                <input type="date" className="input-field" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
              </div>
            </div>
          )}
        </>
      )}

      {allocations.map((alloc, i) => {
        const isBills = isBillsLabel(alloc.label)
        const isSavings = isSavingsLabel(alloc.label)
        return (
          <div key={alloc.label} className={styles.bucket}>
            <div className={styles.bucketHeader}>
              <span className={styles.bucketLabel}>{alloc.label}</span>
              {isBills && (
                <span className={styles.bucketRef}>Active bills: {formatCurrency(activeBillsTotal)}</span>
              )}
              {isSavings && (
                <span className={styles.bucketRef}>Goals need: {formatCurrency(goalsNeeded)}</span>
              )}
              {!isBills && !isSavings && incomeAmount > 0 && (
                <span className={styles.bucketRef}>{Math.round(alloc.amount / incomeAmount * 100)}% of income</span>
              )}
            </div>
            <div className={styles.sliderRow}>
              {incomeAmount > 0 && (
                <input
                  type="range"
                  className={styles.slider}
                  style={{ accentColor: BUCKET_COLORS[i % BUCKET_COLORS.length] }}
                  min="0"
                  max={incomeAmount}
                  value={alloc.amount}
                  onChange={e => updateAlloc(i, e.target.value)}
                />
              )}
              <input
                type="number"
                className={styles.amountInput}
                value={alloc.amount || ''}
                onChange={e => updateAlloc(i, e.target.value)}
                placeholder="₱0"
                inputMode="decimal"
              />
            </div>
          </div>
        )
      })}

      {incomeAmount > 0 && (
        <>
          <div className={styles.mathBar}>
            {allocations.map((alloc, i) => {
              const pct = incomeAmount > 0 ? (alloc.amount / incomeAmount) * 100 : 0
              return (
                <div
                  key={alloc.label}
                  className={styles.mathSegment}
                  style={{ width: `${pct}%`, backgroundColor: BUCKET_COLORS[i % BUCKET_COLORS.length] }}
                />
              )
            })}
          </div>
          <div className={`${styles.unallocated} ${validation.isBalanced ? styles.balanced : styles.unbalanced}`}>
            {validation.isBalanced
              ? 'Perfectly allocated ✓'
              : validation.unallocated > 0
                ? `${formatCurrency(validation.unallocated)} unallocated`
                : `${formatCurrency(validation.overAllocated)} over-allocated`
            }
          </div>
        </>
      )}

      <div className={styles.actions}>
        <button
          className="btn-primary"
          onClick={handleConfirm}
          disabled={saving || allocations.every(a => a.amount === 0)}
        >
          {saving ? 'Saving...' : editMode ? 'Update Budget' : 'Confirm Budget'}
        </button>
        <button className={styles.skipLink} onClick={() => navigate('/budget-tracker')}>
          Cancel
        </button>
      </div>
    </div>
  )
}
