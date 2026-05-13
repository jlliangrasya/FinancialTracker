import { useState, useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import { getLoans, addLoan, deleteLoan, markLoanPayment, unmarkLoanPayment } from '../firebase/loans'

import { calculateAmortizationSchedule, getLoanSummary } from '../engine/loanAmortization'
import { formatCurrency } from '../utils/formatCurrency'
import { useToast } from '../components/Toast'
import styles from './LoanTracker.module.css'

const LOAN_TYPES = ['PAG-IBIG', 'SSS', 'Bank Personal Loan', 'Credit Card Installment', '5-6']
const FREQ_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'daily', label: 'Daily (5-6)' },
]

const TYPE_COLORS = {
  'PAG-IBIG': 'var(--color-primary)',
  'SSS': 'var(--color-success)',
  'Bank Personal Loan': 'var(--color-warning)',
  'Credit Card Installment': '#9b59b6',
  '5-6': 'var(--color-danger)',
}

export default function LoanTracker() {
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedLoan, setSelectedLoan] = useState(null)
  const [saving, setSaving] = useState(false)

  const [loanName, setLoanName] = useState('')
  const [loanType, setLoanType] = useState('PAG-IBIG')
  const [principalAmount, setPrincipalAmount] = useState('')
  const [interestRate, setInterestRate] = useState('')
  const [termMonths, setTermMonths] = useState('')
  const [startDate, setStartDate] = useState('')
  const [paymentFrequency, setPaymentFrequency] = useState('monthly')
  const [notes, setNotes] = useState('')

  const { currentUser } = useAuth()
  const { showToast } = useToast()

  useEffect(() => { loadData() }, [currentUser])

  async function loadData() {
    if (!currentUser) return
    setLoading(true)
    try { setLoans(await getLoans(currentUser.uid)) } catch (err) { console.error(err) }
    setLoading(false)
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!loanName || !principalAmount || !termMonths || !startDate) return
    setSaving(true)
    try {
      await addLoan(currentUser.uid, {
        loanName, loanType,
        principalAmount: Number(principalAmount),
        interestRate: Number(interestRate) || 0,
        termMonths: Number(termMonths),
        startDate,
        paymentFrequency: loanType === '5-6' ? paymentFrequency : 'monthly',
        notes,
      })
      showToast('Loan added ✓')
      resetForm()
      await loadData()
    } catch (err) { showToast('Failed to add loan', 'error') }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this loan?')) return
    try { await deleteLoan(id); await loadData(); showToast('Loan deleted') }
    catch (err) { showToast('Failed to delete', 'error') }
  }

  async function handleTogglePeriod(loan, period) {
    const paidSet = new Set((loan.paidPeriods || []).map(p => p.periodNumber))
    try {
      if (paidSet.has(period.periodNumber)) {
        await unmarkLoanPayment(loan.id, period.periodNumber)
      } else {
        await markLoanPayment(loan.id, period.periodNumber, period.paymentAmount)
      }
      const fresh = await getLoans(currentUser.uid)
      setLoans(fresh)
      setSelectedLoan(prev => prev?.id === loan.id ? (fresh.find(l => l.id === loan.id) ?? prev) : prev)
    } catch (err) { showToast('Failed to update payment', 'error') }
  }

  function resetForm() {
    setLoanName(''); setLoanType('PAG-IBIG'); setPrincipalAmount('')
    setInterestRate(''); setTermMonths(''); setStartDate('')
    setPaymentFrequency('monthly'); setNotes(''); setShowForm(false)
  }

  if (loading) return (
    <div>
      {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 10, marginBottom: 10 }} />)}
    </div>
  )

  return (
    <div>
      <button className={styles.addBtn} onClick={() => setShowForm(!showForm)}>+ Add loan</button>

      {showForm && (
        <form className={styles.addForm} onSubmit={handleAdd}>
          <h3>New Loan</h3>
          <div className={styles.formGrid}>
            <input type="text" className="input-field" placeholder="Loan name (e.g. PAG-IBIG Housing)" value={loanName} onChange={e => setLoanName(e.target.value)} required />
            <select className="select-field" value={loanType} onChange={e => { setLoanType(e.target.value); if (e.target.value === '5-6') setInterestRate('') }}>
              {LOAN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className={styles.formRow}>
              <input type="number" className="input-field" placeholder="Principal amount" value={principalAmount} onChange={e => setPrincipalAmount(e.target.value)} inputMode="decimal" required />
              {loanType !== '5-6' && (
                <input type="number" className="input-field" placeholder="Interest % (APR)" value={interestRate} onChange={e => setInterestRate(e.target.value)} inputMode="decimal" />
              )}
            </div>
            <div className={styles.formRow}>
              <input type="number" className="input-field" placeholder="Term (months)" value={termMonths} onChange={e => setTermMonths(e.target.value)} inputMode="numeric" required />
              <input type="date" className="input-field" value={startDate} onChange={e => setStartDate(e.target.value)} required />
            </div>
            {loanType === '5-6' && (
              <div>
                <label className={styles.fieldLabel}>Collection frequency</label>
                <select className="select-field" value={paymentFrequency} onChange={e => setPaymentFrequency(e.target.value)}>
                  {FREQ_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <div className={styles.fiveSixNote}>5-6 uses flat 20% interest. Total repayable = Principal × 1.2</div>
              </div>
            )}
            <input type="text" className="input-field" placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
            <div className={styles.formRow}>
              <button type="button" className="btn-secondary" onClick={resetForm}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Adding...' : 'Add Loan'}</button>
            </div>
          </div>
        </form>
      )}

      {loans.length === 0 && !showForm && (
        <div className={styles.empty}>No loans tracked. Add your first one above.</div>
      )}

      <div className={styles.loanList}>
        {loans.map(loan => {
          const schedule = calculateAmortizationSchedule(loan)
          const summary = getLoanSummary(loan, schedule)
          const color = TYPE_COLORS[loan.loanType] || 'var(--color-primary)'
          return (
            <div key={loan.id} className={styles.loanCard}>
              <div className={styles.loanHeader}>
                <div>
                  <span className={styles.loanTypeBadge} style={{ backgroundColor: color + '22', color }}>
                    {loan.loanType}
                  </span>
                  <div className={styles.loanName}>{loan.loanName}</div>
                </div>
                <button className={styles.deleteBtn} onClick={() => handleDelete(loan.id)}>✕</button>
              </div>

              <div className={styles.loanAmounts}>
                <div>
                  <div className={styles.amountLabel}>Principal</div>
                  <div className={styles.amountValue}>{formatCurrency(loan.principalAmount)}</div>
                </div>
                <div>
                  <div className={styles.amountLabel}>Remaining</div>
                  <div className={styles.amountValue} style={{ color: 'var(--color-danger)' }}>{formatCurrency(summary.remainingBalance)}</div>
                </div>
                <div>
                  <div className={styles.amountLabel}>Next Due</div>
                  <div className={styles.amountValue} style={{ fontSize: '0.8125rem' }}>
                    {summary.nextDueDate ?? 'Fully paid'}
                  </div>
                </div>
              </div>

              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${summary.progressPct}%`, backgroundColor: color }} />
              </div>
              <div className={styles.progressMeta}>
                <span>{summary.paidCount} of {summary.totalPeriods} payments</span>
                <span>{summary.progressPct}%</span>
              </div>

              {summary.overdueCount > 0 && (
                <div className={styles.overdueBadge}>{summary.overdueCount} overdue payment{summary.overdueCount > 1 ? 's' : ''}</div>
              )}

              <button className={styles.viewScheduleBtn} onClick={() => setSelectedLoan(loan)}>
                View Amortization Schedule
              </button>
            </div>
          )
        })}
      </div>

      {selectedLoan && (() => {
        const schedule = calculateAmortizationSchedule(selectedLoan)
        const summary = getLoanSummary(selectedLoan, schedule)
        const paidSet = new Set((selectedLoan.paidPeriods || []).map(p => p.periodNumber))
        const freshLoan = loans.find(l => l.id === selectedLoan.id) ?? selectedLoan
        const freshPaidSet = new Set((freshLoan.paidPeriods || []).map(p => p.periodNumber))

        return (
          <div className={styles.modalOverlay} onClick={() => setSelectedLoan(null)}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <div>
                  <h2 className={styles.modalTitle}>{selectedLoan.loanName}</h2>
                  <div className={styles.modalSubtitle}>{selectedLoan.loanType} · {formatCurrency(selectedLoan.principalAmount)}</div>
                </div>
                <button className={styles.modalClose} onClick={() => setSelectedLoan(null)}>✕</button>
              </div>

              <div className={styles.modalSummary}>
                <div className={styles.modalSummaryCard}>
                  <div className={styles.modalSummaryLabel}>Total Payable</div>
                  <div className={styles.modalSummaryValue}>{formatCurrency(summary.totalPayable)}</div>
                </div>
                <div className={styles.modalSummaryCard}>
                  <div className={styles.modalSummaryLabel}>Total Interest</div>
                  <div className={styles.modalSummaryValue} style={{ color: 'var(--color-warning)' }}>{formatCurrency(summary.totalInterest)}</div>
                </div>
                <div className={styles.modalSummaryCard}>
                  <div className={styles.modalSummaryLabel}>Remaining</div>
                  <div className={styles.modalSummaryValue} style={{ color: 'var(--color-danger)' }}>{formatCurrency(summary.remainingBalance)}</div>
                </div>
              </div>

              {selectedLoan.loanType === '5-6' && (
                <div className={styles.fiveSixHighlight}>
                  Collection per period: <strong>{formatCurrency(schedule[0]?.paymentAmount ?? 0)}</strong>
                  <span> ({selectedLoan.paymentFrequency})</span>
                </div>
              )}

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Date</th>
                      <th>Payment</th>
                      <th>Principal</th>
                      <th>Interest</th>
                      <th>Balance</th>
                      <th>Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map(period => {
                      const isPaid = freshPaidSet.has(period.periodNumber)
                      return (
                        <tr key={period.periodNumber} className={isPaid ? styles.paidRow : ''}>
                          <td>{period.periodNumber}</td>
                          <td>{period.paymentDate}</td>
                          <td>{formatCurrency(period.paymentAmount)}</td>
                          <td className={styles.principal}>{formatCurrency(period.principalPortion)}</td>
                          <td className={styles.interest}>{formatCurrency(period.interestPortion)}</td>
                          <td>{formatCurrency(period.remainingBalance)}</td>
                          <td>
                            <input
                              type="checkbox"
                              checked={isPaid}
                              onChange={() => handleTogglePeriod(freshLoan, period)}
                              className={styles.checkbox}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
