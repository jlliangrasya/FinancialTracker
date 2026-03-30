export function getMonthLabel(date = new Date()) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return months[date.getMonth()] + '-' + date.getFullYear()
}

export function formatDate(date) {
  if (!date) return ''
  const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function differenceInDays(dateA, dateB) {
  const a = dateA instanceof Date ? dateA : new Date(dateA)
  const b = dateB instanceof Date ? dateB : new Date(dateB)
  const diffMs = a.getTime() - b.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

export function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function addMonths(date, months) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

export function isToday(date) {
  const d = date instanceof Date ? date : new Date(date)
  const today = new Date()
  return d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
}

export function isYesterday(date) {
  const d = date instanceof Date ? date : new Date(date)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
}

export function toFirestoreDate(date) {
  return date instanceof Date ? date : new Date(date)
}

export function getCurrentMonthString() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
