import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../auth/AuthContext'
import { getTransactions } from '../firebase/transactions'
import { getBudgets } from '../firebase/budgets'
import { getBills } from '../firebase/bills'
import { getDebts } from '../firebase/debts'
import { getSavingsGoals } from '../firebase/savingsGoals'
import { calculateHealthScore, getScoreColor } from '../engine/healthScore'
import { getMonthLabel } from '../utils/dateHelpers'
import ProgressBar from '../components/ProgressBar'
import styles from './HealthScore.module.css'

export default function HealthScore() {
  const [transactions, setTransactions] = useState([])
  const [budgets, setBudgets] = useState([])
  const [bills, setBills] = useState([])
  const [debts, setDebts] = useState([])
  const [savingsGoals, setSavingsGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const { currentUser } = useAuth()
  const monthLabel = getMonthLabel()

  useEffect(() => {
    async function load() {
      if (!currentUser) return
      setLoading(true)
      try {
        const [t, b, bl, d, sg] = await Promise.all([
          getTransactions(currentUser.uid), getBudgets(currentUser.uid),
          getBills(currentUser.uid), getDebts(currentUser.uid), getSavingsGoals(currentUser.uid),
        ])
        setTransactions(t); setBudgets(b); setBills(bl); setDebts(d); setSavingsGoals(sg)
      } catch (err) { console.error(err) }
      setLoading(false)
    }
    load()
  }, [currentUser])

  const score = useMemo(
    () => calculateHealthScore({ transactions, budgets, bills, debts, savingsGoals, monthLabel }),
    [transactions, budgets, bills, debts, savingsGoals, monthLabel]
  )

  const colorName = getScoreColor(score.total)
  const color = colorName === 'success' ? 'var(--color-success)' : colorName === 'warning' ? 'var(--color-warning)' : 'var(--color-danger)'

  const pillarNames = {
    savingsRate: 'Savings Rate',
    budgetAdherence: 'Budget Adherence',
    billConsistency: 'Bill Consistency',
    debtToIncome: 'Debt-to-Income',
    emergencyFund: 'Emergency Fund',
  }

  const weakest = Object.entries(score.pillars).reduce((min, [k, v]) => v < min.v ? { k, v } : min, { k: '', v: 21 })
  const tips = {
    savingsRate: 'Try to save at least 20% of your income each month.',
    budgetAdherence: 'Review categories where you overspend and adjust limits.',
    billConsistency: 'Pay your bills on time. Set reminders for due dates.',
    debtToIncome: 'Focus on paying down high-interest debt first.',
    emergencyFund: 'Build an emergency fund covering at least 3 months of expenses.',
  }

  if (loading) return <div className={styles.container}><h1 className={styles.title}>Financial Health Score</h1><div className="skeleton" style={{ width: 140, height: 140, borderRadius: '50%', margin: '0 auto 16px' }} /></div>

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Financial Health Score</h1>
      <div className={styles.gauge}>
        <div className={styles.scoreCircle} style={{ borderColor: color }}>
          <div className={styles.scoreNumber} style={{ color }}>{score.total}</div>
          <div className={styles.scoreLabel} style={{ color }}>{score.label}</div>
        </div>
      </div>
      <div className={styles.topInsight}>
        Your weakest pillar is <strong>{pillarNames[weakest.k]}</strong>. {tips[weakest.k]}
      </div>
      <div className={styles.pillars}>
        {Object.entries(score.pillars).map(([key, val]) => (
          <div key={key} className={styles.pillar}>
            <span className={styles.pillarName}>{pillarNames[key]}</span>
            <div className={styles.pillarBar}><ProgressBar value={val} max={20} showLabel={false} /></div>
            <span className={styles.pillarScore}>{val}/20</span>
          </div>
        ))}
      </div>
    </div>
  )
}
