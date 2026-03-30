import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { verifyPin as verifyPinUtil } from '../utils/hashPin'

const PinContext = createContext()

export function usePin() {
  return useContext(PinContext)
}

export function PinProvider({ children }) {
  const { currentUser } = useAuth()
  const [isPinVerified, setIsPinVerified] = useState(false)

  const resetPinVerified = useCallback(() => {
    setIsPinVerified(false)
  }, [])

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        resetPinVerified()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [resetPinVerified])

  useEffect(() => {
    if (!currentUser) {
      setIsPinVerified(false)
    }
  }, [currentUser])

  async function checkPin(pin) {
    if (!currentUser) return false
    const valid = await verifyPinUtil(currentUser.uid, pin)
    if (valid) {
      setIsPinVerified(true)
    }
    return valid
  }

  const value = {
    isPinVerified,
    checkPin,
    resetPinVerified,
  }

  return (
    <PinContext.Provider value={value}>
      {children}
    </PinContext.Provider>
  )
}
