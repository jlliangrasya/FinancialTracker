import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../auth/AuthContext'
import { getUserSettings } from '../firebase/settings'
import { getTransactions } from '../firebase/transactions'
import { getTransfers, addTransfer } from '../firebase/transfers'
import { calculateAllBankBalances, getTotalBalance } from '../engine/bankBalance'
import { useToast } from '../components/Toast'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate } from '../utils/dateHelpers'
import styles from './Banks.module.css'

export default function Banks() {
  const [settings, setSettings] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [fromBank, setFromBank] = useState('')
  const [toBank, setToBank] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const { currentUser } = useAuth()
  const { showToast } = useToast()

  useEffect(() => { loadData() }, [currentUser])

  async function loadData() {
    if (!currentUser) return
    setLoading(true)
    try {
      const [s, txns, xfers] = await Promise.all([
        getUserSettings(currentUser.uid),
        getTransactions(currentUser.uid),
        getTransfers(currentUser.uid),
      ])
      setSettings(s)
      setTransactions(txns)
      setTransfers(xfers)
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  const banks = settings?.banks || []
  const lowThreshold = settings?.lowBalanceAlert || 1000
  const bankBalances = useMemo(() => calculateAllBankBalances(banks, transactions, transfers), [banks, transactions, transfers])
  const totalBalance = useMemo(() => getTotalBalance(banks, transactions, transfers), [banks, transactions, transfers])

  const fromBankBalance = useMemo(() => {
    const b = bankBalances.find(x => x.name === fromBank)
    return b ? b.balance : 0
  }, [bankBalances, fromBank])

  const insufficientFunds = fromBank && amount && Number(amount) > fromBankBalance

  async function handleTransfer(e) {
    e.preventDefault()
    if (!fromBank || !toBank || !amount || Number(amount) <= 0) return
    if (insufficientFunds) return
    setSaving(true)
    try {
      await addTransfer(currentUser.uid, { fromBank, toBank, amount: Number(amount), note, date })
      showToast('Transfer complete ✓')
      setAmount(''); setNote(''); setFromBank(''); setToBank('')
      await loadData()
    } catch (err) {
      showToast('Transfer failed', 'error')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Banks & Transfers</h1>
        <div className={styles.skeleton}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 10 }} />)}
        </div>
      </div>
    )
  }

  const bankNames = banks.map(b => b.name)

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Banks & Transfers</h1>

      <div className={styles.bankCards}>
        {bankBalances.map(b => {
          const status = b.balance < 0 ? 'negative' : b.balance < lowThreshold ? 'low' : 'ok'
          return (
            <div key={b.name} className={styles.bankCard}>
              <div className={styles.bankHeader}>
                <div className={styles.bankColor} style={{ backgroundColor: b.color || 'var(--color-primary)' }} />
                <span className={styles.bankName}>{b.name}</span>
              </div>
              <div className={styles.bankBalance} style={{
                color: status === 'negative' ? 'var(--color-danger)' : status === 'low' ? 'var(--color-warning)' : 'var(--color-text-primary)'
              }}>
                {formatCurrency(b.balance)}
              </div>
              <div className={styles.bankStatus} style={{
                color: status === 'negative' ? 'var(--color-danger)' : status === 'low' ? 'var(--color-warning)' : 'var(--color-success)'
              }}>
                {status === 'negative' ? '⛔ Negative' : status === 'low' ? '⚠ Low balance' : '✓ OK'}
              </div>
            </div>
          )
        })}
      </div>

      <div className={styles.totalCard}>
        <div className={styles.totalLabel}>Total across all banks</div>
        <div className={styles.totalAmount}>{formatCurrency(totalBalance)}</div>
      </div>

      <h2 className={styles.sectionTitle}>Transfer between accounts</h2>
      <form className={styles.transferForm} onSubmit={handleTransfer}>
        <div className={styles.transferRow}>
          <select className="select-field" value={fromBank} onChange={e => setFromBank(e.target.value)}>
            <option value="">From bank</option>
            {bankNames.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <div className={styles.transferArrow}>→</div>
          <select className="select-field" value={toBank} onChange={e => setToBank(e.target.value)}>
            <option value="">To bank</option>
            {bankNames.filter(b => b !== fromBank).map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <input type="number" className="input-field" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" />
        {insufficientFunds && <p className={styles.warningText}>⚠ Insufficient funds in {fromBank}</p>}
        <input type="text" className="input-field" placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} />
        <input type="date" className="input-field" value={date} onChange={e => setDate(e.target.value)} />
        <button type="submit" className="btn-primary" disabled={saving || !fromBank || !toBank || !amount || insufficientFunds}>
          {saving ? 'Transferring...' : 'Transfer'}
        </button>
      </form>

      {transfers.length > 0 && (
        <>
          <h2 className={styles.sectionTitle}>Recent Transfers</h2>
          <div className={styles.transferList}>
            {transfers.slice(0, 10).map(t => (
              <div key={t.id} className={styles.transferItem}>
                <div className={styles.transferInfo}>
                  <div className={styles.transferRoute}>{t.fromBank} → {t.toBank}</div>
                  <div className={styles.transferDate}>{formatDate(t.date)} {t.note ? `· ${t.note}` : ''}</div>
                </div>
                <div className={styles.transferAmount}>{formatCurrency(t.amount)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
