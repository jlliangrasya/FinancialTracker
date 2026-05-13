import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../auth/AuthContext'
import { addBusinessTransaction, getBusinessTransactions, deleteBusinessTransaction } from '../firebase/businessTransactions'
import { formatCurrency } from '../utils/formatCurrency'
import { useToast } from '../components/Toast'
import styles from './Business.module.css'

const SALE_CATEGORIES = ['Product Sales', 'Service', 'Delivery', 'Online Sales', 'Other Income']
const EXPENSE_CATEGORIES = ['Supplies', 'Packaging', 'Utilities', 'Rent', 'Labor', 'Marketing', 'Transport', 'Other Expense']

function toDateStr(ts) {
  if (!ts) return ''
  const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts)
  return d.toISOString().split('T')[0]
}

function groupByDate(txns) {
  const groups = {}
  txns.forEach(t => {
    const key = toDateStr(t.date)
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  })
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
}

export default function Business() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('today')

  const [type, setType] = useState('sale')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Product Sales')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  const { currentUser } = useAuth()
  const { showToast } = useToast()

  useEffect(() => { loadData() }, [currentUser])

  async function loadData() {
    if (!currentUser) return
    setLoading(true)
    try { setTransactions(await getBusinessTransactions(currentUser.uid)) }
    catch (err) { console.error(err) }
    setLoading(false)
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!amount || !date) return
    setSaving(true)
    try {
      await addBusinessTransaction(currentUser.uid, {
        type, amount: Number(amount), description, category, date,
      })
      showToast(`${type === 'sale' ? 'Sale' : 'Expense'} recorded ✓`)
      setAmount(''); setDescription('')
      await loadData()
    } catch (err) { showToast('Failed to save', 'error') }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this entry?')) return
    try { await deleteBusinessTransaction(id); await loadData(); showToast('Deleted') }
    catch { showToast('Failed to delete', 'error') }
  }

  const today = new Date().toISOString().split('T')[0]
  const now = new Date()
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  function filterByPeriod(txns) {
    return txns.filter(t => {
      const d = toDateStr(t.date)
      if (activeTab === 'today') return d === today
      if (activeTab === 'week') return d >= weekStart.toISOString().split('T')[0]
      return d >= monthStart.toISOString().split('T')[0]
    })
  }

  const filtered = filterByPeriod(transactions)
  const sales = filtered.filter(t => t.type === 'sale').reduce((s, t) => s + t.amount, 0)
  const expenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const profit = sales - expenses

  const grouped = useMemo(() => groupByDate(filtered), [filtered])

  if (loading) return (
    <div className={styles.container}>
      <h1 className={styles.title}>Business</h1>
      {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 10, marginBottom: 10 }} />)}
    </div>
  )

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Business</h1>

      {/* Quick Entry Form */}
      <form className={styles.entryForm} onSubmit={handleAdd}>
        <div className={styles.typeToggle}>
          <button type="button" className={`${styles.typeBtn} ${type === 'sale' ? styles.saleActive : ''}`} onClick={() => { setType('sale'); setCategory('Product Sales') }}>+ Sale</button>
          <button type="button" className={`${styles.typeBtn} ${type === 'expense' ? styles.expenseActive : ''}`} onClick={() => { setType('expense'); setCategory('Supplies') }}>- Expense</button>
        </div>
        <div className={styles.entryRow}>
          <input type="number" className="input-field" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" required style={{ flex: 1 }} />
          <input type="date" className="input-field" value={date} onChange={e => setDate(e.target.value)} style={{ flex: 1 }} />
        </div>
        <div className={styles.entryRow}>
          <select className="select-field" value={category} onChange={e => setCategory(e.target.value)} style={{ flex: 1 }}>
            {(type === 'sale' ? SALE_CATEGORIES : EXPENSE_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="text" className="input-field" placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} style={{ flex: 2 }} />
        </div>
        <button type="submit" className={`btn-primary ${styles.saveBtn}`} disabled={saving}>
          {saving ? 'Saving...' : `Record ${type === 'sale' ? 'Sale' : 'Expense'}`}
        </button>
      </form>

      {/* Period Tabs */}
      <div className={styles.periodTabs}>
        {['today', 'week', 'month'].map(tab => (
          <button key={tab} className={`${styles.periodTab} ${activeTab === tab ? styles.periodActive : ''}`} onClick={() => setActiveTab(tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* P&L Summary */}
      <div className={styles.plSummary}>
        <div className={styles.plCard}>
          <div className={styles.plLabel}>Sales</div>
          <div className={styles.plValue} style={{ color: 'var(--color-success)' }}>{formatCurrency(sales)}</div>
        </div>
        <div className={styles.plCard}>
          <div className={styles.plLabel}>Expenses</div>
          <div className={styles.plValue} style={{ color: 'var(--color-danger)' }}>{formatCurrency(expenses)}</div>
        </div>
        <div className={styles.plCard} style={{ borderColor: profit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
          <div className={styles.plLabel}>Net Profit</div>
          <div className={styles.plValue} style={{ color: profit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{formatCurrency(profit)}</div>
        </div>
      </div>

      {/* Transaction List */}
      {grouped.length === 0 ? (
        <div className={styles.empty}>No entries for this period.</div>
      ) : grouped.map(([dateKey, items]) => (
        <div key={dateKey} className={styles.dateGroup}>
          <div className={styles.dateLabel}>{dateKey === today ? 'Today' : dateKey}</div>
          {items.map(t => (
            <div key={t.id} className={styles.txRow}>
              <div className={`${styles.txTypeTag} ${t.type === 'sale' ? styles.saleTag : styles.expenseTag}`}>
                {t.type === 'sale' ? 'Sale' : 'Exp'}
              </div>
              <div className={styles.txInfo}>
                <div className={styles.txCategory}>{t.category}</div>
                {t.description && <div className={styles.txDesc}>{t.description}</div>}
              </div>
              <div className={`${styles.txAmount} ${t.type === 'sale' ? styles.saleAmount : styles.expenseAmount}`}>
                {t.type === 'sale' ? '+' : '-'}{formatCurrency(t.amount)}
              </div>
              <button className={styles.deleteBtn} onClick={() => handleDelete(t.id)}>✕</button>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
