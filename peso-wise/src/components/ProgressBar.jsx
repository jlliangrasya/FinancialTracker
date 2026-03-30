import styles from './ProgressBar.module.css'

export default function ProgressBar({ label, value, max, showLabel = true }) {
  const percent = max > 0 ? Math.min(value / max, 1) : 0
  const percentDisplay = (percent * 100).toFixed(0)
  const status = percent >= 1 ? 'over' : percent >= 0.8 ? 'warning' : 'ok'

  return (
    <div className={styles.container}>
      {showLabel && (
        <div className={styles.label}>
          <span className={styles.labelLeft}>{label}</span>
          <span className={styles.labelRight} style={{ color: `var(--color-${status === 'ok' ? 'success' : status === 'warning' ? 'warning' : 'danger'})` }}>
            {percentDisplay}%
          </span>
        </div>
      )}
      <div className={styles.track}>
        <div
          className={`${styles.fill} ${styles[status]}`}
          style={{ width: `${Math.min(percent * 100, 100)}%` }}
        />
      </div>
    </div>
  )
}
