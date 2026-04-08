import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../auth/AuthContext'
import { getSavingsGoals, addSavingsGoal, updateSavingsGoal, deleteSavingsGoal } from '../firebase/savingsGoals'
import { getUserSettings } from '../firebase/settings'
import { getTransactions } from '../firebase/transactions'
import { getTransfers } from '../firebase/transfers'
import { calculateBankBalance } from '../engine/bankBalance'
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
  const [linkedBank, setLinkedBank] = useState(false)
  const [updateAmounts, setUpdateAmounts] = useState({})
  const [saving, setSaving] = useState(false)
  const [transactions, setTransactions] = useState([])
  const [transfers, setTransfers] = useState([])
  const { currentUser } = useAuth()
  const { showToast } = useToast()

  useEffect(() => { loadData() }, [currentUser])

  async function loadData() {
    if (!currentUser) return
    setLoading(true)
    try {
      const [g, s, txns, xfers] = await Promise.all([
        getSavingsGoals(currentUser.uid),
        getUserSettings(currentUser.uid),
        getTransactions(currentUser.uid),
        getTransfers(currentUser.uid),
      ])
      setGoals(g); setSettings(s); setTransactions(txns); setTransfers(xfers)
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  // Compute bank balances for linked goals
  const bankBalanceMap = useMemo(() => {
    const banks = settings?.banks || []
    const map = {}
    banks.forEach(b => {
      map[b.name] = calculateBankBalance(b.name, b.openingBalance, transactions, transfers)
    })
    return map
  }, [settings, transactions, transfers])

  // Resolve savedAmount: use bank balance if linked, otherwise stored value
  function getEffectiveSaved(goal) {
    if (goal.linkedBank && goal.bank && bankBalanceMap[goal.bank] !== undefined) {
      return Math.max(0, bankBalanceMap[goal.bank])
    }
    return goal.savedAmount || 0
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
        linkedBank: linkedBank && !!goalBank,
      })
      showToast('Goal added ✓')
      setName(''); setTargetAmount(''); setTargetDate(''); setSavedAmount(''); setLinkedBank(false); setShowForm(false)
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
              {!linkedBank && (
                <input type="number" className="input-field" placeholder="Already saved" value={savedAmount} onChange={e => setSavedAmount(e.target.value)} inputMode="decimal" />
              )}
              <select className="select-field" value={goalBank} onChange={e => setGoalBank(e.target.value)}>
                <option value="">Bank (optional)</option>
                {bankNames.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            {goalBank && (
              <label className={styles.linkToggle}>
                <input type="checkbox" checked={linkedBank} onChange={e => setLinkedBank(e.target.checked)} />
                <span>Link to bank balance</span>
                <span className={styles.linkHint}>
                  {linkedBank ? 'Saved amount = bank balance (auto-synced)' : 'Bank is just a label'}
                </span>
              </label>
            )}
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Adding...' : 'Add Goal'}</button>
          </div>
        </form>
      )}
      {goals.length > 0 ? goals.map(g => {
        const effectiveSaved = getEffectiveSaved(g)
        const pct = g.targetAmount > 0 ? Math.min(effectiveSaved / g.targetAmount, 1) : 0
        const remaining = Math.max(0, g.targetAmount - effectiveSaved)
        const target = g.targetDate?.toDate ? g.targetDate.toDate() : new Date(g.targetDate)
        const now = new Date()
        const monthsLeft = Math.max(1, (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()))
        const monthlyNeeded = remaining / monthsLeft
        const isOnTrack = effectiveSaved >= (g.targetAmount * ((now - new Date(now.getFullYear(), 0, 1)) / (target - new Date(now.getFullYear(), 0, 1))))
        return (
          <div key={g.id} className={styles.goalCard}>
            <div className={styles.goalHeader}>
              <div>
                <div className={styles.goalName}>{g.name}</div>
                <div className={styles.goalBank}>
                  {g.bank}{g.linkedBank ? ' (linked)' : ''}
                </div>
              </div>
              <div className={styles.actions}>
                {g.linkedBank && (
                  <button
                    className={styles.actionBtn}
                    onClick={async () => {
                      await updateSavingsGoal(g.id, { linkedBank: false })
                      showToast('Bank unlinked — switch to manual tracking')
                      await loadData()
                    }}
                  >Unlink</button>
                )}
                {!g.linkedBank && g.bank && (
                  <button
                    className={styles.actionBtn}
                    onClick={async () => {
                      await updateSavingsGoal(g.id, { linkedBank: true })
                      showToast('Bank linked — saved amount auto-syncs with balance')
                      await loadData()
                    }}
                  >Link</button>
                )}
                <button className={`${styles.actionBtn} ${styles.delete}`} onClick={() => handleDelete(g.id)}>Delete</button>
              </div>
            </div>
            <ProgressBar value={effectiveSaved} max={g.targetAmount} showLabel={false} />
            <div className={styles.goalValues}>{formatCurrency(effectiveSaved)} of {formatCurrency(g.targetAmount)}</div>
            {g.linkedBank && (
              <div className={styles.linkedNote}>Auto-synced from {g.bank} balance</div>
            )}
            <div className={styles.goalMeta}>
              <span>Target: {formatDate(g.targetDate)}</span>
              <span>{formatCurrency(monthlyNeeded)}/month needed</span>
            </div>
            <span className={`${styles.goalStatus} ${pct >= 1 ? styles.onTrack : isOnTrack ? styles.onTrack : styles.behind}`}>
              {pct >= 1 ? 'Complete ✓' : isOnTrack ? 'On track ✓' : 'Behind ⚠'}
            </span>
            {!g.linkedBank && (
              <div className={styles.updateRow}>
                <input type="number" className="input-field" placeholder="New saved amount" value={updateAmounts[g.id] || ''} onChange={e => setUpdateAmounts(prev => ({ ...prev, [g.id]: e.target.value }))} inputMode="decimal" />
                <button className="btn-primary" style={{ width: 'auto' }} onClick={() => handleUpdateSaved(g.id, updateAmounts[g.id])} disabled={!updateAmounts[g.id]}>Update</button>
              </div>
            )}
          </div>
        )
      }) : (
        <div className={styles.empty}><div className={styles.emptyIcon}>🎯</div><p>You have no savings goals yet. Add your first one to start tracking.</p></div>
      )}
    </div>
  )
}
