import { formatCurrency } from '../utils/formatCurrency'
import styles from './BankCard.module.css'

export default function BankCard({ name, balance, color, lowBalanceThreshold = 1000, onClick, hidden }) {
  const status = balance < 0 ? 'negative' : balance < lowBalanceThreshold ? 'low' : 'positive'
  const statusText = balance < 0 ? 'Negative' : balance < lowBalanceThreshold ? 'Low balance' : 'OK'
  const statusIcon = balance < 0 ? '\u26D4' : balance < lowBalanceThreshold ? '\u26A0' : '\u2713'

  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.colorBar} style={{ backgroundColor: color || 'var(--color-primary)' }} />
      <div className={styles.name}>{name}</div>
      <div className={`${styles.balance} ${styles[status]}`}>
        {hidden ? '••••••' : formatCurrency(balance)}
      </div>
      {!hidden && (
        <div className={styles.status} style={{
          color: status === 'negative' ? 'var(--color-danger)' :
                 status === 'low' ? 'var(--color-warning)' : 'var(--color-success)'
        }}>
          {statusIcon} {statusText}
        </div>
      )}
    </div>
  )
}
