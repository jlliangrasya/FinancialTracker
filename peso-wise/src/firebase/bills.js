import { db } from './config'
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  query, where, getDocs, Timestamp, arrayUnion, arrayRemove
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

export async function markBillPaid(id, monthString) {
  await updateDoc(doc(db, COLLECTION, id), {
    paidMonths: arrayUnion(monthString)
  })
}

export async function markBillUnpaid(id, monthString) {
  await updateDoc(doc(db, COLLECTION, id), {
    paidMonths: arrayRemove(monthString)
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
