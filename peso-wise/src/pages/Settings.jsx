import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { usePin } from '../auth/PinContext'
import { getUserSettings, updateUserSettings } from '../firebase/settings'
import { getTransactions } from '../firebase/transactions'
import { getTransfers } from '../firebase/transfers'
import { getBills } from '../firebase/bills'
import { useToast } from '../components/Toast'
import { clearPin } from '../utils/hashPin'
import { formatCurrency } from '../utils/formatCurrency'
import { exportToCSV, exportToJSON } from '../utils/exportData'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../utils/categories'
import styles from './Settings.module.css'

export default function Settings() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [newBankName, setNewBankName] = useState('')
  const [newExpCat, setNewExpCat] = useState('')
  const [newIncCat, setNewIncCat] = useState('')
  const [lowAlert, setLowAlert] = useState('')
  const [installPrompt, setInstallPrompt] = useState(null)
  const [appInstalled, setAppInstalled] = useState(false)
  const { currentUser, logout } = useAuth()
  const { resetPinVerified } = usePin()
  const { showToast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e) }
    const installed = () => setAppInstalled(true)
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installed)
    if (window.matchMedia('(display-mode: standalone)').matches) setAppInstalled(true)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installed)
    }
  }, [])

  useEffect(() => { loadData() }, [currentUser])
  async function loadData() {
    if (!currentUser) return; setLoading(true)
    try {
      const s = await getUserSettings(currentUser.uid)
      setSettings(s)
      setLowAlert(String(s?.lowBalanceAlert || 1000))
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  async function handleSignOut() {
    if (currentUser) clearPin(currentUser.uid)
    resetPinVerified()
    await logout()
    navigate('/login')
  }

  async function addBank() {
    if (!newBankName.trim() || !settings) return
    const banks = [...(settings.banks || []), { name: newBankName.trim(), openingBalance: 0, color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6,'0') }]
    await updateUserSettings(currentUser.uid, { banks })
    setNewBankName('')
    showToast('Bank added ✓')
    await loadData()
  }

  async function updateBankBalance(index, value) {
    const banks = [...settings.banks]
    banks[index] = { ...banks[index], openingBalance: Number(value) || 0 }
    await updateUserSettings(currentUser.uid, { banks })
    await loadData()
  }

  async function addCustomExpenseCategory() {
    if (!newExpCat.trim() || !settings) return
    const cats = [...(settings.customExpenseCategories || []), newExpCat.trim()]
    await updateUserSettings(currentUser.uid, { customExpenseCategories: cats })
    setNewExpCat(''); showToast('Category added ✓'); await loadData()
  }

  async function addCustomIncomeCategory() {
    if (!newIncCat.trim() || !settings) return
    const cats = [...(settings.customIncomeCategories || []), newIncCat.trim()]
    await updateUserSettings(currentUser.uid, { customIncomeCategories: cats })
    setNewIncCat(''); showToast('Category added ✓'); await loadData()
  }

  async function updateLowAlert() {
    await updateUserSettings(currentUser.uid, { lowBalanceAlert: Number(lowAlert) || 1000 })
    showToast('Alert threshold updated ✓')
  }

  async function handleExportCSV() {
    try {
      const [txns, xfers, bills] = await Promise.all([
        getTransactions(currentUser.uid), getTransfers(currentUser.uid), getBills(currentUser.uid),
      ])
      exportToCSV(txns, xfers, bills)
      showToast('CSV exported ✓')
    } catch (err) { showToast('Export failed', 'error') }
  }

  async function handleExportJSON() {
    try {
      const [txns, xfers, bills] = await Promise.all([
        getTransactions(currentUser.uid), getTransfers(currentUser.uid), getBills(currentUser.uid),
      ])
      exportToJSON({ transactions: txns, transfers: xfers, bills, settings })
      showToast('JSON exported ✓')
    } catch (err) { showToast('Export failed', 'error') }
  }

  async function handleInstall() {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setAppInstalled(true)
    setInstallPrompt(null)
  }

  function handleChangePin() {
    if (currentUser) clearPin(currentUser.uid)
    navigate('/pin-setup')
  }

  if (loading) return <div className={styles.container}><h1 className={styles.title}>Settings</h1>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 40, borderRadius: 6, marginBottom: 10 }} />)}</div>

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Settings</h1>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Account</div>
        <div className={styles.row}><span className={styles.rowLabel}>Name</span><span className={styles.rowValue}>{currentUser?.displayName || 'User'}</span></div>
        <div className={styles.row}><span className={styles.rowLabel}>Email</span><span className={styles.rowValue}>{currentUser?.email}</span></div>
        <div className={styles.row}><button className="btn-secondary" style={{ width: 'auto', padding: '8px 16px' }} onClick={handleChangePin}>Change PIN</button></div>
        <div className={styles.row}><button className="btn-secondary" style={{ width: 'auto', padding: '8px 16px' }} onClick={handleSignOut}>Sign out</button></div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Banks</div>
        {(settings?.banks || []).map((b, i) => (
          <div key={b.name} className={styles.bankRow}>
            <div className={styles.bankColor} style={{ backgroundColor: b.color }} />
            <span className={styles.bankName}>{b.name}</span>
            <div className={styles.bankBalance}>
              <input type="number" value={b.openingBalance} onChange={e => updateBankBalance(i, e.target.value)} inputMode="decimal" />
            </div>
          </div>
        ))}
        <div className={styles.addRow}>
          <input type="text" className="input-field" placeholder="New bank name" value={newBankName} onChange={e => setNewBankName(e.target.value)} />
          <button className="btn-primary" style={{ width: 'auto', padding: '8px 16px' }} onClick={addBank}>Add</button>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Categories</div>
        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: 8 }}>Default expense categories:</p>
        <div className={styles.categoryList}>
          {EXPENSE_CATEGORIES.map(c => <span key={c} className={styles.categoryTag}>{c}</span>)}
          {(settings?.customExpenseCategories || []).map(c => <span key={c} className={styles.categoryTag} style={{ backgroundColor: 'var(--color-primary-light)' }}>{c}</span>)}
        </div>
        <div className={styles.customCatRow}>
          <input type="text" className="input-field" placeholder="Add expense category" value={newExpCat} onChange={e => setNewExpCat(e.target.value)} />
          <button className="btn-primary" style={{ width: 'auto', padding: '8px 16px' }} onClick={addCustomExpenseCategory}>Add</button>
        </div>
        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: 8, marginTop: 16 }}>Income categories:</p>
        <div className={styles.categoryList}>
          {INCOME_CATEGORIES.map(c => <span key={c} className={styles.categoryTag}>{c}</span>)}
          {(settings?.customIncomeCategories || []).map(c => <span key={c} className={styles.categoryTag} style={{ backgroundColor: 'var(--color-success-light)' }}>{c}</span>)}
        </div>
        <div className={styles.customCatRow}>
          <input type="text" className="input-field" placeholder="Add income category" value={newIncCat} onChange={e => setNewIncCat(e.target.value)} />
          <button className="btn-primary" style={{ width: 'auto', padding: '8px 16px' }} onClick={addCustomIncomeCategory}>Add</button>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Alerts</div>
        <div className={styles.alertRow}>
          <label>Low balance threshold (₱)</label>
          <input type="number" value={lowAlert} onChange={e => setLowAlert(e.target.value)} onBlur={updateLowAlert} inputMode="decimal" />
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Data</div>
        <div className={styles.exportBtns}>
          <button className={styles.exportBtn} onClick={handleExportCSV}>Export as CSV</button>
          <button className={styles.exportBtn} onClick={handleExportJSON}>Export as JSON</button>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Install App</div>
        {appInstalled ? (
          <div className={styles.installRow}>
            <span className={styles.installedBadge}>Peso Wise is installed on your device</span>
          </div>
        ) : installPrompt ? (
          <div className={styles.installRow}>
            <p className={styles.installDesc}>Add Peso Wise to your home screen for quick access and offline use.</p>
            <button className="btn-primary" onClick={handleInstall}>Add to Home Screen</button>
          </div>
        ) : (
          <div className={styles.installRow}>
            <p className={styles.installDesc}>To install: open this page in your mobile browser, tap the browser menu, and select "Add to Home Screen".</p>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.dangerZone}>
          <div className={styles.dangerTitle}>Danger Zone</div>
          <div className={styles.dangerDesc}>Signing out will clear your PIN on this device. Your data is safe in the cloud.</div>
          <button className="btn-danger" onClick={handleSignOut}>Sign Out & Clear PIN</button>
        </div>
      </div>
    </div>
  )
}
