import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../auth/AuthContext'
import { getTransactions, deleteTransaction } from '../firebase/transactions'
import { getTransfers } from '../firebase/transfers'
import { useToast } from '../components/Toast'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, isToday, isYesterday, getMonthLabel } from '../utils/dateHelpers'
import { EXPENSE_CATEGORIES } from '../utils/categories'
import styles from './Transactions.module.css'

const CATEGORY_COLORS = {}
const COLORS = ['#1565C0','#2E7D32','#E65100','#C62828','#6A1B9A','#00838F','#4E342E','#283593','#558B2F','#AD1457','#00695C','#D84315','#37474F','#1B5E20']
EXPENSE_CATEGORIES.forEach((cat, i) => { CATEGORY_COLORS[cat] = COLORS[i % COLORS.length] })

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [bankFilter, setBankFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [search, setSearch] = useState('')
  const { currentUser } = useAuth()
  const { showToast } = useToast()

  useEffect(() => {
    loadData()
  }, [currentUser])

  async function loadData() {
    if (!currentUser) return
    setLoading(true)
    try {
      const [txns, xfers] = await Promise.all([
        getTransactions(currentUser.uid),
        getTransfers(currentUser.uid),
      ])
      setTransactions(txns)
      setTransfers(xfers)
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  const allItems = useMemo(() => {
    const items = [
      ...transactions.map(t => ({
        ...t,
        itemType: t.isIncome ? 'income' : 'expense',
        sortDate: t.date?.toDate ? t.date.toDate() : new Date(t.date),
      })),
      ...transfers.map(t => ({
        ...t,
        itemType: 'transfer',
        description: `${t.fromBank} → ${t.toBank}`,
        category: 'Transfer',
        sortDate: t.date?.toDate ? t.date.toDate() : new Date(t.date),
      })),
    ].sort((a, b) => b.sortDate - a.sortDate)
    return items
  }, [transactions, transfers])

  const filtered = useMemo(() => {
    return allItems.filter(item => {
      if (typeFilter !== 'all' && item.itemType !== typeFilter) return false
      if (bankFilter !== 'all') {
        if (item.itemType === 'transfer') {
          if (item.fromBank !== bankFilter && item.toBank !== bankFilter) return false
        } else if (item.bank !== bankFilter) return false
      }
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false
      if (search && !(item.description || '').toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [allItems, typeFilter, bankFilter, categoryFilter, search])

  const grouped = useMemo(() => {
    const groups = {}
    filtered.forEach(item => {
      let label
      if (isToday(item.sortDate)) label = 'Today'
      else if (isYesterday(item.sortDate)) label = 'Yesterday'
      else label = formatDate(item.sortDate)
      if (!groups[label]) groups[label] = []
      groups[label].push(item)
    })
    return groups
  }, [filtered])

  const totals = useMemo(() => {
    const income = filtered.filter(i => i.itemType === 'income').reduce((s, i) => s + i.amount, 0)
    const expenses = filtered.filter(i => i.itemType === 'expense').reduce((s, i) => s + i.amount, 0)
    return { income, expenses, net: income - expenses }
  }, [filtered])

  const bankList = useMemo(() => {
    const set = new Set()
    transactions.forEach(t => { if (t.bank) set.add(t.bank) })
    transfers.forEach(t => { set.add(t.fromBank); set.add(t.toBank) })
    return [...set].sort()
  }, [transactions, transfers])

  async function handleDelete(item) {
    if (!window.confirm('Delete this transaction?')) return
    try {
      await deleteTransaction(item.id)
      setTransactions(prev => prev.filter(t => t.id !== item.id))
      showToast('Transaction deleted')
    } catch (err) {
      showToast('Failed to delete', 'error')
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Transactions</h1>
        <div className={styles.skeleton}>
          {[1,2,3,4,5].map(i => (
            <div key={i} className={styles.skeletonRow}>
              <div className={`skeleton ${styles.skeletonCircle}`} />
              <div className={`skeleton ${styles.skeletonText}`} />
              <div className={`skeleton ${styles.skeletonAmount}`} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Transactions</h1>
        <div className={styles.summary}>
          <div className={styles.summaryCard} style={{ backgroundColor: 'var(--color-success-light)' }}>
            <div className={styles.summaryLabel}>Income</div>
            <div className={styles.summaryValue} style={{ color: 'var(--color-success)' }}>{formatCurrency(totals.income)}</div>
          </div>
          <div className={styles.summaryCard} style={{ backgroundColor: 'var(--color-danger-light)' }}>
            <div className={styles.summaryLabel}>Expenses</div>
            <div className={styles.summaryValue} style={{ color: 'var(--color-danger)' }}>{formatCurrency(totals.expenses)}</div>
          </div>
          <div className={styles.summaryCard} style={{ backgroundColor: totals.net >= 0 ? 'var(--color-success-light)' : 'var(--color-danger-light)' }}>
            <div className={styles.summaryLabel}>Net</div>
            <div className={styles.summaryValue} style={{ color: totals.net >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{formatCurrency(totals.net)}</div>
          </div>
        </div>
      </div>

      <div className={styles.filters}>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All types</option>
          <option value="expense">Expenses</option>
          <option value="income">Income</option>
          <option value="transfer">Transfers</option>
        </select>
        <select value={bankFilter} onChange={e => setBankFilter(e.target.value)}>
          <option value="all">All banks</option>
          {bankList.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="all">All categories</option>
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📝</div>
          <p className={styles.emptyText}>No transactions yet. Tap + to add your first one.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([dateLabel, items]) => (
          <div key={dateLabel} className={styles.dateGroup}>
            <div className={styles.dateLabel}>{dateLabel}</div>
            {items.map(item => (
              <div key={item.id} className={styles.txnRow}>
                <div
                  className={styles.categoryDot}
                  style={{ backgroundColor: CATEGORY_COLORS[item.category] || 'var(--color-text-hint)' }}
                />
                <div className={styles.txnInfo}>
                  <div className={styles.txnDesc}>{item.description || item.category}</div>
                  <div className={styles.txnMeta}>
                    {item.category && <span className={styles.tag}>{item.category}</span>}
                    {item.bank && <span>{item.bank}</span>}
                  </div>
                </div>
                <div className={`${styles.txnAmount} ${styles[item.itemType]}`}>
                  {item.itemType === 'income' ? '+' : item.itemType === 'expense' ? '-' : ''}{formatCurrency(item.amount)}
                </div>
                {item.itemType !== 'transfer' && (
                  <button className={styles.deleteBtn} onClick={() => handleDelete(item)}>✕</button>
                )}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}
