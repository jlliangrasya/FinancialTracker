import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  browserLocalPersistence,
  setPersistence,
  updateProfile,
} from 'firebase/auth'
import { auth, googleProvider } from '../firebase/config'
import { getUserSettings, updateUserSettings } from '../firebase/settings'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState(null)

  const refreshUserProfile = useCallback(async (uid) => {
    if (!uid) { setUserProfile(null); return }
    try {
      const profile = await getUserSettings(uid)
      if (profile) {
        // Migrate existing users who don't have role/status fields yet
        const patch = {}
        if (profile.role === undefined) patch.role = 'user'
        if (profile.status === undefined) patch.status = 'approved'
        if (Object.keys(patch).length > 0) {
          await updateUserSettings(uid, patch)
          Object.assign(profile, patch)
        }
        setUserProfile(profile)
      }
    } catch (e) {
      console.error('Failed to load user profile:', e)
    }
  }, [])

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(console.error)
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      if (user) {
        await refreshUserProfile(user.uid)
      } else {
        setUserProfile(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [refreshUserProfile])

  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password)
  }

  async function signup(email, password) {
    return createUserWithEmailAndPassword(auth, email, password)
  }

  async function loginWithGoogle() {
    return signInWithPopup(auth, googleProvider)
  }

  async function logout() {
    return signOut(auth)
  }

  async function resetPassword(email) {
    return sendPasswordResetEmail(auth, email)
  }

  async function updateDisplayName(name) {
    await updateProfile(auth.currentUser, { displayName: name })
    setCurrentUser({ ...auth.currentUser })
  }

  const isAdmin = userProfile?.role === 'superadmin'

  const value = {
    currentUser,
    loading,
    userProfile,
    isAdmin,
    refreshUserProfile,
    login,
    signup,
    loginWithGoogle,
    logout,
    resetPassword,
    updateDisplayName,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
