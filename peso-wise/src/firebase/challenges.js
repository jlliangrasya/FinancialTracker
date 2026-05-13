import { db } from './config'
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  query, where, getDocs, Timestamp
} from 'firebase/firestore'

const COLLECTION = 'challenges'

export async function addChallenge(userId, data) {
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

export async function updateChallenge(id, data) {
  await updateDoc(doc(db, COLLECTION, id), { ...data, updatedAt: Timestamp.now() })
}

export async function deleteChallenge(id) {
  await deleteDoc(doc(db, COLLECTION, id))
}

export async function getChallenges(userId) {
  const q = query(collection(db, COLLECTION), where('userId', '==', userId))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
}
