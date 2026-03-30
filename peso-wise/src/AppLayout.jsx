import { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { getUserSettings } from './firebase/settings'
import BottomNav from './components/BottomNav'
import QuickAdd from './components/QuickAdd'

export default function AppLayout() {
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [banks, setBanks] = useState([])
  const { currentUser } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    async function loadBanks() {
      if (!currentUser) return
      try {
        const settings = await getUserSettings(currentUser.uid)
        setBanks(settings?.banks || [])
      } catch (err) {
        console.error(err)
      }
    }
    loadBanks()
  }, [currentUser])

  function handleSaved(type, amount) {
    if (type === 'income' && amount > 0) {
      navigate(`/paycheck-allocator?amount=${amount}`)
    }
  }

  return (
    <>
      <Outlet />
      <QuickAdd
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        banks={banks}
        onSaved={handleSaved}
      />
      <BottomNav onAddClick={() => setQuickAddOpen(true)} />
    </>
  )
}
