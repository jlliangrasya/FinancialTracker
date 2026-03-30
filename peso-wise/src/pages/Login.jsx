import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getUserSettings, createUserSettings } from '../firebase/settings'
import { getPinKey } from '../utils/hashPin'
import styles from './Login.module.css'

export default function Login() {
  const [isSignup, setIsSignup] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const { login, signup, loginWithGoogle, resetPassword } = useAuth()
  const navigate = useNavigate()

  async function handleRouting(user) {
    let settings = await getUserSettings(user.uid)
    if (!settings) {
      settings = await createUserSettings(user.uid)
    }
    const hasPinStored = !!localStorage.getItem(getPinKey(user.uid))
    if (!settings.pinSetupCompleted || !hasPinStored) {
      navigate('/pin-setup')
    } else if (!settings.onboardingCompleted) {
      navigate('/onboarding')
    } else {
      navigate('/pin')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      let result
      if (isSignup) {
        result = await signup(email, password)
      } else {
        result = await login(email, password)
      }
      await handleRouting(result.user)
    } catch (err) {
      if (err.code === 'auth/user-not-found') setError('No account found with this email.')
      else if (err.code === 'auth/wrong-password') setError('Incorrect password.')
      else if (err.code === 'auth/invalid-credential') setError('Invalid email or password.')
      else if (err.code === 'auth/email-already-in-use') setError('Email is already registered.')
      else if (err.code === 'auth/weak-password') setError('Password must be at least 6 characters.')
      else if (err.code === 'auth/invalid-email') setError('Please enter a valid email address.')
      else setError(err.message)
    }
    setLoading(false)
  }

  async function handleGoogle() {
    setError('')
    setLoading(true)
    try {
      const result = await loginWithGoogle()
      await handleRouting(result.user)
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('Google sign-in failed. Try again.')
      }
    }
    setLoading(false)
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email first, then click forgot password.')
      return
    }
    try {
      await resetPassword(email)
      setResetSent(true)
      setError('')
    } catch {
      setError('Could not send reset email. Check the email address.')
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.logo}>P</div>
      <h1 className={styles.title}>Welcome to Peso Wise</h1>
      <p className={styles.subtitle}>Your personal finance tracker</p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Email</label>
          <input
            type="email"
            className="input-field"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Password</label>
          <div className={styles.passwordWrapper}>
            <input
              type={showPassword ? 'text' : 'password'}
              className="input-field"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              minLength={6}
            />
            <button
              type="button"
              className={styles.togglePassword}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {resetSent && <p style={{ color: 'var(--color-success)', fontSize: '0.8125rem' }}>Password reset email sent!</p>}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? <span className={styles.spinner} /> : (isSignup ? 'Sign up' : 'Sign in')}
        </button>

        <div className={styles.divider}>or</div>

        <button type="button" className={styles.googleBtn} onClick={handleGoogle} disabled={loading}>
          <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/><path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
          Continue with Google
        </button>

        <div className={styles.links}>
          <button type="button" className={styles.link} onClick={() => { setIsSignup(!isSignup); setError('') }}>
            {isSignup ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
          {!isSignup && (
            <button type="button" className={styles.link} onClick={handleForgotPassword}>
              Forgot password?
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
