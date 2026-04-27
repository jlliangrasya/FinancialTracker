import { useState, useRef, useCallback, useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useToast } from './Toast'
import { addTransaction } from '../firebase/transactions'
import { addTransfer } from '../firebase/transfers'
import { getUserSettings } from '../firebase/settings'
import { getSavingsGoals, updateSavingsGoal } from '../firebase/savingsGoals'
import { getBills, markBillPaid } from '../firebase/bills'
import { getCurrentMonthString } from '../utils/dateHelpers'
import { formatCurrency } from '../utils/formatCurrency'
import {
  EXPENSE_CATEGORIES, EXPENSE_SUBCATEGORIES,
  INCOME_CATEGORIES, PAYMENT_METHODS
} from '../utils/categories'
import styles from './QuickAdd.module.css'

export default function QuickAdd({ open, onClose, banks, onSaved }) {
  const [activeTab, setActiveTab] = useState('expense')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [subCategory, setSubCategory] = useState('')
  const [bank, setBank] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [fromBank, setFromBank] = useState('')
  const [toBank, setToBank] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [customIncomeCategories, setCustomIncomeCategories] = useState([])
  const [customExpenseCategories, setCustomExpenseCategories] = useState([])
  const [savingsPercentage, setSavingsPercentage] = useState(0)
  const [incomeAllocation, setIncomeAllocation] = useState([])
  const [savingsGoals, setSavingsGoals] = useState([])
  const [selectedGoalId, setSelectedGoalId] = useState('')
  const [bills, setBills] = useState([])
  const [selectedBillId, setSelectedBillId] = useState('')
  const { currentUser } = useAuth()
  const { showToast } = useToast()

  useEffect(() => {
    if (!currentUser) return
    getUserSettings(currentUser.uid).then(s => {
      if (s?.customIncomeCategories?.length) setCustomIncomeCategories(s.customIncomeCategories)
      if (s?.customExpenseCategories?.length) setCustomExpenseCategories(s.customExpenseCategories)
      if (s?.savingsPercentage) setSavingsPercentage(s.savingsPercentage)
      if (s?.incomeAllocation?.length) {
        setIncomeAllocation(s.incomeAllocation.filter(a => a.percentage > 0))
      } else if (s?.savingsPercentage > 0) {
        setIncomeAllocation([{ label: 'Savings', percentage: s.savingsPercentage }])
      }
    }).catch(() => {})
    getSavingsGoals(currentUser.uid).then(g => setSavingsGoals(g || [])).catch(() => {})
    getBills(currentUser.uid).then(b => setBills((b || []).filter(b => b.isActive))).catch(() => {})
  }, [currentUser])

  const allIncomeCategories = [...INCOME_CATEGORIES, ...customIncomeCategories]
  const allExpenseCategories = [...EXPENSE_CATEGORIES, ...customExpenseCategories]

  const modalRef = useRef(null)
  const dragStart = useRef(null)
  const dragY = useRef(0)

  const handleTouchStart = useCallback((e) => {
    dragStart.current = e.touches[0].clientY
    dragY.current = 0
  }, [])

  const handleTouchMove = useCallback((e) => {
    if (dragStart.current === null) return
    const diff = e.touches[0].clientY - dragStart.current
    if (diff > 0) {
      dragY.current = diff
      if (modalRef.current) {
        modalRef.current.style.transform = `translateY(${diff}px)`
        modalRef.current.style.transition = 'none'
      }
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (dragY.current > 120) {
      if (modalRef.current) {
        modalRef.current.style.transition = 'transform 0.25s ease'
        modalRef.current.style.transform = 'translateY(100%)'
      }
      setTimeout(onClose, 250)
    } else {
      if (modalRef.current) {
        modalRef.current.style.transition = 'transform 0.25s ease'
        modalRef.current.style.transform = 'translateY(0)'
      }
    }
    dragStart.current = null
    dragY.current = 0
  }, [onClose])

  if (!open) return null

  const bankNames = (banks || []).map(b => b.name)

  function resetForm() {
    setAmount('')
    setDescription('')
    setCategory('')
    setSubCategory('')
    setBank('')
    setPaymentMethod('Cash')
    setDate(new Date().toISOString().split('T')[0])
    setFromBank('')
    setToBank('')
    setNote('')
    setSelectedGoalId('')
    setSelectedBillId('')
  }

  async function handleSave() {
    if (!amount || Number(amount) <= 0) return
    setSaving(true)
    try {
      if (activeTab === 'transfer') {
        await addTransfer(currentUser.uid, {
          fromBank,
          toBank,
          amount: Number(amount),
          note,
          date,
        })
        showToast('Transfer complete \u2713')
      } else if (activeTab === 'savings') {
        const goal = savingsGoals.find(g => g.id === selectedGoalId)
        if (!goal) { showToast('Select a savings goal', 'error'); setSaving(false); return }
        // Only manually update savedAmount if the goal is NOT linked to a bank
        // (linked goals derive savedAmount from bank balance automatically)
        if (!goal.linkedBank) {
          await updateSavingsGoal(selectedGoalId, { savedAmount: (goal.savedAmount || 0) + Number(amount) })
        }
        await addTransaction(currentUser.uid, {
          type: 'expense',
          amount: Number(amount),
          description: `Savings: ${goal.name}`,
          category: 'Savings Contribution',
          subCategory: goal.name,
          bank: bank || goal.bank || bankNames[0] || '',
          paymentMethod: '',
          isIncome: false,
          date,
          periodId: null,
        })
        showToast(`${formatCurrency(Number(amount))} added to ${goal.name}${goal.linkedBank ? ' (bank balance will update)' : ''} \u2713`)
      } else {
        const isIncome = activeTab === 'income'
        await addTransaction(currentUser.uid, {
          type: isIncome ? 'income' : 'expense',
          amount: Number(amount),
          description: description || (isIncome ? category : description),
          category,
          subCategory: isIncome ? '' : subCategory,
          bank: bank || bankNames[0] || '',
          paymentMethod: isIncome ? '' : paymentMethod,
          isIncome,
          date,
          periodId: null,
          billId: selectedBillId || null,
        })
        if (selectedBillId) {
          await markBillPaid(selectedBillId, getCurrentMonthString(), Number(amount))
          showToast('Expense saved & bill marked as paid \u2713')
        } else {
          showToast(isIncome ? 'Income saved \u2713' : 'Expense saved \u2713')
        }
      }
      resetForm()
      if (onSaved) onSaved(activeTab, Number(amount))
      onClose()
    } catch (err) {
      showToast('Failed to save. Check your connection.', 'error')
      console.error(err)
    }
    setSaving(false)
  }

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.modal} ref={modalRef}>
        <div
          className={styles.handleArea}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className={styles.handle} />
        </div>
        <div className={styles.content}>
          <div className={styles.tabs}>
            {['expense', 'income', 'savings', 'transfer'].map(tab => (
              <button
                key={tab}
                className={`${styles.tab} ${activeTab === tab ? styles.active : ''}`}
                onClick={() => { setActiveTab(tab); resetForm() }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <input
            type="number"
            className={styles.amountInput}
            placeholder="\u20B10.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            autoFocus
            inputMode="decimal"
          />

          {activeTab === 'expense' && (
            <>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Category</label>
                <select className="select-field" value={category} onChange={e => { setCategory(e.target.value); setSubCategory(''); setSelectedBillId('') }}>
                  <option value="">Select category</option>
                  {allExpenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {category && (EXPENSE_SUBCATEGORIES[category] || category === 'Bills & Utilities') && (
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Sub-category</label>
                  <select
                    className="select-field"
                    value={subCategory}
                    onChange={e => {
                      const val = e.target.value
                      setSubCategory(val)
                      // Check if a bill was selected (prefixed with 'bill::')
                      if (val.startsWith('bill::')) {
                        const billId = val.slice(6)
                        const bill = bills.find(b => b.id === billId)
                        setSelectedBillId(billId)
                        if (bill) {
                          setAmount(String(bill.amount))
                          setDescription(bill.name)
                        }
                      } else {
                        setSelectedBillId('')
                      }
                    }}
                  >
                    <option value="">Select sub-category</option>
                    {(EXPENSE_SUBCATEGORIES[category] || []).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                    {category === 'Bills & Utilities' && bills.length > 0 && (
                      <>
                        <option disabled>── Your Bills ──</option>
                        {bills.map(b => {
                          const monthStr = getCurrentMonthString()
                          const alreadyPaid = b.paidMonths?.includes(monthStr)
                          return (
                            <option key={b.id} value={`bill::${b.id}`}>
                              {b.name} — {formatCurrency(b.amount)}{alreadyPaid ? ' ✓ paid' : ''}
                            </option>
                          )
                        })}
                      </>
                    )}
                  </select>
                  {selectedBillId && (
                    <div className={styles.billSelectedNote}>
                      Amount and description auto-filled. Saving will mark this bill as paid for this month.
                    </div>
                  )}
                </div>
              )}
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Bank/Wallet</label>
                  <select className="select-field" value={bank} onChange={e => setBank(e.target.value)}>
                    <option value="">Select</option>
                    {bankNames.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Payment</label>
                  <select className="select-field" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                    {PAYMENT_METHODS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Date</label>
                <input type="date" className="input-field" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Description (optional)</label>
                <input type="text" className="input-field" value={description} onChange={e => setDescription(e.target.value)} placeholder="What was this for?" />
              </div>
            </>
          )}

          {activeTab === 'income' && (
            <>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Source / Payer</label>
                <input type="text" className="input-field" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Company Name" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Category</label>
                <select className="select-field" value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="">Select category</option>
                  {allIncomeCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Bank received in</label>
                <select className="select-field" value={bank} onChange={e => setBank(e.target.value)}>
                  <option value="">Select bank</option>
                  {bankNames.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Date</label>
                <input type="date" className="input-field" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Notes (optional)</label>
                <input type="text" className="input-field" value={note} onChange={e => setNote(e.target.value)} />
              </div>
              {incomeAllocation.length > 0 && Number(amount) > 0 && (
                <div className={styles.savingsNote}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Allocation from this income:</div>
                  {incomeAllocation.map(a => (
                    <div key={a.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', padding: '2px 0' }}>
                      <span>{a.label} ({a.percentage}%)</span>
                      <strong>{formatCurrency(Number(amount) * a.percentage / 100)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'savings' && (
            <>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Savings Goal</label>
                <select className="select-field" value={selectedGoalId} onChange={e => {
                  setSelectedGoalId(e.target.value)
                  const goal = savingsGoals.find(g => g.id === e.target.value)
                  if (goal?.bank) setBank(goal.bank)
                }}>
                  <option value="">Select a goal</option>
                  {savingsGoals.map(g => {
                    const saved = formatCurrency(g.savedAmount || 0)
                    const label = g.targetAmount > 0
                      ? `${g.name} — ${((Math.min((g.savedAmount || 0) / g.targetAmount, 1)) * 100).toFixed(0)}% (${saved} of ${formatCurrency(g.targetAmount)})`
                      : `${g.name} — ${saved} saved`
                    return <option key={g.id} value={g.id}>{label}</option>
                  })}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Bank/Wallet</label>
                <select className="select-field" value={bank} onChange={e => setBank(e.target.value)}>
                  <option value="">Select</option>
                  {bankNames.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Date</label>
                <input type="date" className="input-field" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              {savingsGoals.length === 0 && (
                <div className={styles.savingsHint}>No savings goals yet. Go to Savings Goals to create one.</div>
              )}
            </>
          )}

          {activeTab === 'transfer' && (
            <>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>From</label>
                  <select className="select-field" value={fromBank} onChange={e => setFromBank(e.target.value)}>
                    <option value="">Select bank</option>
                    {bankNames.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className={styles.transferArrow}>{'\u2192'}</div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>To</label>
                  <select className="select-field" value={toBank} onChange={e => setToBank(e.target.value)}>
                    <option value="">Select bank</option>
                    {bankNames.filter(b => b !== fromBank).map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Date</label>
                <input type="date" className="input-field" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Purpose / Note (optional)</label>
                <input type="text" className="input-field" value={note} onChange={e => setNote(e.target.value)} />
              </div>
            </>
          )}

          <button
            className={`btn-primary ${styles.saveBtn}`}
            onClick={handleSave}
            disabled={saving || !amount || Number(amount) <= 0 || (activeTab === 'savings' && !selectedGoalId)}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </>
  )
}
