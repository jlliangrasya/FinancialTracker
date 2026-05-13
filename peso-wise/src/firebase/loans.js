import { db } from './config'
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDoc,
  query, where, getDocs, Timestamp
} from 'firebase/firestore'

const COLLECTION = 'loans'

export async function addLoan(userId, data) {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...data,
    userId,
    startDate: Timestamp.fromDate(new Date(data.startDate)),
    firstPaymentDate: data.firstPaymentDate ? Timestamp.fromDate(new Date(data.firstPaymentDate)) : null,
    paidPeriods: [],
    createdAt: Timestamp.now(),
  })
  return docRef.id
}

export async function updateLoan(id, data) {
  const updateData = { ...data }
  if (data.startDate) updateData.startDate = Timestamp.fromDate(new Date(data.startDate))
  if (data.firstPaymentDate) updateData.firstPaymentDate = Timestamp.fromDate(new Date(data.firstPaymentDate))
  await updateDoc(doc(db, COLLECTION, id), updateData)
}

export async function deleteLoan(id) {
  await deleteDoc(doc(db, COLLECTION, id))
}

export async function getLoans(userId) {
  const q = query(collection(db, COLLECTION), where('userId', '==', userId))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function markLoanPayment(id, periodNumber, amountPaid) {
  const ref = doc(db, COLLECTION, id)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const paidPeriods = snap.data().paidPeriods || []
  if (paidPeriods.find(p => p.periodNumber === periodNumber)) return
  await updateDoc(ref, {
    paidPeriods: [...paidPeriods, { periodNumber, paidAt: Timestamp.now(), amountPaid }]
  })
}

export async function unmarkLoanPayment(id, periodNumber) {
  const ref = doc(db, COLLECTION, id)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  await updateDoc(ref, {
    paidPeriods: (snap.data().paidPeriods || []).filter(p => p.periodNumber !== periodNumber)
  })
}
