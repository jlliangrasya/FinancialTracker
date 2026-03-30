import styles from './InsightCard.module.css'

export default function InsightCard({ type = 'info', headline, detail, tip, onClick }) {
  return (
    <div className={`${styles.card} ${styles[type]}`} onClick={onClick}>
      <div className={styles.headline}>{headline}</div>
      {detail && <div className={styles.detail}>{detail}</div>}
      {tip && <div className={styles.tip}>{tip}</div>}
    </div>
  )
}
