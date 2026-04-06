import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getAllUsers } from '../firebase/settings'
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

const ADMIN_ITEM = { label: 'Admin', icon: '\u{1F6E1}\uFE0F', path: '/admin', bg: '#EDE7F6' }

export default function BottomNav({ onAddClick }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const navigate = useNavigate()
  const location = useLocation()
  const { isAdmin } = useAuth()

  useEffect(() => {
    if (!isAdmin) return
    getAllUsers()
      .then(users => setPendingCount(users.filter(u => u.status === 'pending').length))
      .catch(() => {})
  }, [isAdmin, drawerOpen])

  const drawerItems = isAdmin ? [...DRAWER_ITEMS, ADMIN_ITEM] : DRAWER_ITEMS

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
          <span className={styles.iconWrap}>
            <span className={styles.icon}>{'\u2630'}</span>
            {isAdmin && pendingCount > 0 && <span className={styles.redDot} />}
          </span>
          More
        </button>
      </nav>

      {drawerOpen && (
        <>
          <div className={styles.drawerOverlay} onClick={() => setDrawerOpen(false)} />
          <div className={styles.drawer}>
            <div className={styles.drawerHandle} />
            <div className={styles.drawerGrid}>
              {drawerItems.map(item => (
                <button
                  key={item.path}
                  className={styles.drawerItem}
                  onClick={() => handleDrawerNav(item.path)}
                >
                  <div className={styles.drawerIconWrap}>
                    <div className={styles.drawerIcon} style={{ backgroundColor: item.bg }}>
                      {item.icon}
                    </div>
                    {item.path === '/admin' && pendingCount > 0 && (
                      <span className={styles.badge}>{pendingCount}</span>
                    )}
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
