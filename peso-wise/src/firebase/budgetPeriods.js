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
  const updates = { ...data }
  if (updates.startDate && !(updates.startDate instanceof Timestamp)) {
    updates.startDate = Timestamp.fromDate(new Date(updates.startDate))
  }
  if (updates.endDate && !(updates.endDate instanceof Timestamp)) {
    updates.endDate = Timestamp.fromDate(new Date(updates.endDate))
  }
  await updateDoc(docRef, updates)
}

export async function completeBudgetPeriod(id, summary) {
  const docRef = doc(db, COLLECTION, id)
  await updateDoc(docRef, {
    status: 'completed',
    completedAt: Timestamp.now(),
    summary,
  })
}

export async function getBudgetPeriods(userId) {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId)
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function getCompletedBudgetPeriods(userId) {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId),
    where('status', '==', 'completed')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const aEnd = a.endDate?.toDate ? a.endDate.toDate() : new Date(a.endDate)
      const bEnd = b.endDate?.toDate ? b.endDate.toDate() : new Date(b.endDate)
      return bEnd - aEnd
    })
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
