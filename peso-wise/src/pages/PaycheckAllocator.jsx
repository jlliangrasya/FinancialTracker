import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getBills } from '../firebase/bills'
import { getSavingsGoals } from '../firebase/savingsGoals'
import { addBudgetPeriod, updateBudgetPeriod, getActiveBudgetPeriod } from '../firebase/budgetPeriods'
import { useToast } from '../components/Toast'
import { calculateDefaultAllocation, validateAllocation } from '../engine/paycheckAllocator'
import { formatCurrency } from '../utils/formatCurrency'
import { getCurrentMonthString } from '../utils/dateHelpers'
import styles from './PaycheckAllocator.module.css'

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
  const [billsAlloc, setBillsAlloc] = useState(0)
  const [savingsAlloc, setSavingsAlloc] = useState(0)
  const [spendingAlloc, setSpendingAlloc] = useState(0)
  const [billsData, setBillsData] = useState([])
  const [goalsData, setGoalsData] = useState([])
  const [existingPeriodId, setExistingPeriodId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loadingPeriod, setLoadingPeriod] = useState(editMode)
  const { currentUser } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const incomeAmount = totalBudget

  useEffect(() => {
    async function load() {
      if (!currentUser) return
      const [bills, goals] = await Promise.all([
        getBills(currentUser.uid),
        getSavingsGoals(currentUser.uid),
      ])
      setBillsData(bills)
      setGoalsData(goals)

      if (editMode) {
        const period = await getActiveBudgetPeriod(currentUser.uid)
        if (period) {
          setExistingPeriodId(period.id)
          const total = (period.expensesBudget || 0) + (period.billsBudget || 0) + (period.savingsBudget || 0)
          setTotalBudget(total)
          setBillsAlloc(period.billsBudget || 0)
          setSavingsAlloc(period.savingsBudget || 0)
          setSpendingAlloc(period.expensesBudget || 0)
          if (period.periodType) setPeriodType(period.periodType)
        }
        setLoadingPeriod(false)
        return
      }

      if (isCarryForward) {
        setBillsAlloc(carryBills)
        setSavingsAlloc(carrySavings)
        setSpendingAlloc(carrySpending)
      } else if (rawAmount > 0) {
        const currentMonth = getCurrentMonthString()
        const unpaidBills = bills.filter(b => b.isActive && (!b.paidMonths || !b.paidMonths.includes(currentMonth)))
        const defaults = calculateDefaultAllocation(rawAmount, unpaidBills, goals)
        setBillsAlloc(defaults.bills)
        setSavingsAlloc(defaults.savings)
        setSpendingAlloc(defaults.spending)
      }
    }
    load()
  }, [currentUser, rawAmount, editMode])

  function updateBills(val) {
    const v = Math.max(0, Number(val) || 0)
    setBillsAlloc(v)
    if (incomeAmount > 0) setSpendingAlloc(Math.max(0, incomeAmount - v - savingsAlloc))
  }

  function updateSavings(val) {
    const v = Math.max(0, Number(val) || 0)
    setSavingsAlloc(v)
    if (incomeAmount > 0) setSpendingAlloc(Math.max(0, incomeAmount - billsAlloc - v))
  }

  function updateSpending(val) {
    setSpendingAlloc(Math.max(0, Number(val) || 0))
  }

  function handleTotalBudgetChange(val) {
    const v = Math.max(0, Number(val) || 0)
    setTotalBudget(v)
    setBillsAlloc(0)
    setSavingsAlloc(0)
    setSpendingAlloc(0)
  }

  const validation = incomeAmount > 0
    ? validateAllocation(billsAlloc, savingsAlloc, spendingAlloc, incomeAmount)
    : { isBalanced: true, unallocated: 0, overAllocated: 0 }

  const billsPct = incomeAmount > 0 ? (billsAlloc / incomeAmount) * 100 : 0
  const savingsPct = incomeAmount > 0 ? (savingsAlloc / incomeAmount) * 100 : 0
  const spendingPct = incomeAmount > 0 ? (spendingAlloc / incomeAmount) * 100 : 0

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

  async function handleConfirm() {
    setSaving(true)
    try {
      if (editMode && existingPeriodId) {
        await updateBudgetPeriod(existingPeriodId, {
          periodType,
          totalBudget: billsAlloc + savingsAlloc + spendingAlloc,
          expensesBudget: spendingAlloc,
          billsBudget: billsAlloc,
          savingsBudget: savingsAlloc,
        })
        showToast('Budget updated ✓')
      } else {
        const { start, end } = getPeriodDates()
        await addBudgetPeriod(currentUser.uid, {
          periodType,
          startDate: start,
          endDate: end,
          mode: 'separate',
          totalBudget: billsAlloc + savingsAlloc + spendingAlloc,
          expensesBudget: spendingAlloc,
          billsBudget: billsAlloc,
          savingsBudget: savingsAlloc,
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

      <div className={styles.bucket}>
        <div className={styles.bucketHeader}>
          <span className={styles.bucketLabel}>Bills</span>
          <span className={styles.bucketRef}>Active bills: {formatCurrency(billsData.filter(b => b.isActive).reduce((s, b) => s + b.amount, 0))}</span>
        </div>
        <div className={styles.sliderRow}>
          {incomeAmount > 0 && (
            <input type="range" className={styles.slider} min="0" max={incomeAmount} value={billsAlloc} onChange={e => updateBills(e.target.value)} />
          )}
          <input type="number" className={styles.amountInput} value={billsAlloc || ''} onChange={e => updateBills(e.target.value)} placeholder="₱0" inputMode="decimal" />
        </div>
      </div>

      <div className={styles.bucket}>
        <div className={styles.bucketHeader}>
          <span className={styles.bucketLabel}>Savings</span>
          <span className={styles.bucketRef}>Goals need: {formatCurrency(goalsData.reduce((s, g) => s + Math.max(0, (g.targetAmount || 0) - (g.savedAmount || 0)), 0))}</span>
        </div>
        <div className={styles.sliderRow}>
          {incomeAmount > 0 && (
            <input type="range" className={styles.slider} min="0" max={incomeAmount} value={savingsAlloc} onChange={e => updateSavings(e.target.value)} />
          )}
          <input type="number" className={styles.amountInput} value={savingsAlloc || ''} onChange={e => updateSavings(e.target.value)} placeholder="₱0" inputMode="decimal" />
        </div>
      </div>

      <div className={styles.bucket}>
        <div className={styles.bucketHeader}>
          <span className={styles.bucketLabel}>Daily Expenses</span>
          <span className={styles.bucketRef}>{incomeAmount > 0 ? 'Remaining' : 'Spending budget'}</span>
        </div>
        <div className={styles.sliderRow}>
          {incomeAmount > 0 && (
            <input type="range" className={styles.slider} min="0" max={incomeAmount} value={spendingAlloc} onChange={e => updateSpending(e.target.value)} />
          )}
          <input type="number" className={styles.amountInput} value={spendingAlloc || ''} onChange={e => updateSpending(e.target.value)} placeholder="₱0" inputMode="decimal" />
        </div>
      </div>

      {incomeAmount > 0 && (
        <>
          <div className={styles.mathBar}>
            <div className={styles.mathSegment} style={{ width: `${billsPct}%`, backgroundColor: 'var(--color-warning)' }} />
            <div className={styles.mathSegment} style={{ width: `${savingsPct}%`, backgroundColor: 'var(--color-success)' }} />
            <div className={styles.mathSegment} style={{ width: `${spendingPct}%`, backgroundColor: 'var(--color-primary)' }} />
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
        <button className="btn-primary" onClick={handleConfirm} disabled={saving || (billsAlloc === 0 && savingsAlloc === 0 && spendingAlloc === 0)}>
          {saving ? 'Saving...' : editMode ? 'Update Budget' : 'Confirm Budget'}
        </button>
        <button className={styles.skipLink} onClick={() => navigate('/budget-tracker')}>
          Cancel
        </button>
      </div>
    </div>
  )
}
