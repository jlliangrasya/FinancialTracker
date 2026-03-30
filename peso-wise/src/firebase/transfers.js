import { db } from './config'
import {
  collection, addDoc, deleteDoc, doc,
  query, where, orderBy, getDocs, Timestamp
} from 'firebase/firestore'

const COLLECTION = 'transfers'

export async function addTransfer(userId, data) {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...data,
    userId,
    date: Timestamp.fromDate(new Date(data.date)),
    createdAt: Timestamp.now(),
  })
  return docRef.id
}

export async function deleteTransfer(id) {
  await deleteDoc(doc(db, COLLECTION, id))
}

export async function getTransfers(userId) {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId),
    orderBy('date', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
}
