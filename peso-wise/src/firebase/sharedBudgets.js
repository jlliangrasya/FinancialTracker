import { db } from './config'
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDoc,
  query, where, getDocs, Timestamp, arrayRemove
} from 'firebase/firestore'

const COLLECTION = 'sharedBudgets'

function generateToken() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export async function createSharedBudget(userId, userEmail) {
  const token = generateToken()
  const docRef = await addDoc(collection(db, COLLECTION), {
    createdBy: userId,
    members: [userId],
    memberEmails: [userEmail],
    status: 'pending',
    inviteToken: token,
    createdAt: Timestamp.now(),
  })
  return { id: docRef.id, inviteToken: token }
}

export async function acceptInvite(token, userId, userEmail) {
  const q = query(collection(db, COLLECTION), where('inviteToken', '==', token), where('status', '==', 'pending'))
  const snapshot = await getDocs(q)
  if (snapshot.empty) throw new Error('Invalid or expired invite code.')
  const docSnap = snapshot.docs[0]
  const data = docSnap.data()
  if (data.members.includes(userId)) throw new Error('You are already in this shared budget.')
  await updateDoc(doc(db, COLLECTION, docSnap.id), {
    members: [...data.members, userId],
    memberEmails: [...data.memberEmails, userEmail],
    status: 'active',
    inviteToken: null,
  })
  return docSnap.id
}

export async function getSharedBudget(sharedBudgetId) {
  const snap = await getDoc(doc(db, COLLECTION, sharedBudgetId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

export async function leaveSharedBudget(sharedBudgetId, userId, userEmail) {
  const ref = doc(db, COLLECTION, sharedBudgetId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const data = snap.data()
  const remainingMembers = (data.members || []).filter(m => m !== userId)
  if (remainingMembers.length === 0) {
    await deleteDoc(ref)
  } else {
    await updateDoc(ref, {
      members: arrayRemove(userId),
      memberEmails: (data.memberEmails || []).filter(e => e !== userEmail),
      status: 'pending',
      inviteToken: Math.random().toString(36).substring(2, 8).toUpperCase(),
    })
  }
}
