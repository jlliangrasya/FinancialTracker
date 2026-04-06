import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { usePin } from '../auth/PinContext'
import { getUserSettings, updateUserSettings } from '../firebase/settings'
import { getTransactions } from '../firebase/transactions'
import { getTransfers } from '../firebase/transfers'
import { getBills } from '../firebase/bills'
import { getBudgets, addBudget, updateBudget, deleteBudget } from '../firebase/budgets'
import { useToast } from '../components/Toast'
import { clearPin } from '../utils/hashPin'
import { formatCurrency } from '../utils/formatCurrency'
import { exportToCSV, exportToJSON } from '../utils/exportData'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../utils/categories'
import { useTheme } from '../auth/ThemeContext'
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
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName] = useState('')
  const [budgets, setBudgets] = useState([])
  const [newBudgetCat, setNewBudgetCat] = useState('')
  const [newBudgetLimit, setNewBudgetLimit] = useState('')
  const { currentUser, logout, updateDisplayName, isAdmin } = useAuth()
  const { resetPinVerified } = usePin()
  const { showToast } = useToast()
  const { isDark, toggleTheme } = useTheme()
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
      const [s, b] = await Promise.all([
        getUserSettings(currentUser.uid),
        getBudgets(currentUser.uid),
      ])
      setSettings(s)
      setBudgets(b || [])
      setLowAlert(String(s?.lowBalanceAlert || 1000))
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  async function handleSignOut() {
    resetPinVerified()
    await logout()
    navigate('/login')
  }

  async function handleSignOutAndClearPin() {
    if (currentUser) clearPin(currentUser.uid)
    localStorage.removeItem('pesowise_lastActive')
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

  async function saveBankBalance(index, value) {
    const banks = [...settings.banks]
    banks[index] = { ...banks[index], openingBalance: Number(value) || 0 }
    await updateUserSettings(currentUser.uid, { banks })
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

  async function handleUpdateName() {
    if (!newName.trim()) return
    try {
      await updateDisplayName(newName.trim())
      showToast('Name updated ✓')
      setEditingName(false)
    } catch { showToast('Failed to update name', 'error') }
  }

  async function handleUpdateBudgetLimit(id, value) {
    const limit = Number(value)
    if (!limit || limit <= 0) return
    await updateBudget(id, { monthlyLimit: limit })
    await loadData()
  }

  async function handleDeleteBudget(id) {
    await deleteBudget(id)
    showToast('Budget removed ✓')
    await loadData()
  }

  async function handleAddBudget() {
    if (!newBudgetCat || !newBudgetLimit) return
    const limit = Number(newBudgetLimit)
    if (!limit || limit <= 0) return
    const existing = budgets.find(b => b.category === newBudgetCat)
    if (existing) {
      await updateBudget(existing.id, { monthlyLimit: limit })
    } else {
      await addBudget(currentUser.uid, { category: newBudgetCat, monthlyLimit: limit })
    }
    setNewBudgetCat('')
    setNewBudgetLimit('')
    showToast('Budget saved ✓')
    await loadData()
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
        <div className={styles.sectionTitle}>Appearance</div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Dark Mode</span>
          <button className={`${styles.themeToggle} ${isDark ? styles.toggleOn : ''}`} onClick={toggleTheme} aria-label="Toggle dark mode">
            <span className={styles.toggleThumb} />
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Account</div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Name</span>
          {editingName ? (
            <div className={styles.inlineEdit}>
              <input className="input-field" style={{ padding: '6px 10px', fontSize: '0.875rem' }} value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
              <button className="btn-primary" style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8125rem' }} onClick={handleUpdateName}>Save</button>
              <button className="btn-secondary" style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8125rem' }} onClick={() => setEditingName(false)}>Cancel</button>
            </div>
          ) : (
            <div className={styles.inlineEdit}>
              <span className={styles.rowValue}>{currentUser?.displayName || 'Not set'}</span>
              <button className="btn-secondary" style={{ width: 'auto', padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => { setNewName(currentUser?.displayName || ''); setEditingName(true) }}>Edit</button>
            </div>
          )}
        </div>
        <div className={styles.row}><span className={styles.rowLabel}>Email</span><span className={styles.rowValue}>{currentUser?.email}</span></div>
        <div className={styles.row}><span className={styles.rowLabel}>User ID</span><span className={styles.rowValue} style={{ fontSize: '0.75rem', wordBreak: 'break-all', color: 'var(--color-text-hint)' }}>{currentUser?.uid}</span></div>
        <div className={styles.row}><button className="btn-secondary" style={{ width: 'auto', padding: '8px 16px' }} onClick={handleChangePin}>Change PIN</button></div>
        {isAdmin && (
          <div className={styles.row}><button className="btn-secondary" style={{ width: 'auto', padding: '8px 16px' }} onClick={() => navigate('/admin')}>Admin Panel</button></div>
        )}
        <div className={styles.row}><button className="btn-secondary" style={{ width: 'auto', padding: '8px 16px' }} onClick={handleSignOut}>Sign out</button></div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Banks</div>
        {(settings?.banks || []).map((b, i) => (
          <div key={b.name} className={styles.bankRow}>
            <div className={styles.bankColor} style={{ backgroundColor: b.color }} />
            <span className={styles.bankName}>{b.name}</span>
            <div className={styles.bankBalance}>
              <input type="number" defaultValue={b.openingBalance} onBlur={e => saveBankBalance(i, e.target.value)} inputMode="decimal" />
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
        <div className={styles.sectionTitle}>Monthly Budgets</div>
        {budgets.length === 0 && <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: 8 }}>No budgets set yet.</p>}
        {budgets.map(b => (
          <div key={b.id} className={styles.budgetRow}>
            <span className={styles.budgetCat}>{b.category}</span>
            <input
              type="number"
              className={styles.budgetInput}
              defaultValue={b.monthlyLimit}
              onBlur={e => handleUpdateBudgetLimit(b.id, e.target.value)}
              inputMode="decimal"
            />
            <button className={styles.deleteBudgetBtn} onClick={() => handleDeleteBudget(b.id)}>✕</button>
          </div>
        ))}
        <div className={styles.addRow} style={{ marginTop: 12 }}>
          <select className="select-field" value={newBudgetCat} onChange={e => setNewBudgetCat(e.target.value)} style={{ flex: 1 }}>
            <option value="">Category</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            {(settings?.customExpenseCategories || []).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="number" className="input-field" placeholder="₱ limit" value={newBudgetLimit} onChange={e => setNewBudgetLimit(e.target.value)} inputMode="decimal" style={{ width: 90 }} />
          <button className="btn-primary" style={{ width: 'auto', padding: '8px 16px' }} onClick={handleAddBudget}>Add</button>
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
          <div className={styles.dangerDesc}>This will sign you out AND clear your saved PIN from this device. You will need to create a new PIN on your next login.</div>
          <button className="btn-danger" onClick={handleSignOutAndClearPin}>Sign Out & Clear PIN</button>
        </div>
      </div>
    </div>
  )
}
