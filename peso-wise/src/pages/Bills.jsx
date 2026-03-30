import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../auth/AuthContext'
import { getBills, addBill, deleteBill, markBillPaid, markBillUnpaid } from '../firebase/bills'
import { getUserSettings } from '../firebase/settings'
import { useToast } from '../components/Toast'
import { formatCurrency } from '../utils/formatCurrency'
import { getCurrentMonthString } from '../utils/dateHelpers'
import { BILL_FREQUENCIES } from '../utils/categories'
import styles from './Bills.module.css'

export default function Bills() {
  const [bills, setBills] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [frequency, setFrequency] = useState('Monthly')
  const [bank, setBank] = useState('')
  const [saving, setSaving] = useState(false)
  const { currentUser } = useAuth()
  const { showToast } = useToast()
  const currentMonthStr = getCurrentMonthString()

  useEffect(() => { loadData() }, [currentUser])

  async function loadData() {
    if (!currentUser) return
    setLoading(true)
    try {
      const [bl, s] = await Promise.all([getBills(currentUser.uid), getUserSettings(currentUser.uid)])
      setBills(bl)
      setSettings(s)
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  const processedBills = useMemo(() => {
    const today = new Date()
    return bills.filter(b => b.isActive).map(b => {
      const isPaid = b.paidMonths && b.paidMonths.includes(currentMonthStr)
      const daysUntilDue = b.dueDay - today.getDate()
      let status = 'upcoming'
      if (isPaid) status = 'paid'
      else if (daysUntilDue < 0) status = 'overdue'
      else if (daysUntilDue <= 7) status = 'dueSoon'
      return { ...b, isPaid, daysUntilDue, status }
    }).sort((a, b) => {
      const order = { overdue: 0, dueSoon: 1, upcoming: 2, paid: 3 }
      return order[a.status] - order[b.status]
    })
  }, [bills, currentMonthStr])

  const totalBills = processedBills.reduce((s, b) => s + b.amount, 0)
  const paidTotal = processedBills.filter(b => b.isPaid).reduce((s, b) => s + b.amount, 0)
  const unpaidTotal = processedBills.filter(b => !b.isPaid).reduce((s, b) => s + b.amount, 0)
  const bankNames = (settings?.banks || []).map(b => b.name)

  async function handleAddBill(e) {
    e.preventDefault()
    if (!name || !amount) return
    setSaving(true)
    try {
      await addBill(currentUser.uid, {
        name, amount: Number(amount), dueDay: Number(dueDay) || 1,
        frequency, bank: bank || bankNames[0] || '', category: 'Bills & Utilities',
      })
      showToast('Bill added ✓')
      setName(''); setAmount(''); setDueDay(''); setShowForm(false)
      await loadData()
    } catch (err) { showToast('Failed to add bill', 'error') }
    setSaving(false)
  }

  async function handleTogglePaid(bill) {
    try {
      if (bill.isPaid) await markBillUnpaid(bill.id, currentMonthStr)
      else await markBillPaid(bill.id, currentMonthStr)
      await loadData()
    } catch (err) { showToast('Failed to update', 'error') }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this bill?')) return
    try {
      await deleteBill(id)
      await loadData()
      showToast('Bill deleted')
    } catch (err) { showToast('Failed to delete', 'error') }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Bills & Subscriptions</h1>
        {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 10, marginBottom: 8 }} />)}
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Bills & Subscriptions</h1>

      <div className={styles.summary}>
        <div className={styles.summaryCard} style={{ backgroundColor: 'var(--color-primary-light)' }}>
          <div className={styles.summaryLabel}>Total</div>
          <div className={styles.summaryValue}>{formatCurrency(totalBills)}</div>
        </div>
        <div className={styles.summaryCard} style={{ backgroundColor: 'var(--color-success-light)' }}>
          <div className={styles.summaryLabel}>Paid</div>
          <div className={styles.summaryValue} style={{ color: 'var(--color-success)' }}>{formatCurrency(paidTotal)}</div>
        </div>
        <div className={styles.summaryCard} style={{ backgroundColor: 'var(--color-warning-light)' }}>
          <div className={styles.summaryLabel}>Unpaid</div>
          <div className={styles.summaryValue} style={{ color: 'var(--color-warning)' }}>{formatCurrency(unpaidTotal)}</div>
        </div>
      </div>

      <button className={styles.addBillBtn} onClick={() => setShowForm(!showForm)}>
        + Add bill
      </button>

      {showForm && (
        <form className={styles.addForm} onSubmit={handleAddBill}>
          <h3>New Bill</h3>
          <div className={styles.formGrid}>
            <input type="text" className="input-field" placeholder="Bill name" value={name} onChange={e => setName(e.target.value)} required />
            <div className={styles.formRow}>
              <input type="number" className="input-field" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" required />
              <input type="number" className="input-field" placeholder="Due day (1-31)" min="1" max="31" value={dueDay} onChange={e => setDueDay(e.target.value)} />
            </div>
            <div className={styles.formRow}>
              <select className="select-field" value={frequency} onChange={e => setFrequency(e.target.value)}>
                {BILL_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <select className="select-field" value={bank} onChange={e => setBank(e.target.value)}>
                <option value="">Bank</option>
                {bankNames.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Adding...' : 'Add Bill'}</button>
          </div>
        </form>
      )}

      {processedBills.length > 0 ? (
        <div className={styles.billList}>
          {processedBills.map(b => (
            <div key={b.id} className={styles.billItem}>
              <span className={`${styles.badge} ${styles[b.status]}`}>
                {b.status === 'dueSoon' ? 'Due Soon' : b.status}
              </span>
              <div className={styles.billInfo}>
                <div className={styles.billName}>{b.name}</div>
                <div className={styles.billMeta}>
                  Day {b.dueDay} · {b.frequency} · {b.bank}
                </div>
              </div>
              <div className={styles.billRight}>
                <div className={styles.billAmount}>{formatCurrency(b.amount)}</div>
                <input type="checkbox" className={styles.paidToggle} checked={b.isPaid} onChange={() => handleTogglePaid(b)} />
              </div>
              <button className={styles.deleteBtn} onClick={() => handleDelete(b.id)}>✕</button>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>No bills yet. Add your first one above.</div>
      )}
    </div>
  )
}
