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
import VerseCard from '../components/VerseCard'
import { PAGE_VERSES } from '../utils/verses'
import styles from './HealthScore.module.css'

export default function HealthScore() {
  const [transactions, setTransactions] = useState([])
  const [budgets, setBudgets] = useState([])
  const [bills, setBills] = useState([])
  const [debts, setDebts] = useState([])
  const [savingsGoals, setSavingsGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInfo, setShowInfo] = useState(false)
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
      <div className={styles.titleRow}>
        <h1 className={styles.title}>Financial Health Score</h1>
        <button className={styles.infoBtn} onClick={() => setShowInfo(!showInfo)} aria-label="Score guide">?</button>
      </div>
      <VerseCard quote={PAGE_VERSES.healthScore.quote} reference={PAGE_VERSES.healthScore.reference} context="savings" />
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

      {showInfo && (
        <div className={styles.infoSection}>
          <h2 className={styles.infoTitle}>Understanding Your Score</h2>

          <div className={styles.infoCard}>
            <h3>Score Colors</h3>
            <div className={styles.legendList}>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ backgroundColor: 'var(--color-success)' }} />
                <div>
                  <strong>Green — Excellent (80–100)</strong>
                  <p>Your finances are in great shape. Keep up healthy habits.</p>
                </div>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ backgroundColor: 'var(--color-warning)' }} />
                <div>
                  <strong>Yellow — Fair (50–79)</strong>
                  <p>You're on track but there's room to improve in a few areas.</p>
                </div>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ backgroundColor: 'var(--color-danger)' }} />
                <div>
                  <strong>Red — Needs Attention (0–49)</strong>
                  <p>Some areas need immediate focus. Start with your weakest pillar.</p>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.infoCard}>
            <h3>The 5 Pillars (20 pts each)</h3>
            <div className={styles.pillarGuideList}>
              <div className={styles.pillarGuide}>
                <span className={styles.pillarGuideIcon}>💰</span>
                <div>
                  <strong>Savings Rate</strong>
                  <p>How much of your income you save each month. Aim for at least 20%.</p>
                </div>
              </div>
              <div className={styles.pillarGuide}>
                <span className={styles.pillarGuideIcon}>📊</span>
                <div>
                  <strong>Budget Adherence</strong>
                  <p>How well you stay within your set category budgets. Overspending lowers this score.</p>
                </div>
              </div>
              <div className={styles.pillarGuide}>
                <span className={styles.pillarGuideIcon}>📋</span>
                <div>
                  <strong>Bill Consistency</strong>
                  <p>Whether your bills are paid on time. Unpaid or overdue bills reduce this score.</p>
                </div>
              </div>
              <div className={styles.pillarGuide}>
                <span className={styles.pillarGuideIcon}>💳</span>
                <div>
                  <strong>Debt-to-Income</strong>
                  <p>Your total debt relative to your income. Lower debt = higher score. Aim to keep debt under 30% of income.</p>
                </div>
              </div>
              <div className={styles.pillarGuide}>
                <span className={styles.pillarGuideIcon}>🛡️</span>
                <div>
                  <strong>Emergency Fund</strong>
                  <p>Whether you have an active savings goal for emergencies. A fund covering 3–6 months of expenses is ideal.</p>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.infoCard}>
            <h3>Progress Bar Colors</h3>
            <div className={styles.legendList}>
              <div className={styles.legendItem}>
                <div className={styles.barSwatch} style={{ backgroundColor: 'var(--color-success)' }} />
                <p>High score (14–20) — Doing well in this area</p>
              </div>
              <div className={styles.legendItem}>
                <div className={styles.barSwatch} style={{ backgroundColor: 'var(--color-warning)' }} />
                <p>Mid score (7–13) — Can be improved</p>
              </div>
              <div className={styles.legendItem}>
                <div className={styles.barSwatch} style={{ backgroundColor: 'var(--color-danger)' }} />
                <p>Low score (0–6) — Needs attention</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
