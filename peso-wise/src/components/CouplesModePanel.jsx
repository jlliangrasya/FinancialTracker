import { useState, useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import { createSharedBudget, acceptInvite, leaveSharedBudget, getSharedBudget } from '../firebase/sharedBudgets'
import { updateUserSettings } from '../firebase/settings'
import { useToast } from './Toast'
import styles from './CouplesModePanel.module.css'

export default function CouplesModePanel({ settings, onUpdated }) {
  const [tab, setTab] = useState('setup')
  const [inviteToken, setInviteToken] = useState(null)
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const { currentUser } = useAuth()
  const { showToast } = useToast()

  const isConnected = !!settings?.sharedBudgetId
  const partnerEmail = settings?.partnerEmail || null

  // If user already created a shared budget but partner hasn't joined yet,
  // fetch the invite token from Firestore so it survives page reloads.
  useEffect(() => {
    if (!settings?.sharedBudgetId || inviteToken) return
    getSharedBudget(settings.sharedBudgetId).then(doc => {
      if (doc?.inviteToken) setInviteToken(doc.inviteToken)
    }).catch(() => {})
  }, [settings?.sharedBudgetId])

  async function handleCreate() {
    setLoading(true)
    try {
      const { id, inviteToken: token } = await createSharedBudget(currentUser.uid, currentUser.email)
      await updateUserSettings(currentUser.uid, { sharedBudgetId: id })
      setInviteToken(token)
      showToast('Invite code created ✓')
      onUpdated()
    } catch (err) {
      console.error('createSharedBudget error:', err)
      showToast(err.message || 'Failed to create invite code', 'error')
    }
    setLoading(false)
  }

  async function handleJoin() {
    if (!joinCode.trim()) return
    setLoading(true)
    try {
      const sharedId = await acceptInvite(joinCode.trim().toUpperCase(), currentUser.uid, currentUser.email)
      await updateUserSettings(currentUser.uid, { sharedBudgetId: sharedId })
      showToast('Joined shared budget ✓')
      setJoinCode('')
      onUpdated()
    } catch (err) {
      console.error('acceptInvite error:', err)
      showToast(err.message || 'Invalid or expired code', 'error')
    }
    setLoading(false)
  }

  async function handleLeave() {
    if (!window.confirm('Leave the shared budget? This cannot be undone.')) return
    setLoading(true)
    try {
      await leaveSharedBudget(settings.sharedBudgetId, currentUser.uid, currentUser.email)
      await updateUserSettings(currentUser.uid, { sharedBudgetId: null, partnerEmail: null })
      setInviteToken(null)
      showToast('Left shared budget')
      onUpdated()
    } catch (err) {
      console.error('leaveSharedBudget error:', err)
      showToast('Failed to leave', 'error')
    }
    setLoading(false)
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code).then(() => showToast('Code copied!')).catch(() => {})
  }

  if (isConnected && !inviteToken) {
    return (
      <div className={styles.panel}>
        <div className={styles.connectedBadge}>Connected</div>
        {partnerEmail && <p className={styles.partnerInfo}>Partner: <strong>{partnerEmail}</strong></p>}
        <p className={styles.hint}>Your partner's transactions appear with a "Partner" badge in your transaction list.</p>
        <button className={styles.leaveBtn} onClick={handleLeave} disabled={loading}>Leave Shared Budget</button>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <div className={styles.tabRow}>
        <button className={`${styles.tabBtn} ${tab === 'setup' ? styles.tabActive : ''}`} onClick={() => setTab('setup')}>Invite Partner</button>
        <button className={`${styles.tabBtn} ${tab === 'join' ? styles.tabActive : ''}`} onClick={() => setTab('join')}>Join with Code</button>
      </div>

      {tab === 'setup' && (
        <div className={styles.tabContent}>
          <p className={styles.hint}>Generate an invite code and share it with your partner. They enter it on their account to connect.</p>
          {inviteToken ? (
            <>
              <div className={styles.codeBox}>
                <span className={styles.code}>{inviteToken}</span>
                <button className={styles.copyBtn} onClick={() => copyCode(inviteToken)}>Copy</button>
              </div>
              <p className={styles.hint} style={{ marginTop: 8 }}>Share this code with your partner. It expires once used.</p>
              {isConnected && (
                <button className={styles.leaveBtn} style={{ marginTop: 12 }} onClick={handleLeave} disabled={loading}>
                  Cancel &amp; Leave
                </button>
              )}
            </>
          ) : (
            <button className="btn-primary" onClick={handleCreate} disabled={loading}>
              {loading ? 'Creating...' : 'Generate Invite Code'}
            </button>
          )}
        </div>
      )}

      {tab === 'join' && (
        <div className={styles.tabContent}>
          <p className={styles.hint}>Enter the invite code your partner generated.</p>
          <div className={styles.joinRow}>
            <input
              type="text"
              className="input-field"
              placeholder="Enter code (e.g. A3B9XZ)"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              style={{ letterSpacing: '0.15em', fontWeight: 700 }}
            />
            <button className="btn-primary" style={{ width: 'auto', padding: '0 16px' }} onClick={handleJoin} disabled={loading || !joinCode.trim()}>
              {loading ? '...' : 'Join'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
