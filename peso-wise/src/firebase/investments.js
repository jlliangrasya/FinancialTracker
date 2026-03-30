import { db } from './config'
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  query, where, getDocs, Timestamp
} from 'firebase/firestore'

const COLLECTION = 'investments'

export async function addInvestment(userId, data) {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...data,
    userId,
    dateStarted: Timestamp.fromDate(new Date(data.dateStarted)),
    createdAt: Timestamp.now(),
  })
  return docRef.id
}

export async function updateInvestment(id, data) {
  const updateData = { ...data }
  if (data.dateStarted) {
    updateData.dateStarted = Timestamp.fromDate(new Date(data.dateStarted))
  }
  await updateDoc(doc(db, COLLECTION, id), updateData)
}

export async function deleteInvestment(id) {
  await deleteDoc(doc(db, COLLECTION, id))
}

export async function getInvestments(userId) {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId)
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
}
