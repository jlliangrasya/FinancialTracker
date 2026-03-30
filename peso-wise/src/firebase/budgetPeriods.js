import { db } from './config'
import {
  collection, addDoc, updateDoc, doc,
  query, where, getDocs, Timestamp
} from 'firebase/firestore'

const COLLECTION = 'budgetPeriods'

export async function addBudgetPeriod(userId, data) {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...data,
    userId,
    startDate: Timestamp.fromDate(new Date(data.startDate)),
    endDate: Timestamp.fromDate(new Date(data.endDate)),
    status: 'active',
    createdAt: Timestamp.now(),
  })
  return docRef.id
}

export async function updateBudgetPeriod(id, data) {
  const docRef = doc(db, COLLECTION, id)
  await updateDoc(docRef, data)
}

export async function getBudgetPeriods(userId) {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId)
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function getActiveBudgetPeriod(userId) {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId),
    where('status', '==', 'active')
  )
  const snapshot = await getDocs(q)
  if (snapshot.empty) return null
  const d = snapshot.docs[0]
  return { id: d.id, ...d.data() }
}
