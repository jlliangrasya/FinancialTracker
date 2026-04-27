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
import { formatDate } from '../utils/dateHelpers'
import VerseCard from '../components/VerseCard'
import { getSavingsVerse } from '../utils/verses'
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
  const [efBank, setEfBank] = useState('')
  const [efLinked, setEfLinked] = useState(false)
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

  // Suggested emergency fund = 3× average monthly expenses over last 3 months
  const suggestedEFTarget = useMemo(() => {
    if (!transactions.length) return 0
    const now = new Date()
    let total = 0
    let months = 0
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthStr = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()] + '-' + d.getFullYear()
      const spent = transactions
        .filter(t => {
          if (t.isIncome) return false
          const td = t.date?.toDate ? t.date.toDate() : new Date(t.date)
          const tStr = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][td.getMonth()] + '-' + td.getFullYear()
          return tStr === monthStr
        })
        .reduce((s, t) => s + t.amount, 0)
      if (spent > 0) { total += spent; months++ }
    }
    if (!months) return 0
    return Math.ceil((total / months) * 3)
  }, [transactions])

  const hasEmergencyFund = goals.some(g => g.name?.toLowerCase().includes('emergency'))

  async function handleAdd(e) {
    e.preventDefault()
    if (!name) return
    setSaving(true)
    try {
      await addSavingsGoal(currentUser.uid, {
        name,
        targetAmount: targetAmount ? Number(targetAmount) : null,
        targetDate: targetDate || null,
        savedAmount: Number(savedAmount) || 0,
        bank: goalBank || bankNames[0] || '',
        linkedBank: linkedBank && !!goalBank,
      })
      showToast('Goal added ✓')
      setName(''); setTargetAmount(''); setTargetDate(''); setSavedAmount(''); setLinkedBank(false); setShowForm(false)
      await loadData()
    } catch (err) { showToast('Failed to add goal', 'error') }
    setSaving(false)
  }

  async function handleCreateEmergencyFund() {
    setSaving(true)
    try {
      await addSavingsGoal(currentUser.uid, {
        name: 'Emergency Fund',
        targetAmount: null,
        targetDate: null,
        savedAmount: 0,
        bank: efBank || '',
        linkedBank: efLinked && !!efBank,
      })
      showToast('Emergency Fund created ✓')
      setEfBank(''); setEfLinked(false)
      await loadData()
    } catch (err) { showToast('Failed to create', 'error') }
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
      {(() => { const v = getSavingsVerse(); return <VerseCard quote={v.quote} reference={v.reference} context="savings" /> })()}
      {/* Emergency Fund prompt if not yet created */}
      {!hasEmergencyFund && (
        <div className={styles.efBanner}>
          <div className={styles.efBannerText}>
            <span className={styles.efBannerIcon}>🛡️</span>
            <div>
              <div className={styles.efBannerTitle}>No Emergency Fund yet</div>
              <div className={styles.efBannerSub}>
                Aim for 3 months of expenses.
                {suggestedEFTarget > 0 && <> Suggested: <strong>{formatCurrency(suggestedEFTarget)}</strong></>}
              </div>
            </div>
          </div>
          <div className={styles.efBannerActions}>
            <div className={styles.efBankField}>
              <span className={styles.efBankLabel}>Link to bank <span className={styles.efOptional}>(optional)</span></span>
              <select className={styles.efSelect} value={efBank} onChange={e => { setEfBank(e.target.value); setEfLinked(false) }}>
                <option value="">None</option>
                {bankNames.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            {efBank && (
              <label className={styles.efLinkToggle}>
                <input type="checkbox" checked={efLinked} onChange={e => setEfLinked(e.target.checked)} />
                <span>Auto-sync balance</span>
              </label>
            )}
            <button className={styles.efCreateBtn} onClick={handleCreateEmergencyFund} disabled={saving}>
              {saving ? '...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      <button className={styles.addBtn} onClick={() => setShowForm(!showForm)}>+ Add goal</button>
      {showForm && (
        <form className={styles.addForm} onSubmit={handleAdd}>
          <h3>New Savings Goal</h3>
          <div className={styles.formGrid}>
            <input type="text" className="input-field" placeholder="Goal name" value={name} onChange={e => setName(e.target.value)} required />
            <div className={styles.formRow}>
              <input type="number" className="input-field" placeholder="Target amount (optional)" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} inputMode="decimal" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                <input type="date" className="input-field" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-hint)', paddingLeft: 2 }}>Deadline (optional)</span>
              </div>
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
                <span>Link to bank balance (auto-sync)</span>
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
        const hasTarget = g.targetAmount > 0
        const hasDeadline = !!g.targetDate
        const pct = hasTarget ? Math.min(effectiveSaved / g.targetAmount, 1) : null
        const isEF = g.name?.toLowerCase().includes('emergency')
        const createdAt = g.createdAt?.toDate ? g.createdAt.toDate() : g.createdAt ? new Date(g.createdAt) : null

        // Monthly needed — only if both target and deadline exist
        let monthlyNeeded = null
        if (hasTarget && hasDeadline) {
          const target = g.targetDate?.toDate ? g.targetDate.toDate() : new Date(g.targetDate)
          const now = new Date()
          const monthsLeft = Math.max(1, (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()))
          monthlyNeeded = Math.max(0, g.targetAmount - effectiveSaved) / monthsLeft
        }

        // On-track only computable when both target and deadline exist
        let onTrackStatus = null
        if (hasTarget && hasDeadline) {
          const target = g.targetDate?.toDate ? g.targetDate.toDate() : new Date(g.targetDate)
          const now = new Date()
          const isOnTrack = effectiveSaved >= (g.targetAmount * ((now - new Date(now.getFullYear(), 0, 1)) / (target - new Date(now.getFullYear(), 0, 1))))
          onTrackStatus = pct >= 1 ? 'complete' : isOnTrack ? 'ontrack' : 'behind'
        }

        return (
          <div key={g.id} className={`${styles.goalCard} ${isEF ? styles.efCard : ''}`}>
            <div className={styles.goalHeader}>
              <div>
                <div className={styles.goalName}>
                  {isEF && <span style={{ marginRight: 6 }}>🛡️</span>}{g.name}
                </div>
                <div className={styles.goalBank}>
                  {g.bank}{g.linkedBank ? ' (linked)' : ''}
                </div>
              </div>
              <div className={styles.actions}>
                {g.linkedBank && (
                  <button className={styles.actionBtn} onClick={async () => { await updateSavingsGoal(g.id, { linkedBank: false }); showToast('Bank unlinked'); await loadData() }}>Unlink</button>
                )}
                {!g.linkedBank && g.bank && (
                  <button className={styles.actionBtn} onClick={async () => { await updateSavingsGoal(g.id, { linkedBank: true }); showToast('Bank linked — auto-syncs with balance'); await loadData() }}>Link</button>
                )}
                <button className={`${styles.actionBtn} ${styles.delete}`} onClick={() => handleDelete(g.id)}>Delete</button>
              </div>
            </div>

            {hasTarget
              ? <ProgressBar value={effectiveSaved} max={g.targetAmount} showLabel={false} />
              : <div className={styles.noTargetBar} />
            }

            <div className={styles.goalValues}>
              {formatCurrency(effectiveSaved)} saved
              {hasTarget && <span style={{ color: 'var(--color-text-hint)' }}> of {formatCurrency(g.targetAmount)}</span>}
              {isEF && !hasTarget && suggestedEFTarget > 0 && (
                <span className={styles.efSuggested}> · suggested {formatCurrency(suggestedEFTarget)}</span>
              )}
            </div>

            {g.linkedBank && <div className={styles.linkedNote}>Auto-synced from {g.bank} balance</div>}

            <div className={styles.goalMeta}>
              {hasDeadline && <span>Deadline: {formatDate(g.targetDate)}</span>}
              {monthlyNeeded !== null && <span>{formatCurrency(monthlyNeeded)}/month needed</span>}
              {createdAt && <span>Started {createdAt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
            </div>

            {onTrackStatus && (
              <span className={`${styles.goalStatus} ${onTrackStatus === 'behind' ? styles.behind : styles.onTrack}`}>
                {onTrackStatus === 'complete' ? 'Complete ✓' : onTrackStatus === 'ontrack' ? 'On track ✓' : 'Behind ⚠'}
              </span>
            )}

            {!g.linkedBank && (
              <div className={styles.updateRow}>
                <input type="number" className="input-field" placeholder="New saved amount" value={updateAmounts[g.id] || ''} onChange={e => setUpdateAmounts(prev => ({ ...prev, [g.id]: e.target.value }))} inputMode="decimal" />
                <button className="btn-primary" style={{ width: 'auto' }} onClick={() => handleUpdateSaved(g.id, updateAmounts[g.id])} disabled={!updateAmounts[g.id]}>Update</button>
              </div>
            )}
          </div>
        )
      }) : (
        <div className={styles.empty}><div className={styles.emptyIcon}>🎯</div><p>No savings goals yet. Create your Emergency Fund above or add a custom goal.</p></div>
      )}
    </div>
  )
}
