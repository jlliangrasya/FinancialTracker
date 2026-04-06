import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { savePin } from '../utils/hashPin'
import { getUserSettings, createUserSettings, updateUserSettings } from '../firebase/settings'
import styles from './PinSetup.module.css'

export default function PinSetup() {
  const [step, setStep] = useState(1)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [shaking, setShaking] = useState(false)
  const { currentUser } = useAuth()
  const navigate = useNavigate()

  const currentPin = step === 1 ? pin : confirmPin
  const setCurrentPin = step === 1 ? setPin : setConfirmPin

  function validatePin(value) {
    if (value.length !== 4) return false
    const allSame = value.split('').every(d => d === value[0])
    if (allSame) return 'PIN too simple. Avoid patterns like 1111.'
    const digits = value.split('').map(Number)
    const isSequentialAsc = digits.every((d, i) => i === 0 || d === digits[i-1] + 1)
    const isSequentialDesc = digits.every((d, i) => i === 0 || d === digits[i-1] - 1)
    if (isSequentialAsc || isSequentialDesc) return 'PIN too simple. Avoid patterns like 1234.'
    return true
  }

  const triggerShake = useCallback(() => {
    setShaking(true)
    setTimeout(() => setShaking(false), 400)
  }, [])

  function handleDigit(digit) {
    if (currentPin.length >= 4) return
    const newPin = currentPin + digit
    setCurrentPin(newPin)
    setError('')

    if (newPin.length === 4) {
      if (step === 1) {
        const validation = validatePin(newPin)
        if (validation !== true) {
          setError(validation)
          triggerShake()
          setTimeout(() => setPin(''), 400)
          return
        }
        setTimeout(() => setStep(2), 300)
      } else {
        if (newPin !== pin) {
          setError('PINs do not match. Try again.')
          triggerShake()
          setTimeout(() => setConfirmPin(''), 400)
        } else {
          handlePinSave(newPin)
        }
      }
    }
  }

  function handleBackspace() {
    setCurrentPin(currentPin.slice(0, -1))
    setError('')
  }

  async function handlePinSave(finalPin) {
    await savePin(currentUser.uid, finalPin)
    let settings = await getUserSettings(currentUser.uid)
    if (!settings) {
      await createUserSettings(currentUser.uid, currentUser.email || '', { pinSetupCompleted: true })
    } else {
      await updateUserSettings(currentUser.uid, { pinSetupCompleted: true })
    }
    const s = await getUserSettings(currentUser.uid)
    if (s && s.onboardingCompleted) {
      navigate('/dashboard')
    } else {
      navigate('/onboarding')
    }
  }

  return (
    <div className={styles.container}>
      <p className={styles.stepIndicator}>Step {step} of 2</p>
      <div className={styles.progressBar}>
        <div className={`${styles.progressSegment} ${styles.active}`} />
        <div className={`${styles.progressSegment} ${step === 2 ? styles.active : ''}`} />
      </div>
      <h1 className={styles.title}>
        {step === 1 ? 'Create your 4-digit PIN' : 'Confirm your PIN'}
      </h1>
      <div className={`${styles.dots} ${shaking ? 'shake' : ''}`}>
        {[0,1,2,3].map(i => (
          <div
            key={i}
            className={`${styles.dot} ${i < currentPin.length ? styles.filled : ''} ${error ? styles.error : ''}`}
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
    </div>
  )
}
