import { db } from './config'
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  query, where, orderBy, getDocs, Timestamp
} from 'firebase/firestore'

const COLLECTION = 'transactions'

export async function addTransaction(userId, data) {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...data,
    userId,
    date: Timestamp.fromDate(new Date(data.date)),
    createdAt: Timestamp.now(),
  })
  return docRef.id
}

export async function updateTransaction(id, data) {
  const docRef = doc(db, COLLECTION, id)
  const updateData = { ...data }
  if (data.date) {
    updateData.date = Timestamp.fromDate(new Date(data.date))
  }
  await updateDoc(docRef, updateData)
}

export async function deleteTransaction(id) {
  await deleteDoc(doc(db, COLLECTION, id))
}

export async function getTransactions(userId) {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId),
    orderBy('date', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function getTransactionsByMonth(userId, monthLabel) {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId),
    orderBy('date', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(t => {
      const date = t.date?.toDate ? t.date.toDate() : new Date(t.date)
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      const label = months[date.getMonth()] + '-' + date.getFullYear()
      return label === monthLabel
    })
}
