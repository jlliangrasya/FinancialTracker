import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { usePin } from './PinContext'
import { getPinKey } from '../utils/hashPin'
import { useState, useEffect } from 'react'
import { getUserSettings } from '../firebase/settings'

export default function ProtectedRoute({ children }) {
  const { currentUser, loading: authLoading } = useAuth()
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

  const hasPinStored = !!localStorage.getItem(getPinKey(currentUser.uid))
  const pinSetupDone = settings?.pinSetupCompleted && hasPinStored

  if (!pinSetupDone && location.pathname !== '/pin-setup') {
    return <Navigate to="/pin-setup" replace />
  }

  if (pinSetupDone && !isPinVerified && location.pathname !== '/pin') {
    return <Navigate to="/pin" replace />
  }

  if (!settings?.onboardingCompleted && location.pathname !== '/onboarding' && isPinVerified) {
    return <Navigate to="/onboarding" replace />
  }

  return children
}
