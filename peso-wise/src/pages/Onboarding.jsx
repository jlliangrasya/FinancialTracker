import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { updateUserSettings, getUserSettings, createUserSettings } from '../firebase/settings'
import { addBudget } from '../firebase/budgets'
import { addBill } from '../firebase/bills'
import { useToast } from '../components/Toast'
import { DEFAULT_BANKS, EXPENSE_CATEGORIES, BILL_FREQUENCIES } from '../utils/categories'
import styles from './Onboarding.module.css'

export default function Onboarding() {
  const [step, setStep] = useState(1)
  const [banks, setBanks] = useState(
    DEFAULT_BANKS.map(name => ({ name, selected: true, openingBalance: 0, color: getColor(name) }))
  )
  const [customBankName, setCustomBankName] = useState('')
  const [showAddBank, setShowAddBank] = useState(false)
  const [budgetLimits, setBudgetLimits] = useState(
    Object.fromEntries(EXPENSE_CATEGORIES.map(c => [c, '']))
  )
  const [billsList, setBillsList] = useState([])
  const [saving, setSaving] = useState(false)
  const { currentUser } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  function getColor(name) {
    const colors = { EastWest: '#1565C0', Maribank: '#E65100', GCash: '#2E7D32', PNB: '#C62828' }
    return colors[name] || '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')
  }

  function toggleBank(index) {
    setBanks(prev => prev.map((b, i) => i === index ? { ...b, selected: !b.selected } : b))
  }

  function updateBalance(index, value) {
    setBanks(prev => prev.map((b, i) => i === index ? { ...b, openingBalance: Number(value) || 0 } : b))
  }

  function addCustomBank() {
    if (!customBankName.trim()) return
    setBanks(prev => [...prev, { name: customBankName.trim(), selected: true, openingBalance: 0, color: getColor(customBankName) }])
    setCustomBankName('')
    setShowAddBank(false)
  }

  function addNewBill() {
    setBillsList(prev => [...prev, { name: '', amount: '', dueDay: '', frequency: 'Monthly', bank: '', category: 'Bills & Utilities' }])
  }

  function updateBill(index, field, value) {
    setBillsList(prev => prev.map((b, i) => i === index ? { ...b, [field]: value } : b))
  }

  function removeBill(index) {
    setBillsList(prev => prev.filter((_, i) => i !== index))
  }

  async function handleComplete() {
    setSaving(true)
    try {
      const selectedBanks = banks.filter(b => b.selected).map(b => ({
        name: b.name,
        openingBalance: b.openingBalance,
        color: b.color,
      }))

      let settings = await getUserSettings(currentUser.uid)
      if (!settings) {
        await createUserSettings(currentUser.uid, {
          banks: selectedBanks,
          onboardingCompleted: true,
          pinSetupCompleted: true,
        })
      } else {
        await updateUserSettings(currentUser.uid, {
          banks: selectedBanks,
          onboardingCompleted: true,
        })
      }

      for (const [category, limit] of Object.entries(budgetLimits)) {
        if (limit && Number(limit) > 0) {
          await addBudget(currentUser.uid, { category, monthlyLimit: Number(limit) })
        }
      }

      const bankNames = selectedBanks.map(b => b.name)
      for (const bill of billsList) {
        if (bill.name && bill.amount) {
          await addBill(currentUser.uid, {
            name: bill.name,
            amount: Number(bill.amount),
            dueDay: Number(bill.dueDay) || 1,
            frequency: bill.frequency,
            bank: bill.bank || bankNames[0] || '',
            category: bill.category,
          })
        }
      }

      showToast('Setup complete ✓')
      navigate('/dashboard')
    } catch (err) {
      showToast('Failed to save. Try again.', 'error')
      console.error(err)
    }
    setSaving(false)
  }

  const selectedBankNames = banks.filter(b => b.selected).map(b => b.name)

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.stepLabel}>Step {step} of 3</span>
        {step < 3 && (
          <button className={styles.skipBtn} onClick={() => setStep(step + 1)}>
            Skip for now
          </button>
        )}
      </div>

      <div className={styles.progressBar}>
        {[1, 2, 3].map(s => (
          <div key={s} className={`${styles.segment} ${s <= step ? styles.active : ''}`} />
        ))}
      </div>

      {step === 1 && (
        <>
          <h1 className={styles.title}>Which banks do you use?</h1>
          <p className={styles.subtitle}>Enter your current balance in each account</p>
          <div className={styles.bankList}>
            {banks.map((bank, i) => (
              <div key={bank.name} className={`${styles.bankItem} ${bank.selected ? styles.selected : ''}`}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={bank.selected}
                  onChange={() => toggleBank(i)}
                />
                <span className={styles.bankName}>{bank.name}</span>
                {bank.selected && (
                  <input
                    type="number"
                    className={styles.balanceInput}
                    placeholder="₱0.00"
                    value={bank.openingBalance || ''}
                    onChange={e => updateBalance(i, e.target.value)}
                    inputMode="decimal"
                  />
                )}
              </div>
            ))}
          </div>
          {showAddBank ? (
            <div className={styles.addBankInput}>
              <input
                type="text"
                className="input-field"
                placeholder="Bank name"
                value={customBankName}
                onChange={e => setCustomBankName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomBank()}
              />
              <button className="btn-primary" style={{ width: 'auto', padding: '8px 16px' }} onClick={addCustomBank}>Add</button>
            </div>
          ) : (
            <button className={styles.addCustom} onClick={() => setShowAddBank(true)}>
              + Add custom bank
            </button>
          )}
          <div className={styles.footer}>
            <button className="btn-primary" onClick={() => setStep(2)}>
              Next
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className={styles.title}>Set your monthly budget per category</h1>
          <p className={styles.subtitle}>How much do you want to spend per category each month?</p>
          <div className={styles.categoryList}>
            {EXPENSE_CATEGORIES.map(cat => (
              <div key={cat} className={styles.categoryRow}>
                <span className={styles.categoryLabel}>{cat}</span>
                <input
                  type="number"
                  className={styles.balanceInput}
                  placeholder="₱0"
                  value={budgetLimits[cat]}
                  onChange={e => setBudgetLimits(prev => ({ ...prev, [cat]: e.target.value }))}
                  inputMode="decimal"
                />
              </div>
            ))}
          </div>
          <div className={styles.footer}>
            <button className="btn-secondary" onClick={() => setStep(1)}>Back</button>
            <button className="btn-primary" onClick={() => setStep(3)}>Next</button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h1 className={styles.title}>Add your regular bills</h1>
          <p className={styles.subtitle}>Track recurring payments so you never miss a due date</p>
          {billsList.map((bill, i) => (
            <div key={i} className={styles.billItem}>
              <div className={styles.billForm}>
                <input type="text" className="input-field" placeholder="Bill name (e.g. Meralco)" value={bill.name} onChange={e => updateBill(i, 'name', e.target.value)} />
                <div className={styles.billRow}>
                  <input type="number" className="input-field" placeholder="Amount" value={bill.amount} onChange={e => updateBill(i, 'amount', e.target.value)} inputMode="decimal" />
                  <input type="number" className="input-field" placeholder="Due day" min="1" max="31" value={bill.dueDay} onChange={e => updateBill(i, 'dueDay', e.target.value)} />
                </div>
                <div className={styles.billRow}>
                  <select className="select-field" value={bill.frequency} onChange={e => updateBill(i, 'frequency', e.target.value)}>
                    {BILL_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <select className="select-field" value={bill.bank} onChange={e => updateBill(i, 'bank', e.target.value)}>
                    <option value="">Bank</option>
                    {selectedBankNames.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <button className={styles.removeBill} onClick={() => removeBill(i)}>Remove</button>
              </div>
            </div>
          ))}
          <button className={styles.addCustom} onClick={addNewBill} style={{ marginBottom: 16 }}>
            + Add bill
          </button>
          <div className={styles.footer}>
            <button className="btn-secondary" onClick={() => setStep(2)}>Back</button>
            <button className="btn-primary" onClick={handleComplete} disabled={saving}>
              {saving ? 'Setting up...' : 'Complete Setup'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
