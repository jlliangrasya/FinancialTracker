import { db } from './config'
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, Timestamp } from 'firebase/firestore'

const COLLECTION = 'settings'

export async function getUserSettings(userId) {
  const docRef = doc(db, COLLECTION, userId)
  const snapshot = await getDoc(docRef)
  if (snapshot.exists()) {
    return snapshot.data()
  }
  return null
}

export async function createUserSettings(userId, email = '', data = {}) {
  // Check if this user's doc already exists
  const existing = await getUserSettings(userId)
  if (existing) return existing

  // First user becomes superadmin (auto-approved).
  // We check by reading only OUR OWN doc — if it doesn't exist and we're
  // creating it, we optimistically assume we're the first user.
  // The Firestore rule only lets us read our own settings doc, so we can't
  // query other users' docs. Instead, we use a dedicated "meta" doc.
  let isFirst = false
  try {
    const metaRef = doc(db, 'settings', '__meta__')
    const metaSnap = await getDoc(metaRef)
    if (!metaSnap.exists()) {
      // No meta doc → this is the very first user
      isFirst = true
    }
  } catch {
    // If we can't read the meta doc, assume superadmin already exists
    isFirst = false
  }

  const defaults = {
    userId,
    email,
    banks: [],
    payDay: 15,
    currency: 'PHP',
    lowBalanceAlert: 1000,
    customExpenseCategories: [],
    customIncomeCategories: [],
    onboardingCompleted: false,
    pinSetupCompleted: false,
    role: isFirst ? 'superadmin' : 'user',
    status: isFirst ? 'approved' : 'pending',
    paymentReference: '',
    approvedAt: null,
    rejectedAt: null,
    rejectedReason: '',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }
  const settings = { ...defaults, ...data }
  await setDoc(doc(db, COLLECTION, userId), settings)

  // Mark that at least one user exists so future registrations aren't superadmin
  if (isFirst) {
    try {
      await setDoc(doc(db, COLLECTION, '__meta__'), { initialized: true, createdAt: Timestamp.now() })
    } catch { /* non-critical */ }
  }

  return settings
}

export async function updateUserSettings(userId, data) {
  const docRef = doc(db, COLLECTION, userId)
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  })
}

export async function updatePaymentRef(userId, paymentReference) {
  const docRef = doc(db, COLLECTION, userId)
  await updateDoc(docRef, { paymentReference, updatedAt: Timestamp.now() })
}

export async function approveUser(userId) {
  const docRef = doc(db, COLLECTION, userId)
  await updateDoc(docRef, {
    status: 'approved',
    approvedAt: Timestamp.now(),
    rejectedAt: null,
    rejectedReason: '',
    updatedAt: Timestamp.now(),
  })
}

export async function rejectUser(userId, reason = '') {
  const docRef = doc(db, COLLECTION, userId)
  await updateDoc(docRef, {
    status: 'rejected',
    rejectedAt: Timestamp.now(),
    rejectedReason: reason,
    approvedAt: null,
    updatedAt: Timestamp.now(),
  })
}

export async function getAllUsers() {
  const snapshot = await getDocs(collection(db, COLLECTION))
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
}
