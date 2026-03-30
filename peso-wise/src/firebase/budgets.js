import { db } from './config'
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  query, where, getDocs
} from 'firebase/firestore'

const COLLECTION = 'budgets'

export async function addBudget(userId, data) {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...data,
    userId,
  })
  return docRef.id
}

export async function updateBudget(id, data) {
  await updateDoc(doc(db, COLLECTION, id), data)
}

export async function deleteBudget(id) {
  await deleteDoc(doc(db, COLLECTION, id))
}

export async function getBudgets(userId) {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId)
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
}
