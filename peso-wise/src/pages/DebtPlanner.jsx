import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../auth/AuthContext'
import { getDebts, addDebt, deleteDebt } from '../firebase/debts'
import { useToast } from '../components/Toast'
import { calculateDebtPayoff, compareStrategies } from '../engine/debtPlanner'
import { formatCurrency } from '../utils/formatCurrency'
import ProgressBar from '../components/ProgressBar'
import styles from './DebtPlanner.module.css'

const DEBT_TYPES = ['Credit Card', 'Personal Loan', 'Home Loan', 'Car Loan', 'Other']

export default function DebtPlanner() {
  const [debts, setDebts] = useState([])
  const [loading, setLoading] = useState(true)
  const [strategy, setStrategy] = useState('avalanche')
  const [extraPayment, setExtraPayment] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState('Credit Card')
  const [balance, setBalance] = useState('')
  const [interestRate, setInterestRate] = useState('')
  const [minPayment, setMinPayment] = useState('')
  const [startDate, setStartDate] = useState('')
  const [saving, setSaving] = useState(false)
  const { currentUser } = useAuth()
  const { showToast } = useToast()

  useEffect(() => { loadData() }, [currentUser])
  async function loadData() {
    if (!currentUser) return; setLoading(true)
    try { setDebts(await getDebts(currentUser.uid)) } catch (err) { console.error(err) }
    setLoading(false)
  }

  const totalDebt = debts.reduce((s, d) => s + (d.balance || 0), 0)
  const totalMinPayments = debts.reduce((s, d) => s + (d.minPayment || 0), 0)

  const comparison = useMemo(() => compareStrategies(debts, Number(extraPayment) || 0), [debts, extraPayment])
  const currentResult = strategy === 'avalanche' ? comparison.avalanche : comparison.snowball

  const sortedDebts = useMemo(() => {
    return [...debts].sort((a, b) => strategy === 'avalanche' ? b.interestRate - a.interestRate : a.balance - b.balance)
  }, [debts, strategy])

  async function handleAdd(e) {
    e.preventDefault()
    if (!name || !balance) return; setSaving(true)
    try {
      await addDebt(currentUser.uid, {
        name, type, balance: Number(balance), interestRate: Number(interestRate) || 0,
        minPayment: Number(minPayment) || 0, startDate: startDate || new Date().toISOString(),
      })
      showToast('Debt added ✓')
      setName(''); setBalance(''); setInterestRate(''); setMinPayment(''); setShowForm(false)
      await loadData()
    } catch (err) { showToast('Failed to add', 'error') }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this debt?')) return
    try { await deleteDebt(id); await loadData(); showToast('Debt deleted') }
    catch (err) { showToast('Failed to delete', 'error') }
  }

  if (loading) return <div className={styles.container}><h1 className={styles.title}>Debt Payoff Planner</h1>{[1,2].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 10, marginBottom: 10 }} />)}</div>

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Debt Payoff Planner</h1>
      <div className={styles.summary}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Total Debt</div>
          <div className={styles.summaryValue} style={{ color: 'var(--color-danger)' }}>{formatCurrency(totalDebt)}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Min Payments</div>
          <div className={styles.summaryValue}>{formatCurrency(totalMinPayments)}/mo</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Payoff</div>
          <div className={styles.summaryValue}>{currentResult.totalMonths} months</div>
        </div>
      </div>
      <div className={styles.strategyToggle}>
        <button className={`${styles.strategyBtn} ${strategy === 'avalanche' ? styles.active : ''}`} onClick={() => setStrategy('avalanche')}>Avalanche</button>
        <button className={`${styles.strategyBtn} ${strategy === 'snowball' ? styles.active : ''}`} onClick={() => setStrategy('snowball')}>Snowball</button>
      </div>
      {comparison.avalancheSaves > 0 && <div className={styles.comparison}>Avalanche saves {formatCurrency(comparison.avalancheSaves)} vs Snowball</div>}
      <button className={styles.addBtn} onClick={() => setShowForm(!showForm)}>+ Add debt</button>
      {showForm && (
        <form className={styles.addForm} onSubmit={handleAdd}>
          <h3>New Debt</h3>
          <div className={styles.formGrid}>
            <input type="text" className="input-field" placeholder="Name" value={name} onChange={e => setName(e.target.value)} required />
            <div className={styles.formRow}>
              <select className="select-field" value={type} onChange={e => setType(e.target.value)}>{DEBT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
              <input type="number" className="input-field" placeholder="Balance" value={balance} onChange={e => setBalance(e.target.value)} inputMode="decimal" required />
            </div>
            <div className={styles.formRow}>
              <input type="number" className="input-field" placeholder="Interest %" value={interestRate} onChange={e => setInterestRate(e.target.value)} inputMode="decimal" />
              <input type="number" className="input-field" placeholder="Min payment" value={minPayment} onChange={e => setMinPayment(e.target.value)} inputMode="decimal" />
            </div>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Adding...' : 'Add Debt'}</button>
          </div>
        </form>
      )}
      {sortedDebts.length > 0 ? (
        <div className={styles.debtList}>
          {sortedDebts.map((d, i) => (
            <div key={d.id} className={styles.debtCard}>
              <div className={styles.debtHeader}>
                <span className={styles.debtName}>{d.name}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {i === 0 && <span className={styles.priorityBadge}>Pay first</span>}
                  <button className={styles.deleteBtn} onClick={() => handleDelete(d.id)}>✕</button>
                </div>
              </div>
              <div className={styles.debtMeta}>
                <span>{d.type}</span><span>{d.interestRate}% APR</span><span>Min: {formatCurrency(d.minPayment)}</span>
              </div>
              <div className={styles.debtBalance}>{formatCurrency(d.balance)}</div>
              {currentResult.payoffDates[d.id] && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Payoff in {currentResult.payoffDates[d.id]} months</div>}
            </div>
          ))}
        </div>
      ) : <div className={styles.empty}>No debts tracked. Add your first one above.</div>}
      {debts.length > 0 && (
        <div className={styles.extraCalc}>
          <h3>Extra Payment Impact</h3>
          <input type="number" className="input-field" placeholder="Extra ₱/month" value={extraPayment} onChange={e => setExtraPayment(e.target.value)} inputMode="decimal" />
          {Number(extraPayment) > 0 && (
            <div className={styles.extraResult}>
              Saves {formatCurrency(comparison[strategy === 'avalanche' ? 'avalanche' : 'snowball'].totalInterestPaid - calculateDebtPayoff(debts, strategy, Number(extraPayment)).totalInterestPaid)} in interest, payoff {calculateDebtPayoff(debts, strategy, Number(extraPayment)).totalMonths} months
            </div>
          )}
        </div>
      )}
    </div>
  )
}
