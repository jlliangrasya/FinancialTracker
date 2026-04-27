import styles from './VerseCard.module.css'

export default function VerseCard({ quote, reference, context = 'default' }) {
  return (
    <div className={`${styles.card} ${styles[context]}`}>
      <svg className={styles.quoteIcon} width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11 7H7C5.9 7 5 7.9 5 9v4c0 1.1.9 2 2 2h2v2l3-3V9c0-1.1-.9-2-2-2zm8 0h-4c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h2v2l3-3V9c0-1.1-.9-2-2-2z"/>
      </svg>
      <span className={styles.quote}>{quote}</span>
      <span className={styles.reference}>{reference}</span>
    </div>
  )
}
