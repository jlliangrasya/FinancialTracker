import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { updatePaymentRef, getUserSettings } from '../firebase/settings'
import PesoWiseLogo from '../components/PesoWiseLogo'
import styles from './PendingApproval.module.css'

export default function PendingApproval() {
  const { currentUser, logout, refreshUserProfile } = useAuth()
  const navigate = useNavigate()
  const [refNumber, setRefNumber] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('pending')

  // Poll for status changes every 10 seconds
  useEffect(() => {
    if (!currentUser) return

    async function checkStatus() {
      const settings = await getUserSettings(currentUser.uid)
      const newStatus = settings?.status
      if (newStatus === 'approved') {
        await refreshUserProfile(currentUser.uid)
        navigate('/pin')
      } else if (newStatus === 'rejected') {
        setStatus('rejected')
      }
      if (settings?.paymentReference) {
        setSubmitted(true)
        setRefNumber(settings.paymentReference)
      }
    }

    checkStatus()
    const interval = setInterval(checkStatus, 10000)
    return () => clearInterval(interval)
  }, [currentUser, navigate, refreshUserProfile])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!refNumber.trim()) {
      setError('Please enter your GCash reference number.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await updatePaymentRef(currentUser.uid, refNumber.trim())
      setSubmitted(true)
    } catch (err) {
      setError('Failed to save. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  if (status === 'rejected') {
    navigate('/rejected')
    return null
  }

  return (
    <div className={styles.container}>
      <PesoWiseLogo size={64} style={{ marginBottom: 16, borderRadius: 14, boxShadow: '0 6px 20px rgba(74,124,111,0.25)' }} />
      <h1 className={styles.title}>Account Pending</h1>

      {!submitted ? (
        <>
          <p className={styles.subtitle}>
            To activate your Peso Wise account, please send a one-time payment via GCash.
          </p>

          <div className={styles.paymentCard}>
            <div className={styles.paymentRow}>
              <span className={styles.paymentLabel}>Amount</span>
              <span className={styles.paymentValue}>₱399.00</span>
            </div>
            <div className={styles.paymentRow}>
              <span className={styles.paymentLabel}>GCash Number</span>
              <span className={styles.paymentValue}>0938-505-6299</span>
            </div>
            <div className={styles.paymentRow}>
              <span className={styles.paymentLabel}>Account Name</span>
              <span className={styles.paymentValue}>JI****N GR**CE B.</span>
            </div>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>GCash Reference Number (Last 6 Digits)</label>
              <input
                className="input-field"
                type="text"
                placeholder="e.g. 1234567890123"
                value={refNumber}
                onChange={e => setRefNumber(e.target.value)}
                maxLength={20}
              />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? <span className={styles.spinner} /> : 'Submit Payment'}
            </button>
          </form>
        </>
      ) : (
        <>
          <div className={styles.successIcon}>✓</div>
          <p className={styles.subtitle}>
            Your payment reference <strong>{refNumber}</strong> has been received.
          </p>
          <p className={styles.hint}>
            We're verifying your payment. You'll gain access once the admin approves your account.
            This page will update automatically.
          </p>
          <div className={styles.waitingBadge}>Waiting for approval...</div>
        </>
      )}

      <button className={styles.logoutBtn} onClick={handleLogout}>
        Log out
      </button>
    </div>
  )
}
