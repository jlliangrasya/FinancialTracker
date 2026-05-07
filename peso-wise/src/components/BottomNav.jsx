import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getAllUsers } from '../firebase/settings'
import PesoWiseLogo from './PesoWiseLogo'
import styles from './BottomNav.module.css'

/* ── All navigation items ── */
const PRIMARY_ITEMS = [
  { label: 'Home', icon: 'home', path: '/dashboard' },
  { label: 'Tracker', icon: 'tracker', path: '/budget-tracker' },
  { label: 'Banks', icon: 'banks', path: '/banks' },
]

const DRAWER_ITEMS = [
  { label: 'Transactions', icon: 'transactions', path: '/transactions', bg: 'var(--accent-ice)' },
  { label: 'Bills', icon: 'bills', path: '/bills', bg: 'var(--color-warning-light)' },
  { label: 'Savings', icon: 'savings', path: '/savings-goals', bg: 'var(--accent-teal)' },
  { label: 'Invest', icon: 'invest', path: '/investments', bg: 'var(--accent-slate)' },
  { label: 'Debt', icon: 'debt', path: '/debt-planner', bg: 'var(--color-danger-light)' },
  { label: 'Health', icon: 'health', path: '/health-score', bg: 'var(--color-success-light)' },
  { label: 'Insights', icon: 'insights', path: '/insights', bg: 'var(--accent-sand)' },
  { label: 'Reports', icon: 'reports', path: '/reports', bg: 'var(--accent-ice)' },
  { label: 'Settings', icon: 'settings', path: '/settings', bg: 'var(--accent-fog)' },
]

const ADMIN_ITEM = { label: 'Admin', icon: 'admin', path: '/admin', bg: 'var(--accent-slate)' }

/* ── Unified icon component ── */
function NavIcon({ icon, size = 20 }) {
  const p = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
  }
  switch (icon) {
    case 'home': return <svg {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    case 'tracker': return <svg {...p}><path d="M21 12a9 9 0 1 1-9-9"/><path d="M21 3l-9 9"/></svg>
    case 'banks': return <svg {...p}><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
    case 'transactions': return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h6M7 16h8"/></svg>
    case 'bills': return <svg {...p}><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>
    case 'savings': return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg>
    case 'invest': return <svg {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
    case 'debt': return <svg {...p}><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
    case 'health': return <svg {...p}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
    case 'insights': return <svg {...p}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
    case 'reports': return <svg {...p}><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
    case 'settings': return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    case 'admin': return <svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    case 'add': return <svg {...p} strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    default: return null
  }
}

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

  const allDrawerItems = isAdmin ? [...DRAWER_ITEMS, ADMIN_ITEM] : DRAWER_ITEMS

  function handleNav(path) {
    setDrawerOpen(false)
    navigate(path)
  }

  const isActive = (path) => location.pathname === path

  return (
    <>
      {/* ── Mobile bottom nav (hidden at ≥640px) ── */}
      <nav className={styles.mobileNav}>
        <button
          className={`${styles.tab} ${isActive('/dashboard') ? styles.active : ''}`}
          onClick={() => navigate('/dashboard')}
        >
          <NavIcon icon="home" size={22} />
          Home
        </button>
        <button
          className={`${styles.tab} ${isActive('/budget-tracker') ? styles.active : ''}`}
          onClick={() => navigate('/budget-tracker')}
        >
          <NavIcon icon="tracker" size={22} />
          Tracker
        </button>
        <button className={styles.addBtn} onClick={onAddClick} aria-label="Add transaction">
          <NavIcon icon="add" size={24} />
        </button>
        <button
          className={`${styles.tab} ${isActive('/banks') ? styles.active : ''}`}
          onClick={() => navigate('/banks')}
        >
          <NavIcon icon="banks" size={22} />
          Banks
        </button>
        <button
          className={`${styles.tab} ${drawerOpen ? styles.active : ''}`}
          onClick={() => setDrawerOpen(!drawerOpen)}
        >
          <span className={styles.iconWrap}>
            <svg className={styles.navIcon} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="5" r="1.5"/>
              <circle cx="12" cy="12" r="1.5"/>
              <circle cx="12" cy="19" r="1.5"/>
            </svg>
            {isAdmin && pendingCount > 0 && <span className={styles.redDot} />}
          </span>
          More
        </button>
      </nav>

      {/* ── Mobile drawer (hidden at ≥640px) ── */}
      {drawerOpen && (
        <>
          <div className={styles.drawerOverlay} onClick={() => setDrawerOpen(false)} />
          <div className={styles.drawer}>
            <div className={styles.drawerHandle} />
            <div className={styles.drawerGrid}>
              {allDrawerItems.map(item => (
                <button
                  key={item.path}
                  className={styles.drawerItem}
                  onClick={() => handleNav(item.path)}
                >
                  <div className={styles.drawerIconWrap}>
                    <div className={styles.drawerIcon} style={{ backgroundColor: item.bg }}>
                      <NavIcon icon={item.icon} size={22} />
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

      {/* ── Sidebar nav (shown at ≥640px) ── */}
      <aside className={styles.sideNav}>
        {/* Brand */}
        <div className={styles.sideNavBrand}>
          <PesoWiseLogo size={32} />
          <span className={styles.sideNavBrandName}>PesoWise</span>
        </div>

        {/* Nav items */}
        <nav className={styles.sideNavItems}>
          {/* Primary group */}
          <div className={styles.sideNavGroup}>
            {PRIMARY_ITEMS.map(item => (
              <button
                key={item.path}
                className={`${styles.sideNavItem} ${isActive(item.path) ? styles.sideNavActive : ''}`}
                onClick={() => navigate(item.path)}
                title={item.label}
              >
                <span className={styles.sideNavIconWrap}>
                  <NavIcon icon={item.icon} size={20} />
                </span>
                <span className={styles.sideNavLabel}>{item.label}</span>
              </button>
            ))}
          </div>

          <div className={styles.sideNavDivider} />

          {/* Secondary group */}
          <div className={styles.sideNavGroup}>
            {allDrawerItems.map(item => (
              <button
                key={item.path}
                className={`${styles.sideNavItem} ${isActive(item.path) ? styles.sideNavActive : ''}`}
                onClick={() => navigate(item.path)}
                title={item.label}
              >
                <span className={styles.sideNavIconWrap}>
                  {item.path === '/admin' && pendingCount > 0
                    ? <span className={styles.sideNavBadgeWrap}><NavIcon icon={item.icon} size={20} /><span className={styles.sideNavBadge}>{pendingCount}</span></span>
                    : <NavIcon icon={item.icon} size={20} />
                  }
                </span>
                <span className={styles.sideNavLabel}>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Add button at bottom */}
        <div className={styles.sideNavFooter}>
          <button className={styles.sideNavAddBtn} onClick={onAddClick} title="Add Transaction">
            <span className={styles.sideNavIconWrap}>
              <NavIcon icon="add" size={18} />
            </span>
            <span className={styles.sideNavLabel}>Add</span>
          </button>
        </div>
      </aside>
    </>
  )
}
