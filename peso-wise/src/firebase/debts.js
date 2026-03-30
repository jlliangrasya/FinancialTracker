import { db } from './config'
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  query, where, getDocs, Timestamp
} from 'firebase/firestore'

const COLLECTION = 'debts'

export async function addDebt(userId, data) {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...data,
    userId,
    startDate: Timestamp.fromDate(new Date(data.startDate)),
    createdAt: Timestamp.now(),
  })
  return docRef.id
}

export async function updateDebt(id, data) {
  const updateData = { ...data }
  if (data.startDate) {
    updateData.startDate = Timestamp.fromDate(new Date(data.startDate))
  }
  await updateDoc(doc(db, COLLECTION, id), updateData)
}

export async function deleteDebt(id) {
  await deleteDoc(doc(db, COLLECTION, id))
}

export async function getDebts(userId) {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId)
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
}
