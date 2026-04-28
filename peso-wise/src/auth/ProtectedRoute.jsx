import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { usePin } from './PinContext'
import { getPinKey } from '../utils/hashPin'
import { useState, useEffect } from 'react'
import { getUserSettings } from '../firebase/settings'
import { PAYMENT_GATE_ENABLED } from '../config'

export default function ProtectedRoute({ children }) {
  const { currentUser, loading: authLoading, userProfile } = useAuth()
  const { isPinVerified } = usePin()
  const location = useLocation()
  const [settings, setSettings] = useState(null)
  const [settingsLoading, setSettingsLoading] = useState(true)

  useEffect(() => {
    async function loadSettings() {
      if (currentUser) {
        try {
          const s = await getUserSettings(currentUser.uid)
          setSettings(s)
        } catch (e) {
          console.error('Failed to load settings:', e)
        }
      }
      setSettingsLoading(false)
    }
    if (currentUser) {
      loadSettings()
    } else {
      setSettingsLoading(false)
    }
  }, [currentUser])

  if (authLoading || settingsLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="skeleton" style={{ width: 48, height: 48, borderRadius: '50%' }} />
      </div>
    )
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const pinSetupDone = settings?.pinSetupCompleted

  // Let users complete PIN + onboarding first, even if pending
  if (!pinSetupDone && location.pathname !== '/pin-setup') {
    return <Navigate to="/pin-setup" replace />
  }

  if (pinSetupDone && !isPinVerified && location.pathname !== '/pin') {
    return <Navigate to="/pin" replace />
  }

  if (!settings?.onboardingCompleted && location.pathname !== '/onboarding' && isPinVerified) {
    return <Navigate to="/onboarding" replace />
  }

  // Only enforce approval AFTER setup is complete
  const accountStatus = userProfile?.status
  if (PAYMENT_GATE_ENABLED && settings?.onboardingCompleted && accountStatus === 'pending') {
    return <Navigate to="/pending-approval" replace />
  }
  if (accountStatus === 'rejected') {
    return <Navigate to="/rejected" replace />
  }

  return children
}

export function AdminRoute({ children }) {
  const { currentUser, loading: authLoading, isAdmin } = useAuth()

  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="skeleton" style={{ width: 48, height: 48, borderRadius: '50%' }} />
      </div>
    )
  }

  if (!currentUser || !isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
