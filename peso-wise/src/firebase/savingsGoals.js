import { db } from './config'
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  query, where, getDocs, Timestamp
} from 'firebase/firestore'

const COLLECTION = 'savingsGoals'

export async function addSavingsGoal(userId, data) {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...data,
    userId,
    targetDate: Timestamp.fromDate(new Date(data.targetDate)),
    savedAmount: data.savedAmount || 0,
    createdAt: Timestamp.now(),
  })
  return docRef.id
}

export async function updateSavingsGoal(id, data) {
  const updateData = { ...data }
  if (data.targetDate) {
    updateData.targetDate = Timestamp.fromDate(new Date(data.targetDate))
  }
  await updateDoc(doc(db, COLLECTION, id), updateData)
}

export async function deleteSavingsGoal(id) {
  await deleteDoc(doc(db, COLLECTION, id))
}

export async function getSavingsGoals(userId) {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId)
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
}
