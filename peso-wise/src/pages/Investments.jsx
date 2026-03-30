import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../auth/AuthContext'
import { getInvestments, addInvestment, updateInvestment, deleteInvestment } from '../firebase/investments'
import { useToast } from '../components/Toast'
import { formatCurrency } from '../utils/formatCurrency'
import { INVESTMENT_TYPES } from '../utils/categories'
import styles from './Investments.module.css'

export default function Investments() {
  const [investments, setInvestments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [platform, setPlatform] = useState('')
  const [amountInvested, setAmountInvested] = useState('')
  const [currentValue, setCurrentValue] = useState('')
  const [dateStarted, setDateStarted] = useState('')
  const [notes, setNotes] = useState('')
  const [editValues, setEditValues] = useState({})
  const [saving, setSaving] = useState(false)
  const { currentUser } = useAuth()
  const { showToast } = useToast()

  useEffect(() => { loadData() }, [currentUser])
  async function loadData() {
    if (!currentUser) return
    setLoading(true)
    try { setInvestments(await getInvestments(currentUser.uid)) }
    catch (err) { console.error(err) }
    setLoading(false)
  }

  const totals = useMemo(() => {
    const invested = investments.reduce((s, i) => s + (i.amountInvested || 0), 0)
    const current = investments.reduce((s, i) => s + (i.currentValue || 0), 0)
    const gainLoss = current - invested
    const gainPct = invested > 0 ? (gainLoss / invested) * 100 : 0
    return { invested, current, gainLoss, gainPct }
  }, [investments])

  async function handleAdd(e) {
    e.preventDefault()
    if (!name || !amountInvested) return
    setSaving(true)
    try {
      await addInvestment(currentUser.uid, {
        name, type, platform, amountInvested: Number(amountInvested),
        currentValue: Number(currentValue) || Number(amountInvested),
        dateStarted: dateStarted || new Date().toISOString(), notes,
      })
      showToast('Investment added ✓')
      setName(''); setType(''); setPlatform(''); setAmountInvested(''); setCurrentValue(''); setDateStarted(''); setNotes(''); setShowForm(false)
      await loadData()
    } catch (err) { showToast('Failed to add', 'error') }
    setSaving(false)
  }

  async function handleUpdateValue(id, val) {
    try {
      await updateInvestment(id, { currentValue: Number(val) })
      setEditValues(prev => ({ ...prev, [id]: '' }))
      showToast('Value updated ✓')
      await loadData()
    } catch (err) { showToast('Failed to update', 'error') }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this investment?')) return
    try { await deleteInvestment(id); await loadData(); showToast('Investment deleted') }
    catch (err) { showToast('Failed to delete', 'error') }
  }

  if (loading) return <div className={styles.container}><h1 className={styles.title}>Investments</h1>{[1,2].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 10, marginBottom: 10 }} />)}</div>

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Investments</h1>
      <div className={styles.summary}>
        <div className={styles.summaryCard} style={{ backgroundColor: 'var(--color-primary-light)' }}>
          <div className={styles.summaryLabel}>Invested</div>
          <div className={styles.summaryValue}>{formatCurrency(totals.invested)}</div>
        </div>
        <div className={styles.summaryCard} style={{ backgroundColor: 'var(--color-primary-light)' }}>
          <div className={styles.summaryLabel}>Current</div>
          <div className={styles.summaryValue}>{formatCurrency(totals.current)}</div>
        </div>
        <div className={styles.summaryCard} style={{ backgroundColor: totals.gainLoss >= 0 ? 'var(--color-success-light)' : 'var(--color-danger-light)' }}>
          <div className={styles.summaryLabel}>Gain/Loss</div>
          <div className={styles.summaryValue} style={{ color: totals.gainLoss >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {totals.gainLoss >= 0 ? '+' : ''}{formatCurrency(totals.gainLoss)} ({totals.gainPct.toFixed(1)}%)
          </div>
        </div>
      </div>
      <button className={styles.addBtn} onClick={() => setShowForm(!showForm)}>+ Add investment</button>
      {showForm && (
        <form className={styles.addForm} onSubmit={handleAdd}>
          <h3>New Investment</h3>
          <div className={styles.formGrid}>
            <input type="text" className="input-field" placeholder="Name" value={name} onChange={e => setName(e.target.value)} required />
            <div className={styles.formRow}>
              <select className="select-field" value={type} onChange={e => setType(e.target.value)}>
                <option value="">Type</option>
                {INVESTMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input type="text" className="input-field" placeholder="Platform" value={platform} onChange={e => setPlatform(e.target.value)} />
            </div>
            <div className={styles.formRow}>
              <input type="number" className="input-field" placeholder="Amount invested" value={amountInvested} onChange={e => setAmountInvested(e.target.value)} inputMode="decimal" required />
              <input type="number" className="input-field" placeholder="Current value" value={currentValue} onChange={e => setCurrentValue(e.target.value)} inputMode="decimal" />
            </div>
            <input type="date" className="input-field" value={dateStarted} onChange={e => setDateStarted(e.target.value)} />
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Adding...' : 'Add Investment'}</button>
          </div>
        </form>
      )}
      {investments.length > 0 ? (
        <div className={styles.investList}>
          {investments.map(inv => {
            const gl = (inv.currentValue || 0) - (inv.amountInvested || 0)
            const glPct = inv.amountInvested > 0 ? (gl / inv.amountInvested) * 100 : 0
            return (
              <div key={inv.id} className={styles.investCard}>
                <div className={styles.investHeader}>
                  <span className={styles.investName}>{inv.name}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {inv.type && <span className={styles.typeBadge}>{inv.type}</span>}
                    <button className={styles.deleteBtn} onClick={() => handleDelete(inv.id)}>✕</button>
                  </div>
                </div>
                {inv.platform && <div className={styles.investMeta}>{inv.platform}</div>}
                <div className={styles.investValues}>
                  <span><span className={styles.label}>Invested</span><span className={styles.value}>{formatCurrency(inv.amountInvested)}</span></span>
                  <span><span className={styles.label}>Current</span><span className={styles.value}>{formatCurrency(inv.currentValue)}</span></span>
                </div>
                <div className={`${styles.gainLoss} ${gl >= 0 ? styles.gain : styles.loss}`}>
                  {gl >= 0 ? '+' : ''}{formatCurrency(gl)} ({glPct.toFixed(1)}%)
                </div>
                <div className={styles.editRow}>
                  <input type="number" className="input-field" placeholder="Update current value" value={editValues[inv.id] || ''} onChange={e => setEditValues(prev => ({ ...prev, [inv.id]: e.target.value }))} inputMode="decimal" />
                  <button className="btn-primary" style={{ width: 'auto' }} onClick={() => handleUpdateValue(inv.id, editValues[inv.id])} disabled={!editValues[inv.id]}>Update</button>
                </div>
              </div>
            )
          })}
        </div>
      ) : <div className={styles.empty}>No investments yet. Add your first one above.</div>}
    </div>
  )
}
