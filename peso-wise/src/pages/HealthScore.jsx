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
  const [showEFModal, setShowEFModal] = useState(false)
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

  // Emergency fund calculations
  const efMonthTxns = useMemo(() => {
    return transactions.filter(t => {
      const date = t.date?.toDate ? t.date.toDate() : new Date(t.date)
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      return (months[date.getMonth()] + '-' + date.getFullYear()) === monthLabel
    })
  }, [transactions, monthLabel])
  const efMonthlyExpenses = efMonthTxns.filter(t => !t.isIncome).reduce((s, t) => s + t.amount, 0)
  const efGoal = savingsGoals.find(g => g.name?.toLowerCase().includes('emergency'))
  const efSaved = efGoal ? (efGoal.savedAmount || 0) : savingsGoals.reduce((s, g) => s + (g.savedAmount || 0), 0)
  const efTarget3 = efMonthlyExpenses * 3
  const efTarget6 = efMonthlyExpenses * 6
  const efMonthsCovered = efTarget3 > 0 ? efSaved / efMonthlyExpenses : 0
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
          <div
            key={key}
            className={`${styles.pillar} ${key === 'emergencyFund' ? styles.pillarClickable : ''}`}
            onClick={key === 'emergencyFund' ? () => setShowEFModal(true) : undefined}
          >
            <span className={styles.pillarName}>{pillarNames[key]}</span>
            <div className={styles.pillarBar}><ProgressBar value={val} max={20} showLabel={false} /></div>
            <span className={styles.pillarScore}>
              {val}/20
              {key === 'emergencyFund' && <span className={styles.pillarHint}> ℹ</span>}
            </span>
          </div>
        ))}
      </div>

      {showEFModal && (
        <div className={styles.infoOverlay} onClick={() => setShowEFModal(false)}>
          <div className={styles.infoModal} onClick={e => e.stopPropagation()}>
            <div className={styles.infoHeader}>
              <h2 className={styles.infoTitle}>🛡️ Emergency Fund</h2>
              <button className={styles.infoClose} onClick={() => setShowEFModal(false)}>✕</button>
            </div>
            <div className={styles.efModalBody}>
              <p className={styles.efDesc}>
                An emergency fund is money set aside to cover unexpected expenses — job loss, medical bills, or urgent repairs — without going into debt.
              </p>

              <div className={styles.efCalcCard}>
                <div className={styles.efCalcTitle}>How your target was calculated</div>
                <div className={styles.efCalcRow}>
                  <span>Monthly expenses ({monthLabel})</span>
                  <strong>₱{efMonthlyExpenses.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                </div>
                <div className={styles.efCalcRow}>
                  <span>× 3 months (minimum target)</span>
                  <strong>₱{efTarget3.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                </div>
                <div className={`${styles.efCalcRow} ${styles.efCalcRowAlt}`}>
                  <span>× 6 months (ideal target)</span>
                  <strong>₱{efTarget6.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                </div>
              </div>

              <div className={styles.efProgressSection}>
                <div className={styles.efProgressHeader}>
                  <span>Current savings</span>
                  <span><strong>₱{efSaved.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong> / ₱{efTarget3.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className={styles.efProgressTrack}>
                  <div
                    className={styles.efProgressFill}
                    style={{
                      width: `${Math.min(100, efTarget3 > 0 ? (efSaved / efTarget3) * 100 : 0)}%`,
                      backgroundColor: efMonthsCovered >= 3 ? 'var(--color-success)' : efMonthsCovered >= 1 ? 'var(--color-warning)' : 'var(--color-danger)'
                    }}
                  />
                </div>
                <div className={styles.efProgressLabels}>
                  <span>₱0</span>
                  <span className={styles.efMilestone} style={{ left: '50%' }}>1.5 mo</span>
                  <span>3 months</span>
                </div>
                <div className={styles.efCoverage}>
                  {efMonthlyExpenses > 0
                    ? `You can cover ${efMonthsCovered.toFixed(1)} month${efMonthsCovered !== 1 ? 's' : ''} of expenses`
                    : 'No expense data for this month yet'}
                </div>
              </div>

              {efGoal && (
                <div className={styles.efGoalNote}>
                  Linked to savings goal: <strong>{efGoal.name}</strong>
                </div>
              )}
              {!efGoal && savingsGoals.length > 0 && (
                <div className={styles.efGoalNote}>
                  Tip: Create a savings goal named "Emergency Fund" to track it separately.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
