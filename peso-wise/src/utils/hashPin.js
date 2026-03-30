export async function hashPin(uid, pin) {
  const data = uid + pin
  const encoded = new TextEncoder().encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export function getPinKey(uid) {
  return `pesowise_pin_${uid}`
}

export async function savePin(uid, pin) {
  const hash = await hashPin(uid, pin)
  localStorage.setItem(getPinKey(uid), hash)
}

export async function verifyPin(uid, pin) {
  const stored = localStorage.getItem(getPinKey(uid))
  if (!stored) return false
  const hash = await hashPin(uid, pin)
  return hash === stored
}

export function clearPin(uid) {
  localStorage.removeItem(getPinKey(uid))
}
