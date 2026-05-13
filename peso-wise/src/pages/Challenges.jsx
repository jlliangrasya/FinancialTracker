import { useState, useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import { getChallenges, addChallenge, updateChallenge, deleteChallenge } from '../firebase/challenges'
import { getTransactions } from '../firebase/transactions'
import { getBudgets } from '../firebase/budgets'
import { evaluateChallenge } from '../engine/challengeProgress'
import { CHALLENGE_PRESETS } from '../utils/challengePresets'
import { EXPENSE_CATEGORIES } from '../utils/categories'
import { useToast } from '../components/Toast'
import styles from './Challenges.module.css'

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

const TYPE_LABELS = {
  'no-spend': 'No-Spend',
  'save-amount': 'Save Amount',
  'streak': 'Streak',
  'under-budget': 'Under Budget',
  'custom': 'Custom',
}

export default function Challenges() {
  const [challenges, setChallenges] = useState([])
  const [transactions, setTransactions] = useState([])
  const [budgets, setBudgets] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('active')
  const [showCustomForm, setShowCustomForm] = useState(false)

  // custom form fields
  const [customName, setCustomName] = useState('')
  const [customType, setCustomType] = useState('save-amount')
  const [customTarget, setCustomTarget] = useState('')
  const [customDuration, setCustomDuration] = useState('7')
  const [customCategory, setCustomCategory] = useState('')
  const [customReward, setCustomReward] = useState('')
  const [saving, setSaving] = useState(false)

  const { currentUser } = useAuth()
  const { showToast } = useToast()

  useEffect(() => { loadData() }, [currentUser])

  async function loadData() {
    if (!currentUser) return
    setLoading(true)
    try {
      const [ch, txns, bdg] = await Promise.all([
        getChallenges(currentUser.uid),
        getTransactions(currentUser.uid),
        getBudgets(currentUser.uid),
      ])
      // auto-sweep: mark expired active challenges as failed/completed
      const updates = []
      for (const c of ch) {
        if (c.status !== 'active') continue
        const result = evaluateChallenge(c, txns, bdg)
        if (result.isComplete) updates.push(updateChallenge(c.id, { status: 'completed' }))
        else if (result.isFailed) updates.push(updateChallenge(c.id, { status: 'failed' }))
      }
      if (updates.length) {
        await Promise.all(updates)
        const refreshed = await getChallenges(currentUser.uid)
        setChallenges(refreshed)
      } else {
        setChallenges(ch)
      }
      setTransactions(txns)
      setBudgets(bdg)
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  async function handleStartPreset(preset) {
    setSaving(true)
    const today = new Date().toISOString().split('T')[0]
    try {
      await addChallenge(currentUser.uid, {
        name: preset.name,
        type: preset.type,
        isPreset: true,
        targetAmount: preset.targetAmount || 0,
        targetCategory: preset.targetCategory || '',
        allowedCategories: preset.allowedCategories || [],
        durationDays: preset.durationDays,
        startDate: today,
        endDate: addDays(today, preset.durationDays),
        rewardNote: '',
      })
      showToast(`"${preset.name}" started!`)
      setActiveTab('active')
      await loadData()
    } catch { showToast('Failed to start', 'error') }
    setSaving(false)
  }

  async function handleAddCustom(e) {
    e.preventDefault()
    if (!customName || !customDuration) return
    setSaving(true)
    const today = new Date().toISOString().split('T')[0]
    try {
      await addChallenge(currentUser.uid, {
        name: customName,
        type: customType,
        isPreset: false,
        targetAmount: Number(customTarget) || 0,
        targetCategory: customCategory || '',
        allowedCategories: [],
        durationDays: Number(customDuration),
        startDate: today,
        endDate: addDays(today, Number(customDuration)),
        rewardNote: customReward,
      })
      showToast(`"${customName}" started!`)
      setCustomName(''); setCustomType('save-amount'); setCustomTarget('')
      setCustomDuration('7'); setCustomCategory(''); setCustomReward('')
      setShowCustomForm(false)
      setActiveTab('active')
      await loadData()
    } catch { showToast('Failed to create', 'error') }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this challenge?')) return
    try { await deleteChallenge(id); await loadData(); showToast('Deleted') }
    catch { showToast('Failed to delete', 'error') }
  }

  const active = challenges.filter(c => c.status === 'active')
  const completed = challenges.filter(c => c.status === 'completed')
  const failed = challenges.filter(c => c.status === 'failed')
  const history = [...completed, ...failed]

  const activePresetIds = new Set(challenges.filter(c => c.status === 'active' && c.isPreset).map(c => c.name))

  if (loading) return (
    <div className={styles.container}>
      <h1 className={styles.title}>Challenges</h1>
      {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 10, marginBottom: 10 }} />)}
    </div>
  )

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Challenges</h1>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${activeTab === 'active' ? styles.tabActive : ''}`} onClick={() => setActiveTab('active')}>
          Active {active.length > 0 && <span className={styles.tabBadge}>{active.length}</span>}
        </button>
        <button className={`${styles.tab} ${activeTab === 'presets' ? styles.tabActive : ''}`} onClick={() => setActiveTab('presets')}>Explore</button>
        <button className={`${styles.tab} ${activeTab === 'history' ? styles.tabActive : ''}`} onClick={() => setActiveTab('history')}>History</button>
      </div>

      {/* Active Tab */}
      {activeTab === 'active' && (
        <div>
          {active.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyEmoji}>🏆</div>
              <div>No active challenges.</div>
              <button className={styles.exploreBtn} onClick={() => setActiveTab('presets')}>Browse Challenges</button>
            </div>
          ) : active.map(c => {
            const result = evaluateChallenge(c, transactions, budgets)
            return <ChallengeCard key={c.id} challenge={c} result={result} onDelete={handleDelete} />
          })}
        </div>
      )}

      {/* Explore / Presets Tab */}
      {activeTab === 'presets' && (
        <div>
          <div className={styles.presetsGrid}>
            {CHALLENGE_PRESETS.map(preset => (
              <div key={preset.id} className={styles.presetCard}>
                <div className={styles.presetEmoji}>{preset.emoji}</div>
                <div className={styles.presetName}>{preset.name}</div>
                <div className={styles.presetDesc}>{preset.description}</div>
                <div className={styles.presetMeta}>{preset.durationDays} days</div>
                <button
                  className={styles.startBtn}
                  onClick={() => handleStartPreset(preset)}
                  disabled={saving || activePresetIds.has(preset.name)}
                >
                  {activePresetIds.has(preset.name) ? 'In Progress' : 'Start'}
                </button>
              </div>
            ))}
          </div>

          <div className={styles.customSection}>
            <button className={styles.customToggle} onClick={() => setShowCustomForm(!showCustomForm)}>
              {showCustomForm ? '✕ Cancel' : '+ Create Custom Challenge'}
            </button>
            {showCustomForm && (
              <form className={styles.customForm} onSubmit={handleAddCustom}>
                <h3>Custom Challenge</h3>
                <div className={styles.formGrid}>
                  <input type="text" className="input-field" placeholder="Challenge name" value={customName} onChange={e => setCustomName(e.target.value)} required />
                  <div className={styles.formRow}>
                    <select className="select-field" value={customType} onChange={e => setCustomType(e.target.value)}>
                      <option value="save-amount">Save Amount</option>
                      <option value="no-spend">No-Spend</option>
                      <option value="streak">Savings Streak</option>
                      <option value="under-budget">Under Budget</option>
                    </select>
                    <input type="number" className="input-field" placeholder="Duration (days)" value={customDuration} onChange={e => setCustomDuration(e.target.value)} inputMode="numeric" required min="1" />
                  </div>
                  {customType === 'save-amount' && (
                    <input type="number" className="input-field" placeholder="Target amount (₱)" value={customTarget} onChange={e => setCustomTarget(e.target.value)} inputMode="decimal" />
                  )}
                  {customType === 'no-spend' && (
                    <select className="select-field" value={customCategory} onChange={e => setCustomCategory(e.target.value)}>
                      <option value="">All non-essential categories</option>
                      {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                  <input type="text" className="input-field" placeholder="Reward note (optional, e.g. 'Treat myself to...')" value={customReward} onChange={e => setCustomReward(e.target.value)} />
                  <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Starting...' : 'Start Challenge'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div>
          {history.length === 0 ? (
            <div className={styles.empty}>No completed or failed challenges yet.</div>
          ) : history.map(c => (
            <div key={c.id} className={`${styles.historyCard} ${c.status === 'completed' ? styles.completedCard : styles.failedCard}`}>
              <div className={styles.historyHeader}>
                <span className={styles.historyName}>{c.name}</span>
                <span className={`${styles.statusBadge} ${c.status === 'completed' ? styles.completedBadge : styles.failedBadge}`}>
                  {c.status === 'completed' ? 'Completed' : 'Failed'}
                </span>
              </div>
              <div className={styles.historyMeta}>
                {TYPE_LABELS[c.type]} · {c.durationDays} days
                {c.rewardNote && <span className={styles.rewardNote}> · 🎁 {c.rewardNote}</span>}
              </div>
              <button className={styles.deleteHistoryBtn} onClick={() => handleDelete(c.id)}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ChallengeCard({ challenge, result, onDelete }) {
  const daysLeft = Math.max(0, Math.ceil(
    (new Date(challenge.endDate?.seconds ? challenge.endDate.seconds * 1000 : challenge.endDate) - new Date()) / 86400000
  ))

  const barColor = result.progressPct >= 80
    ? 'var(--color-success)'
    : result.progressPct >= 40
    ? 'var(--color-warning)'
    : 'var(--color-primary)'

  return (
    <div className={styles.challengeCard}>
      <div className={styles.challengeHeader}>
        <div>
          <div className={styles.challengeType}>{TYPE_LABELS[challenge.type]}</div>
          <div className={styles.challengeName}>{challenge.name}</div>
        </div>
        <button className={styles.deleteBtn} onClick={() => onDelete(challenge.id)}>✕</button>
      </div>

      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${result.progressPct}%`, backgroundColor: barColor }} />
      </div>
      <div className={styles.progressMeta}>
        <span>{result.statusText}</span>
        <span>{result.progressPct}%</span>
      </div>

      {result.detail && <div className={styles.detailNote}>{result.detail}</div>}

      <div className={styles.challengeFooter}>
        <span className={styles.daysLeft}>{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</span>
        {challenge.rewardNote && <span className={styles.rewardNote}>🎁 {challenge.rewardNote}</span>}
      </div>
    </div>
  )
}
