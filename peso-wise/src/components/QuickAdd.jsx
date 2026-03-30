import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useToast } from './Toast'
import { addTransaction } from '../firebase/transactions'
import { addTransfer } from '../firebase/transfers'
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
  const { currentUser } = useAuth()
  const { showToast } = useToast()

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
        })
        showToast(isIncome ? 'Income saved \u2713' : 'Expense saved \u2713')
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
      <div className={styles.modal}>
        <div className={styles.handle} />
        <div className={styles.content}>
          <div className={styles.tabs}>
            {['expense', 'income', 'transfer'].map(tab => (
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
                <select className="select-field" value={category} onChange={e => { setCategory(e.target.value); setSubCategory('') }}>
                  <option value="">Select category</option>
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {category && EXPENSE_SUBCATEGORIES[category] && (
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Sub-category</label>
                  <select className="select-field" value={subCategory} onChange={e => setSubCategory(e.target.value)}>
                    <option value="">Select sub-category</option>
                    {EXPENSE_SUBCATEGORIES[category].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
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
                  {INCOME_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
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
            disabled={saving || !amount || Number(amount) <= 0}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </>
  )
}
