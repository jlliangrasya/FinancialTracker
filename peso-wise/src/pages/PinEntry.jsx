import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { usePin } from '../auth/PinContext'
import { getPinKey } from '../utils/hashPin'
import { PIN_QUOTE } from '../utils/verses'
import styles from './PinEntry.module.css'

export default function PinEntry() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(3)
  const [locked, setLocked] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [shaking, setShaking] = useState(false)
  const { currentUser, logout } = useAuth()
  const { checkPin } = usePin()
  const navigate = useNavigate()

  const hasPinStored = currentUser ? !!localStorage.getItem(getPinKey(currentUser.uid)) : false
  const firstName = currentUser?.displayName?.split(' ')[0] ||
                    currentUser?.email?.split('@')[0] || 'User'
  const initials = currentUser?.displayName
    ? currentUser.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : firstName[0].toUpperCase()

  useEffect(() => {
    if (!locked || countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setLocked(false)
          setAttempts(3)
          setError('')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [locked, countdown])

  const triggerShake = useCallback(() => {
    setShaking(true)
    setTimeout(() => setShaking(false), 400)
  }, [])

  async function handleDigit(digit) {
    if (locked) return
    if (pin.length >= 4) return
    const newPin = pin + digit
    setPin(newPin)
    setError('')

    if (newPin.length === 4) {
      const valid = await checkPin(newPin)
      if (valid) {
        navigate('/dashboard')
      } else {
        const remaining = attempts - 1
        setAttempts(remaining)
        triggerShake()
        if (remaining <= 0) {
          setLocked(true)
          setCountdown(30)
          setError('')
        } else {
          setError(`Incorrect PIN — ${remaining} attempt${remaining !== 1 ? 's' : ''} left`)
        }
        setTimeout(() => setPin(''), 400)
      }
    }
  }

  function handleBackspace() {
    if (locked) return
    setPin(pin.slice(0, -1))
    setError('')
  }

  async function handleSwitchAccount() {
    await logout()
    navigate('/login')
  }

  if (!hasPinStored) {
    return (
      <div className={styles.container}>
        <div className={styles.avatar}>{initials}</div>
        <h1 className={styles.greeting}>Welcome back, {firstName}</h1>
        <p className={styles.subtitle} style={{ marginBottom: 24 }}>
          Your PIN was cleared from this device (browser storage was reset). Please create a new PIN to continue.
        </p>
        <button className="btn-primary" style={{ width: '100%', maxWidth: 280 }} onClick={() => navigate('/pin-setup')}>
          Create new PIN
        </button>
        <button className={styles.switchAccount} onClick={handleSwitchAccount} style={{ marginTop: 16 }}>
          Switch account
        </button>
      </div>
    )
  }

  if (locked) {
    return (
      <div className={styles.container}>
        <div className={styles.lockout}>
          <div className={styles.lockIcon}>&#128274;</div>
          <p className={styles.lockMessage}>
            Account locked. Try again in {countdown} seconds.
          </p>
          <div className={styles.countdownBar}>
            <div
              className={styles.countdownFill}
              style={{ width: `${(countdown / 30) * 100}%` }}
            />
          </div>
          <button className={styles.switchAccount} onClick={handleSwitchAccount}>
            Sign in with email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.avatar}>{initials}</div>
      <h1 className={styles.greeting}>Welcome back, {firstName}</h1>
      <p className={styles.subtitle}>Enter your 4-digit PIN</p>

      <div className={styles.pinQuote}>
        <span className={styles.pinQuoteText}>"{PIN_QUOTE.quote}"</span>
        <span className={styles.pinQuoteRef}>{PIN_QUOTE.reference}</span>
      </div>

      <div className={`${styles.dots} ${shaking ? 'shake' : ''}`}>
        {[0,1,2,3].map(i => (
          <div
            key={i}
            className={`${styles.dot} ${i < pin.length ? styles.filled : ''} ${error ? styles.error : ''}`}
          />
        ))}
      </div>
      <p className={styles.errorText}>{error}</p>

      <div className={styles.numpad}>
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n} className={styles.numKey} onClick={() => handleDigit(String(n))}>
            {n}
          </button>
        ))}
        <div className={`${styles.numKey} ${styles.empty}`} />
        <button className={styles.numKey} onClick={() => handleDigit('0')}>0</button>
        <button className={`${styles.numKey} ${styles.backspace}`} onClick={handleBackspace}>
          &#9003;
        </button>
      </div>

      <button className={styles.switchAccount} onClick={handleSwitchAccount}>
        Switch account
      </button>
    </div>
  )
}
