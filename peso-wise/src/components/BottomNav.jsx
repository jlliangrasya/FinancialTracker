import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import styles from './BottomNav.module.css'

const DRAWER_ITEMS = [
  { label: 'Bills', icon: '\u{1F4CB}', path: '/bills', bg: '#FFF3E0' },
  { label: 'Savings', icon: '\u{1F3AF}', path: '/savings-goals', bg: '#E8F5E9' },
  { label: 'Invest', icon: '\u{1F4C8}', path: '/investments', bg: '#E3F2FD' },
  { label: 'Debt', icon: '\u{1F4B3}', path: '/debt-planner', bg: '#FCE4EC' },
  { label: 'Health', icon: '\u2764\uFE0F', path: '/health-score', bg: '#FFEBEE' },
  { label: 'Insights', icon: '\u{1F4A1}', path: '/insights', bg: '#FFF8E1' },
  { label: 'Reports', icon: '\u{1F4CA}', path: '/reports', bg: '#F3E5F5' },
  { label: 'Settings', icon: '\u2699\uFE0F', path: '/settings', bg: '#ECEFF1' },
]

export default function BottomNav({ onAddClick }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  function handleDrawerNav(path) {
    setDrawerOpen(false)
    navigate(path)
  }

  return (
    <>
      <nav className={styles.nav}>
        <button
          className={`${styles.tab} ${location.pathname === '/dashboard' ? styles.active : ''}`}
          onClick={() => navigate('/dashboard')}
        >
          <span className={styles.icon}>{'\u{1F3E0}'}</span>
          Home
        </button>
        <button
          className={`${styles.tab} ${location.pathname === '/budget-tracker' ? styles.active : ''}`}
          onClick={() => navigate('/budget-tracker')}
        >
          <span className={styles.icon}>{'\u{1F4CA}'}</span>
          Tracker
        </button>
        <button className={styles.addBtn} onClick={onAddClick}>
          +
        </button>
        <button
          className={`${styles.tab} ${location.pathname === '/banks' ? styles.active : ''}`}
          onClick={() => navigate('/banks')}
        >
          <span className={styles.icon}>{'\u{1F3E6}'}</span>
          Banks
        </button>
        <button
          className={`${styles.tab} ${drawerOpen ? styles.active : ''}`}
          onClick={() => setDrawerOpen(!drawerOpen)}
        >
          <span className={styles.icon}>{'\u2630'}</span>
          More
        </button>
      </nav>

      {drawerOpen && (
        <>
          <div className={styles.drawerOverlay} onClick={() => setDrawerOpen(false)} />
          <div className={styles.drawer}>
            <div className={styles.drawerHandle} />
            <div className={styles.drawerGrid}>
              {DRAWER_ITEMS.map(item => (
                <button
                  key={item.path}
                  className={styles.drawerItem}
                  onClick={() => handleDrawerNav(item.path)}
                >
                  <div className={styles.drawerIcon} style={{ backgroundColor: item.bg }}>
                    {item.icon}
                  </div>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}
