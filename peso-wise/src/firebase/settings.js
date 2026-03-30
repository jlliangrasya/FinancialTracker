import { db } from './config'
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore'

const COLLECTION = 'settings'

export async function getUserSettings(userId) {
  const docRef = doc(db, COLLECTION, userId)
  const snapshot = await getDoc(docRef)
  if (snapshot.exists()) {
    return snapshot.data()
  }
  return null
}

export async function createUserSettings(userId, data = {}) {
  const defaults = {
    userId,
    banks: [],
    payDay: 15,
    currency: 'PHP',
    lowBalanceAlert: 1000,
    customExpenseCategories: [],
    customIncomeCategories: [],
    onboardingCompleted: false,
    pinSetupCompleted: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }
  const settings = { ...defaults, ...data }
  await setDoc(doc(db, COLLECTION, userId), settings)
  return settings
}

export async function updateUserSettings(userId, data) {
  const docRef = doc(db, COLLECTION, userId)
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  })
}
