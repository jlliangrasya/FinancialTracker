import { db } from './config'
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  query, where, getDocs, getDoc, Timestamp, arrayUnion, arrayRemove
} from 'firebase/firestore'

const COLLECTION = 'bills'

export async function addBill(userId, data) {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...data,
    userId,
    paidMonths: [],
    isActive: true,
    createdAt: Timestamp.now(),
  })
  return docRef.id
}

export async function updateBill(id, data) {
  await updateDoc(doc(db, COLLECTION, id), data)
}

export async function deleteBill(id) {
  await deleteDoc(doc(db, COLLECTION, id))
}

export async function markBillPaid(id, monthString, amount = null) {
  const snap = await getDoc(doc(db, COLLECTION, id))
  const existing = snap.data()?.paymentHistory || []
  const filtered = existing.filter(p => p.month !== monthString)
  const entry = { month: monthString, paidAt: Timestamp.now(), ...(amount !== null ? { amount } : {}) }
  await updateDoc(doc(db, COLLECTION, id), {
    paidMonths: arrayUnion(monthString),
    paymentHistory: [...filtered, entry],
  })
}

export async function markBillUnpaid(id, monthString) {
  const snap = await getDoc(doc(db, COLLECTION, id))
  const existing = snap.data()?.paymentHistory || []
  await updateDoc(doc(db, COLLECTION, id), {
    paidMonths: arrayRemove(monthString),
    paymentHistory: existing.filter(p => p.month !== monthString),
  })
}

export async function getBills(userId) {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId)
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
}
