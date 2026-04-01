import { db } from './config'
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, limit, Timestamp } from 'firebase/firestore'

const COLLECTION = 'settings'

export async function getUserSettings(userId) {
  const docRef = doc(db, COLLECTION, userId)
  const snapshot = await getDoc(docRef)
  if (snapshot.exists()) {
    return snapshot.data()
  }
  return null
}

async function superAdminExists() {
  const q = query(collection(db, COLLECTION), where('role', '==', 'superadmin'), limit(1))
  const snapshot = await getDocs(q)
  return !snapshot.empty
}

export async function createUserSettings(userId, email = '', data = {}) {
  const isFirst = !(await superAdminExists())
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
    approvedAt: isFirst ? Timestamp.now() : null,
    rejectedAt: null,
    rejectedReason: '',
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
