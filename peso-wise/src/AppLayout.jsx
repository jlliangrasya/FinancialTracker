import { useState, useEffect, useRef } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { getUserSettings } from './firebase/settings'
import BottomNav from './components/BottomNav'
import QuickAdd from './components/QuickAdd'
import styles from './AppLayout.module.css'

export default function AppLayout() {
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [banks, setBanks] = useState([])
  const [featureFlags, setFeatureFlags] = useState({})
  const onTransactionAddedRef = useRef(null)
  const { currentUser } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    async function loadSettings() {
      if (!currentUser) return
      try {
        const settings = await getUserSettings(currentUser.uid)
        setBanks(settings?.banks || [])
        setFeatureFlags({
          businessMode: settings?.businessMode || false,
          couplesMode: settings?.couplesMode || false,
        })
      } catch (err) {
        console.error(err)
      }
    }
    loadSettings()
  }, [currentUser])

  function handleSaved(type, amount, newTransaction) {
    if (newTransaction && onTransactionAddedRef.current) {
      onTransactionAddedRef.current(newTransaction)
    }
    if (type === 'income' && amount > 0) {
      navigate(`/paycheck-allocator?amount=${amount}`)
    }
  }

  return (
    <>
      <div className={styles.content}>
        <Outlet context={{ onTransactionAddedRef }} />
      </div>
      <QuickAdd
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        banks={banks}
        onSaved={handleSaved}
      />
      <BottomNav onAddClick={() => setQuickAddOpen(true)} featureFlags={featureFlags} />
    </>
  )
}
