import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getBills } from '../firebase/bills'
import { getSavingsGoals } from '../firebase/savingsGoals'
import { addBudgetPeriod } from '../firebase/budgetPeriods'
import { useToast } from '../components/Toast'
import { calculateDefaultAllocation, validateAllocation } from '../engine/paycheckAllocator'
import { formatCurrency } from '../utils/formatCurrency'
import { getCurrentMonthString } from '../utils/dateHelpers'
import styles from './PaycheckAllocator.module.css'

export default function PaycheckAllocator() {
  const [searchParams] = useSearchParams()
  const incomeAmount = Number(searchParams.get('amount')) || 0
  const [periodType, setPeriodType] = useState('monthly')
  const [billsAlloc, setBillsAlloc] = useState(0)
  const [savingsAlloc, setSavingsAlloc] = useState(0)
  const [spendingAlloc, setSpendingAlloc] = useState(0)
  const [billsData, setBillsData] = useState([])
  const [goalsData, setGoalsData] = useState([])
  const [saving, setSaving] = useState(false)
  const { currentUser } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      if (!currentUser) return
      const [bills, goals] = await Promise.all([
        getBills(currentUser.uid),
        getSavingsGoals(currentUser.uid),
      ])
      setBillsData(bills)
      setGoalsData(goals)
      const currentMonth = getCurrentMonthString()
      const unpaidBills = bills.filter(b => b.isActive && (!b.paidMonths || !b.paidMonths.includes(currentMonth)))
      const defaults = calculateDefaultAllocation(incomeAmount, unpaidBills, goals)
      setBillsAlloc(defaults.bills)
      setSavingsAlloc(defaults.savings)
      setSpendingAlloc(defaults.spending)
    }
    load()
  }, [currentUser, incomeAmount])

  function updateBills(val) {
    const v = Math.max(0, Math.min(Number(val) || 0, incomeAmount))
    setBillsAlloc(v)
    setSpendingAlloc(Math.max(0, incomeAmount - v - savingsAlloc))
  }

  function updateSavings(val) {
    const v = Math.max(0, Math.min(Number(val) || 0, incomeAmount))
    setSavingsAlloc(v)
    setSpendingAlloc(Math.max(0, incomeAmount - billsAlloc - v))
  }

  function updateSpending(val) {
    setSpendingAlloc(Math.max(0, Number(val) || 0))
  }

  const validation = validateAllocation(billsAlloc, savingsAlloc, spendingAlloc, incomeAmount)

  function getPeriodDates() {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let end
    if (periodType === 'weekly') {
      end = new Date(start)
      end.setDate(end.getDate() + 6)
    } else if (periodType === 'biweekly') {
      end = new Date(start)
      end.setDate(end.getDate() + 13)
    } else {
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    }
    return { start, end }
  }

  async function handleConfirm() {
    setSaving(true)
    try {
      const { start, end } = getPeriodDates()
      await addBudgetPeriod(currentUser.uid, {
        periodType,
        startDate: start,
        endDate: end,
        mode: 'separate',
        totalBudget: billsAlloc + savingsAlloc + spendingAlloc,
        expensesBudget: spendingAlloc,
        billsBudget: billsAlloc,
      })
      showToast('Budget period created ✓')
      navigate('/dashboard')
    } catch (err) {
      showToast('Failed to save allocation', 'error')
      console.error(err)
    }
    setSaving(false)
  }

  const billsPct = incomeAmount > 0 ? (billsAlloc / incomeAmount) * 100 : 0
  const savingsPct = incomeAmount > 0 ? (savingsAlloc / incomeAmount) * 100 : 0
  const spendingPct = incomeAmount > 0 ? (spendingAlloc / incomeAmount) * 100 : 0

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>You received</h1>
      <div className={styles.incomeAmount}>{formatCurrency(incomeAmount)}</div>
      <p className={styles.subtitle}>Let's allocate every peso now</p>

      <div className={styles.periodSelect}>
        {['weekly', 'biweekly', 'monthly'].map(p => (
          <button
            key={p}
            className={`${styles.periodPill} ${periodType === p ? styles.active : ''}`}
            onClick={() => setPeriodType(p)}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      <div className={styles.bucket}>
        <div className={styles.bucketHeader}>
          <span className={styles.bucketLabel}>Bills</span>
          <span className={styles.bucketRef}>This period: {formatCurrency(billsData.filter(b => b.isActive).reduce((s, b) => s + b.amount, 0))}</span>
        </div>
        <div className={styles.sliderRow}>
          <input type="range" className={styles.slider} min="0" max={incomeAmount} value={billsAlloc} onChange={e => updateBills(e.target.value)} />
          <input type="number" className={styles.amountInput} value={billsAlloc || ''} onChange={e => updateBills(e.target.value)} inputMode="decimal" />
        </div>
      </div>

      <div className={styles.bucket}>
        <div className={styles.bucketHeader}>
          <span className={styles.bucketLabel}>Savings</span>
          <span className={styles.bucketRef}>Goals need: {formatCurrency(goalsData.reduce((s, g) => s + Math.max(0, (g.targetAmount || 0) - (g.savedAmount || 0)), 0))}</span>
        </div>
        <div className={styles.sliderRow}>
          <input type="range" className={styles.slider} min="0" max={incomeAmount} value={savingsAlloc} onChange={e => updateSavings(e.target.value)} />
          <input type="number" className={styles.amountInput} value={savingsAlloc || ''} onChange={e => updateSavings(e.target.value)} inputMode="decimal" />
        </div>
      </div>

      <div className={styles.bucket}>
        <div className={styles.bucketHeader}>
          <span className={styles.bucketLabel}>Spending</span>
          <span className={styles.bucketRef}>Remaining</span>
        </div>
        <div className={styles.sliderRow}>
          <input type="range" className={styles.slider} min="0" max={incomeAmount} value={spendingAlloc} onChange={e => updateSpending(e.target.value)} />
          <input type="number" className={styles.amountInput} value={spendingAlloc || ''} onChange={e => updateSpending(e.target.value)} inputMode="decimal" />
        </div>
      </div>

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

      <div className={styles.actions}>
        <button className="btn-primary" onClick={handleConfirm} disabled={saving}>
          {saving ? 'Saving...' : 'Confirm Allocation'}
        </button>
        <button className={styles.skipLink} onClick={() => navigate('/dashboard')}>
          Skip for now
        </button>
      </div>
    </div>
  )
}
