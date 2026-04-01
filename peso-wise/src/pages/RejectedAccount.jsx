import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import styles from './RejectedAccount.module.css'

export default function RejectedAccount() {
  const { userProfile, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className={styles.container}>
      <div className={styles.icon}>✕</div>
      <h1 className={styles.title}>Account Not Approved</h1>
      <p className={styles.subtitle}>
        Unfortunately, your account was not approved.
      </p>
      {userProfile?.rejectedReason && (
        <div className={styles.reasonCard}>
          <span className={styles.reasonLabel}>Reason</span>
          <p className={styles.reasonText}>{userProfile.rejectedReason}</p>
        </div>
      )}
      <p className={styles.hint}>
        If you believe this is a mistake, please contact us.
      </p>
      <button className={styles.logoutBtn} onClick={handleLogout}>
        Log out
      </button>
    </div>
  )
}
