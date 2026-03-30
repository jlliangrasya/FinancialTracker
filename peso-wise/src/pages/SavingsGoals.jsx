import { useState, useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import { getSavingsGoals, addSavingsGoal, updateSavingsGoal, deleteSavingsGoal } from '../firebase/savingsGoals'
import { getUserSettings } from '../firebase/settings'
import { useToast } from '../components/Toast'
import ProgressBar from '../components/ProgressBar'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, addMonths } from '../utils/dateHelpers'
import styles from './SavingsGoals.module.css'

export default function SavingsGoals() {
  const [goals, setGoals] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [savedAmount, setSavedAmount] = useState('')
  const [goalBank, setGoalBank] = useState('')
  const [updateAmounts, setUpdateAmounts] = useState({})
  const [saving, setSaving] = useState(false)
  const { currentUser } = useAuth()
  const { showToast } = useToast()

  useEffect(() => { loadData() }, [currentUser])

  async function loadData() {
    if (!currentUser) return
    setLoading(true)
    try {
      const [g, s] = await Promise.all([getSavingsGoals(currentUser.uid), getUserSettings(currentUser.uid)])
      setGoals(g); setSettings(s)
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  const bankNames = (settings?.banks || []).map(b => b.name)

  async function handleAdd(e) {
    e.preventDefault()
    if (!name || !targetAmount) return
    setSaving(true)
    try {
      await addSavingsGoal(currentUser.uid, {
        name, targetAmount: Number(targetAmount), targetDate: targetDate || new Date().toISOString(),
        savedAmount: Number(savedAmount) || 0, bank: goalBank || bankNames[0] || '',
      })
      showToast('Goal added ✓')
      setName(''); setTargetAmount(''); setTargetDate(''); setSavedAmount(''); setShowForm(false)
      await loadData()
    } catch (err) { showToast('Failed to add goal', 'error') }
    setSaving(false)
  }

  async function handleUpdateSaved(goalId, newAmount) {
    try {
      await updateSavingsGoal(goalId, { savedAmount: Number(newAmount) })
      setUpdateAmounts(prev => ({ ...prev, [goalId]: '' }))
      showToast('Goal updated ✓')
      await loadData()
    } catch (err) { showToast('Failed to update', 'error') }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this savings goal?')) return
    try { await deleteSavingsGoal(id); await loadData(); showToast('Goal deleted') }
    catch (err) { showToast('Failed to delete', 'error') }
  }

  if (loading) {
    return <div className={styles.container}><h1 className={styles.title}>Savings Goals</h1>
      {[1,2].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 10, marginBottom: 12 }} />)}
    </div>
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Savings Goals</h1>
      <button className={styles.addBtn} onClick={() => setShowForm(!showForm)}>+ Add goal</button>
      {showForm && (
        <form className={styles.addForm} onSubmit={handleAdd}>
          <h3>New Savings Goal</h3>
          <div className={styles.formGrid}>
            <input type="text" className="input-field" placeholder="Goal name" value={name} onChange={e => setName(e.target.value)} required />
            <div className={styles.formRow}>
              <input type="number" className="input-field" placeholder="Target amount" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} inputMode="decimal" required />
              <input type="date" className="input-field" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
            </div>
            <div className={styles.formRow}>
              <input type="number" className="input-field" placeholder="Already saved" value={savedAmount} onChange={e => setSavedAmount(e.target.value)} inputMode="decimal" />
              <select className="select-field" value={goalBank} onChange={e => setGoalBank(e.target.value)}>
                <option value="">Bank</option>
                {bankNames.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Adding...' : 'Add Goal'}</button>
          </div>
        </form>
      )}
      {goals.length > 0 ? goals.map(g => {
        const pct = g.targetAmount > 0 ? Math.min(g.savedAmount / g.targetAmount, 1) : 0
        const remaining = Math.max(0, g.targetAmount - g.savedAmount)
        const target = g.targetDate?.toDate ? g.targetDate.toDate() : new Date(g.targetDate)
        const now = new Date()
        const monthsLeft = Math.max(1, (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()))
        const monthlyNeeded = remaining / monthsLeft
        const isOnTrack = g.savedAmount >= (g.targetAmount * ((now - new Date(now.getFullYear(), 0, 1)) / (target - new Date(now.getFullYear(), 0, 1))))
        return (
          <div key={g.id} className={styles.goalCard}>
            <div className={styles.goalHeader}>
              <div><div className={styles.goalName}>{g.name}</div><div className={styles.goalBank}>{g.bank}</div></div>
              <div className={styles.actions}>
                <button className={`${styles.actionBtn} ${styles.delete}`} onClick={() => handleDelete(g.id)}>Delete</button>
              </div>
            </div>
            <ProgressBar value={g.savedAmount} max={g.targetAmount} showLabel={false} />
            <div className={styles.goalValues}>{formatCurrency(g.savedAmount)} of {formatCurrency(g.targetAmount)}</div>
            <div className={styles.goalMeta}>
              <span>Target: {formatDate(g.targetDate)}</span>
              <span>{formatCurrency(monthlyNeeded)}/month needed</span>
            </div>
            <span className={`${styles.goalStatus} ${pct >= 1 ? styles.onTrack : isOnTrack ? styles.onTrack : styles.behind}`}>
              {pct >= 1 ? 'Complete ✓' : isOnTrack ? 'On track ✓' : 'Behind ⚠'}
            </span>
            <div className={styles.updateRow}>
              <input type="number" className="input-field" placeholder="New saved amount" value={updateAmounts[g.id] || ''} onChange={e => setUpdateAmounts(prev => ({ ...prev, [g.id]: e.target.value }))} inputMode="decimal" />
              <button className="btn-primary" style={{ width: 'auto' }} onClick={() => handleUpdateSaved(g.id, updateAmounts[g.id])} disabled={!updateAmounts[g.id]}>Update</button>
            </div>
          </div>
        )
      }) : (
        <div className={styles.empty}><div className={styles.emptyIcon}>🎯</div><p>You have no savings goals yet. Add your first one to start tracking.</p></div>
      )}
    </div>
  )
}
