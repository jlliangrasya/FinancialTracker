import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../auth/AuthContext'
import { getDebts, addDebt, deleteDebt } from '../firebase/debts'
import { useToast } from '../components/Toast'
import { calculateDebtPayoff, compareStrategies } from '../engine/debtPlanner'
import { formatCurrency } from '../utils/formatCurrency'
import ProgressBar from '../components/ProgressBar'
import VerseCard from '../components/VerseCard'
import { PAGE_VERSES } from '../utils/verses'
import styles from './DebtPlanner.module.css'

const DEBT_TYPES = ['Credit Card', 'Personal Loan', 'Home Loan', 'Car Loan', 'Other']

export default function DebtPlanner() {
  const [debts, setDebts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInfo, setShowInfo] = useState(false)
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
  const [showProgress, setShowProgress] = useState(false)
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
      <div className={styles.titleRow}>
        <h1 className={styles.title}>Debt Payoff Planner</h1>
        <button className={styles.infoBtn} onClick={() => setShowInfo(true)} aria-label="How it works">?</button>
      </div>
      <VerseCard quote={PAGE_VERSES.debtPlanner.quote} reference={PAGE_VERSES.debtPlanner.reference} context="bills" />

      {showInfo && (
        <div className={styles.infoOverlay} onClick={() => setShowInfo(false)}>
          <div className={styles.infoModal} onClick={e => e.stopPropagation()}>
            <div className={styles.infoHeader}>
              <h2 className={styles.infoTitle}>How it Works</h2>
              <button className={styles.infoClose} onClick={() => setShowInfo(false)}>✕</button>
            </div>
            <div className={styles.infoBody}>
              <section className={styles.infoSection}>
                <h3>Getting Started</h3>
                <ol className={styles.infoList}>
                  <li>Tap <strong>+ Add debt</strong> and enter each of your debts — name, current balance, interest rate (APR), and minimum monthly payment.</li>
                  <li>Choose a payoff strategy: <strong>Avalanche</strong> or <strong>Snowball</strong>.</li>
                  <li>Optionally enter an <strong>extra monthly payment</strong> to see how much faster you can become debt-free.</li>
                  <li>The debt with <strong>"Pay first"</strong> badge is your current priority based on the chosen strategy.</li>
                </ol>
              </section>

              <section className={styles.infoSection}>
                <div className={styles.strategyCard}>
                  <div className={styles.strategyIcon}>❄️</div>
                  <div>
                    <h3>Avalanche Method</h3>
                    <p>Pay minimums on all debts, then put every extra peso toward the debt with the <strong>highest interest rate</strong> first.</p>
                    <div className={styles.infoPill + ' ' + styles.infoPillGreen}>Best for: Saving the most money</div>
                    <p className={styles.infoNote}>You pay less total interest over time. Mathematically optimal — but early wins take longer to see.</p>
                  </div>
                </div>
              </section>

              <section className={styles.infoSection}>
                <div className={styles.strategyCard}>
                  <div className={styles.strategyIcon}>⛄</div>
                  <div>
                    <h3>Snowball Method</h3>
                    <p>Pay minimums on all debts, then attack the debt with the <strong>smallest balance</strong> first.</p>
                    <div className={styles.infoPill + ' ' + styles.infoPillBlue}>Best for: Motivation and quick wins</div>
                    <p className={styles.infoNote}>You eliminate debts faster, which builds momentum. You may pay slightly more interest total, but staying motivated matters.</p>
                  </div>
                </div>
              </section>

              <section className={styles.infoSection}>
                <h3>Extra Payment Calculator</h3>
                <p>Enter any extra amount you can add each month beyond minimums. The app shows how many months you save and how much interest you avoid — with either strategy.</p>
              </section>

              <section className={styles.infoSection}>
                <h3>Tips</h3>
                <ul className={styles.infoList}>
                  <li>Always pay at least the minimum on all debts to avoid penalties.</li>
                  <li>Even ₱500 extra per month can save thousands in interest.</li>
                  <li>Once a debt is paid off, roll that payment into the next priority debt.</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}
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
      {comparison.snowballSaves > 0 && <div className={styles.comparison}>Snowball saves {formatCurrency(comparison.snowballSaves)} vs Avalanche</div>}

      {debts.length > 0 && (
        <div className={styles.strategyExplainer}>
          {strategy === 'avalanche'
            ? 'Sorted by highest interest rate first — saves the most money over time.'
            : 'Sorted by smallest balance first — eliminate debts faster for quick wins.'
          }
        </div>
      )}

      {debts.length > 0 && (
        <button className={styles.progressBtn} onClick={() => setShowProgress(true)}>
          View Payoff Progress
        </button>
      )}

      {showProgress && (
        <div className={styles.infoOverlay} onClick={() => setShowProgress(false)}>
          <div className={styles.infoModal} onClick={e => e.stopPropagation()}>
            <div className={styles.infoHeader}>
              <h2 className={styles.infoTitle}>Payoff Progress</h2>
              <button className={styles.infoClose} onClick={() => setShowProgress(false)}>✕</button>
            </div>
            <div className={styles.infoBody}>
              <div className={styles.progressSummary}>
                <div className={styles.progressSummaryCard}>
                  <div className={styles.progressSummaryLabel}>Total Debt</div>
                  <div className={styles.progressSummaryValue} style={{ color: 'var(--color-danger)' }}>{formatCurrency(totalDebt)}</div>
                </div>
                <div className={styles.progressSummaryCard}>
                  <div className={styles.progressSummaryLabel}>Total Interest</div>
                  <div className={styles.progressSummaryValue}>{formatCurrency(currentResult.totalInterestPaid)}</div>
                </div>
                <div className={styles.progressSummaryCard}>
                  <div className={styles.progressSummaryLabel}>Debt-Free In</div>
                  <div className={styles.progressSummaryValue} style={{ color: 'var(--color-success)' }}>{currentResult.totalMonths} mo</div>
                </div>
              </div>

              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: 12 }}>Payoff Order ({strategy})</h3>
              {sortedDebts.map((d, i) => {
                const payoffMonth = currentResult.payoffDates[d.id] || currentResult.totalMonths
                const originalBalance = d.balance
                const pctOfTotal = totalDebt > 0 ? (originalBalance / totalDebt) * 100 : 0
                return (
                  <div key={d.id} className={styles.progressDebtRow}>
                    <div className={styles.progressDebtHeader}>
                      <span className={styles.progressDebtOrder}>{i + 1}</span>
                      <div className={styles.progressDebtInfo}>
                        <div className={styles.progressDebtName}>{d.name}</div>
                        <div className={styles.progressDebtMeta}>
                          {formatCurrency(originalBalance)} · {d.interestRate}% APR · Min {formatCurrency(d.minPayment)}
                        </div>
                      </div>
                      <div className={styles.progressDebtMonths}>
                        {payoffMonth} mo
                      </div>
                    </div>
                    <div className={styles.progressBar}>
                      <div className={styles.progressBarFill} style={{ width: `${pctOfTotal}%`, backgroundColor: i === 0 ? 'var(--color-warning)' : 'var(--color-primary)' }} />
                    </div>
                    <div className={styles.progressDebtReason}>
                      {strategy === 'avalanche'
                        ? `${d.interestRate}% APR — ${i === 0 ? 'highest interest, pay first' : 'lower priority'}`
                        : `${formatCurrency(originalBalance)} balance — ${i === 0 ? 'smallest balance, pay first' : 'larger balance, pay later'}`
                      }
                    </div>
                  </div>
                )
              })}

              {comparison.avalanche.totalMonths !== comparison.snowball.totalMonths && (
                <div className={styles.progressCompare}>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: 8 }}>Strategy Comparison</h3>
                  <div className={styles.progressCompareRow}>
                    <span>Avalanche</span>
                    <span>{comparison.avalanche.totalMonths} months · {formatCurrency(comparison.avalanche.totalInterestPaid)} interest</span>
                  </div>
                  <div className={styles.progressCompareRow}>
                    <span>Snowball</span>
                    <span>{comparison.snowball.totalMonths} months · {formatCurrency(comparison.snowball.totalInterestPaid)} interest</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
              <div className={styles.debtFooter}>
                {currentResult.payoffDates[d.id] && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Payoff in {currentResult.payoffDates[d.id]} months</span>}
                {i === 0 && (
                  <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-hint)' }}>
                    {strategy === 'avalanche' ? 'Highest interest rate' : 'Smallest balance'}
                  </span>
                )}
              </div>
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
