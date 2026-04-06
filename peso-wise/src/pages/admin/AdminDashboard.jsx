import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllUsers, approveUser, rejectUser } from '../../firebase/settings'
import styles from './AdminDashboard.module.css'

const STATUS_TABS = ['pending', 'approved', 'rejected']

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [activeTab, setActiveTab] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  async function loadUsers() {
    setLoading(true)
    try {
      const all = await getAllUsers()
      setUsers(all)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const filtered = users.filter(u => {
    // Users without a status field are legacy (pre-feature) — show as approved
    const status = u.status || 'approved'
    return status === activeTab
  })

  async function handleApprove(userId) {
    setActionLoading(userId)
    try {
      await approveUser(userId)
      await loadUsers()
    } finally {
      setActionLoading(null)
    }
  }

  async function handleRejectConfirm() {
    if (!rejectTarget) return
    setActionLoading(rejectTarget)
    try {
      await rejectUser(rejectTarget, rejectReason.trim())
      setRejectTarget(null)
      setRejectReason('')
      await loadUsers()
    } finally {
      setActionLoading(null)
    }
  }

  function formatDate(ts) {
    if (!ts) return '—'
    const date = ts.toDate ? ts.toDate() : new Date(ts)
    return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const counts = {
    pending: users.filter(u => (u.status || 'approved') === 'pending').length,
    approved: users.filter(u => (u.status || 'approved') === 'approved').length,
    rejected: users.filter(u => (u.status || 'approved') === 'rejected').length,
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/dashboard')}>
          ← Back
        </button>
        <h1 className={styles.title}>User Management</h1>
      </div>

      <div className={styles.tabs}>
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {counts[tab] > 0 && (
              <span className={`${styles.badge} ${tab === 'pending' ? styles.badgePending : tab === 'rejected' ? styles.badgeRejected : styles.badgeApproved}`}>
                {counts[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.loading}>
          <div className="skeleton" style={{ width: 48, height: 48, borderRadius: '50%' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>No {activeTab} users.</div>
      ) : (
        <div className={styles.list}>
          {filtered.map(user => (
            <div key={user.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.avatar}>
                  {(user.email || user.id).slice(0, 2).toUpperCase()}
                </div>
                <div className={styles.cardInfo}>
                  <p className={styles.email}>{user.email || 'No email'}</p>
                  <p className={styles.date}>Joined {formatDate(user.createdAt)}</p>
                  {user.role === 'superadmin' && <span className={styles.adminBadge}>Admin</span>}
                </div>
              </div>

              {user.paymentReference && (
                <div className={styles.refRow}>
                  <span className={styles.refLabel}>GCash Ref</span>
                  <span className={styles.refValue}>{user.paymentReference}</span>
                </div>
              )}

              {user.status === 'rejected' && user.rejectedReason && (
                <div className={styles.rejectedReason}>
                  <span className={styles.refLabel}>Reason</span>
                  <p className={styles.refValue}>{user.rejectedReason}</p>
                </div>
              )}

              {user.status === 'pending' && (
                <div className={styles.actions}>
                  <button
                    className={`${styles.actionBtn} ${styles.approveBtn}`}
                    disabled={actionLoading === user.id}
                    onClick={() => handleApprove(user.id)}
                  >
                    {actionLoading === user.id ? '...' : 'Approve'}
                  </button>
                  <button
                    className={`${styles.actionBtn} ${styles.rejectBtn}`}
                    disabled={actionLoading === user.id}
                    onClick={() => { setRejectTarget(user.id); setRejectReason('') }}
                  >
                    Reject
                  </button>
                </div>
              )}

              {user.status === 'approved' && (
                <div className={styles.actions}>
                  <button
                    className={`${styles.actionBtn} ${styles.rejectBtn}`}
                    disabled={actionLoading === user.id}
                    onClick={() => { setRejectTarget(user.id); setRejectReason('') }}
                  >
                    Revoke Access
                  </button>
                </div>
              )}

              {user.status === 'rejected' && (
                <div className={styles.actions}>
                  <button
                    className={`${styles.actionBtn} ${styles.approveBtn}`}
                    disabled={actionLoading === user.id}
                    onClick={() => handleApprove(user.id)}
                  >
                    {actionLoading === user.id ? '...' : 'Re-approve'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {rejectTarget && (
        <>
          <div className={styles.overlay} onClick={() => setRejectTarget(null)} />
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Reject / Revoke Access</h2>
            <p className={styles.modalSub}>Optionally provide a reason for the user.</p>
            <textarea
              className={styles.reasonInput}
              placeholder="Reason (optional)"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
            />
            <div className={styles.modalActions}>
              <button className={`${styles.actionBtn} ${styles.rejectBtn}`} onClick={handleRejectConfirm} disabled={!!actionLoading}>
                {actionLoading ? '...' : 'Confirm'}
              </button>
              <button className={`${styles.actionBtn} ${styles.cancelBtn}`} onClick={() => setRejectTarget(null)}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
