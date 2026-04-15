import styles from './FinancialMood.module.css'

const MOODS = {
  great: {
    emoji: (
      <svg viewBox="0 0 48 48" width="48" height="48" fill="none">
        <circle cx="24" cy="24" r="22" fill="var(--mood-great)" opacity="0.15"/>
        <circle cx="24" cy="24" r="20" fill="var(--mood-great)" opacity="0.1"/>
        <circle cx="17" cy="20" r="2.5" fill="var(--mood-great)"/>
        <circle cx="31" cy="20" r="2.5" fill="var(--mood-great)"/>
        <path d="M15 28c0 0 3 6 9 6s9-6 9-6" stroke="var(--mood-great)" strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="12" cy="16" r="1" fill="var(--mood-great)" opacity="0.4"/>
        <circle cx="36" cy="14" r="1.5" fill="var(--mood-great)" opacity="0.3"/>
        <circle cx="38" cy="26" r="1" fill="var(--mood-great)" opacity="0.3"/>
      </svg>
    ),
    label: 'Thriving!',
    sublabel: 'Your finances are in great shape',
  },
  good: {
    emoji: (
      <svg viewBox="0 0 48 48" width="48" height="48" fill="none">
        <circle cx="24" cy="24" r="22" fill="var(--mood-good)" opacity="0.15"/>
        <circle cx="24" cy="24" r="20" fill="var(--mood-good)" opacity="0.1"/>
        <circle cx="17" cy="20" r="2.5" fill="var(--mood-good)"/>
        <circle cx="31" cy="20" r="2.5" fill="var(--mood-good)"/>
        <path d="M16 28c0 0 2.5 4.5 8 4.5s8-4.5 8-4.5" stroke="var(--mood-good)" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    ),
    label: 'Doing well',
    sublabel: 'On track with your goals',
  },
  okay: {
    emoji: (
      <svg viewBox="0 0 48 48" width="48" height="48" fill="none">
        <circle cx="24" cy="24" r="22" fill="var(--mood-okay)" opacity="0.15"/>
        <circle cx="24" cy="24" r="20" fill="var(--mood-okay)" opacity="0.1"/>
        <circle cx="17" cy="20" r="2.5" fill="var(--mood-okay)"/>
        <circle cx="31" cy="20" r="2.5" fill="var(--mood-okay)"/>
        <path d="M16 29h16" stroke="var(--mood-okay)" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    ),
    label: 'Getting by',
    sublabel: 'Keep an eye on spending',
  },
  worried: {
    emoji: (
      <svg viewBox="0 0 48 48" width="48" height="48" fill="none">
        <circle cx="24" cy="24" r="22" fill="var(--mood-worried)" opacity="0.15"/>
        <circle cx="24" cy="24" r="20" fill="var(--mood-worried)" opacity="0.1"/>
        <circle cx="17" cy="20" r="2.5" fill="var(--mood-worried)"/>
        <circle cx="31" cy="20" r="2.5" fill="var(--mood-worried)"/>
        <path d="M17 30c0 0 2-2 7-2s7 2 7 2" stroke="var(--mood-worried)" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M14 16l4 2" stroke="var(--mood-worried)" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M34 16l-4 2" stroke="var(--mood-worried)" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    label: 'A bit tight',
    sublabel: 'Time to review your budget',
  },
  stressed: {
    emoji: (
      <svg viewBox="0 0 48 48" width="48" height="48" fill="none">
        <circle cx="24" cy="24" r="22" fill="var(--mood-stressed)" opacity="0.15"/>
        <circle cx="24" cy="24" r="20" fill="var(--mood-stressed)" opacity="0.1"/>
        <circle cx="17" cy="21" r="2.5" fill="var(--mood-stressed)"/>
        <circle cx="31" cy="21" r="2.5" fill="var(--mood-stressed)"/>
        <path d="M17 32c0 0 2-4 7-4s7 4 7 4" stroke="var(--mood-stressed)" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M13 16l5 2" stroke="var(--mood-stressed)" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M35 16l-5 2" stroke="var(--mood-stressed)" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    label: 'Needs attention',
    sublabel: "Let's work on getting back on track",
  },
}

export function getFinancialMood(healthScore) {
  if (healthScore >= 80) return 'great'
  if (healthScore >= 65) return 'good'
  if (healthScore >= 45) return 'okay'
  if (healthScore >= 25) return 'worried'
  return 'stressed'
}

export default function FinancialMood({ mood = 'good', size = 'normal', showLabel = true }) {
  const data = MOODS[mood] || MOODS.okay

  return (
    <div className={`${styles.container} ${styles[size]}`}>
      <div className={styles.emoji}>
        {data.emoji}
      </div>
      {showLabel && (
        <div className={styles.labels}>
          <div className={styles.label}>{data.label}</div>
          <div className={styles.sublabel}>{data.sublabel}</div>
        </div>
      )}
    </div>
  )
}
