import { db } from './config'
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  query, where, getDocs, orderBy, Timestamp
} from 'firebase/firestore'

const COLLECTION = 'businessTransactions'

export async function addBusinessTransaction(userId, data) {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...data,
    userId,
    date: Timestamp.fromDate(new Date(data.date)),
    createdAt: Timestamp.now(),
  })
  return docRef.id
}

export async function getBusinessTransactions(userId) {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId),
    orderBy('date', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function deleteBusinessTransaction(id) {
  await deleteDoc(doc(db, COLLECTION, id))
}
