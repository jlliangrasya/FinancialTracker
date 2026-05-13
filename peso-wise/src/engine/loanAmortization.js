import { addMonths, addDays } from '../utils/dateHelpers'

function addWeeks(date, weeks) {
  return addDays(date, weeks * 7)
}

function toDateObj(val) {
  if (!val) return new Date()
  if (val instanceof Date) return val
  if (val.seconds) return new Date(val.seconds * 1000)
  return new Date(val)
}

function formatISO(date) {
  return date.toISOString().split('T')[0]
}

// Standard PMT formula
export function calculateMonthlyPayment(principal, annualRate, termMonths) {
  if (!annualRate) return principal / termMonths
  const r = annualRate / 100 / 12
  return (principal * r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1)
}

export function calculateAmortizationSchedule(loan) {
  if (loan.loanType === '5-6') return calculate56Schedule(loan)

  const { principalAmount, interestRate, termMonths, startDate, firstPaymentDate } = loan
  const payment = calculateMonthlyPayment(principalAmount, interestRate || 0, termMonths)
  const monthlyRate = (interestRate || 0) / 100 / 12
  let balance = principalAmount
  const schedule = []

  const start = firstPaymentDate
    ? toDateObj(firstPaymentDate)
    : addMonths(toDateObj(startDate), 1)

  for (let i = 1; i <= termMonths; i++) {
    const interestPortion = balance * monthlyRate
    const principalPortion = Math.min(payment - interestPortion, balance)
    balance = Math.max(balance - principalPortion, 0)

    schedule.push({
      periodNumber: i,
      paymentDate: formatISO(addMonths(start, i - 1)),
      paymentAmount: Math.round(payment * 100) / 100,
      principalPortion: Math.round(principalPortion * 100) / 100,
      interestPortion: Math.round(interestPortion * 100) / 100,
      remainingBalance: Math.round(balance * 100) / 100,
    })

    if (balance <= 0) break
  }

  return schedule
}

// 5-6: flat 20% interest, equal daily/weekly/monthly collections
export function calculate56Schedule(loan) {
  const { principalAmount, termMonths, startDate, firstPaymentDate, paymentFrequency } = loan
  const totalRepayable = principalAmount * 1.2
  const freq = paymentFrequency || 'daily'

  let numPeriods
  if (freq === 'daily') numPeriods = (termMonths || 1) * 26
  else if (freq === 'weekly') numPeriods = (termMonths || 1) * 4
  else numPeriods = termMonths || 6

  const periodicPayment = totalRepayable / numPeriods
  const start = firstPaymentDate ? toDateObj(firstPaymentDate) : toDateObj(startDate)
  const schedule = []

  for (let i = 1; i <= numPeriods; i++) {
    let paymentDate
    if (freq === 'daily') paymentDate = formatISO(addDays(start, i))
    else if (freq === 'weekly') paymentDate = formatISO(addWeeks(start, i))
    else paymentDate = formatISO(addMonths(start, i))

    const remaining = Math.max(totalRepayable - periodicPayment * i, 0)
    schedule.push({
      periodNumber: i,
      paymentDate,
      paymentAmount: Math.round(periodicPayment * 100) / 100,
      principalPortion: Math.round((principalAmount / numPeriods) * 100) / 100,
      interestPortion: Math.round(((totalRepayable - principalAmount) / numPeriods) * 100) / 100,
      remainingBalance: Math.round(remaining * 100) / 100,
    })
  }

  return schedule
}

export function getLoanSummary(loan, schedule) {
  const paidPeriods = loan.paidPeriods || []
  const paidSet = new Set(paidPeriods.map(p => p.periodNumber))

  const totalPayable = schedule.reduce((s, p) => s + p.paymentAmount, 0)
  const totalPaid = paidPeriods.reduce((s, p) => s + (p.amountPaid || 0), 0)
  const totalInterest = schedule.reduce((s, p) => s + p.interestPortion, 0)

  const today = new Date().toISOString().split('T')[0]
  const unpaid = schedule.filter(p => !paidSet.has(p.periodNumber))
  const nextDue = unpaid.find(p => p.paymentDate >= today)
  const overdueCount = unpaid.filter(p => p.paymentDate < today).length
  const remainingBalance = unpaid[0]?.remainingBalance ?? 0

  return {
    totalPayable: Math.round(totalPayable * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    remainingBalance: Math.max(remainingBalance, 0),
    nextDueDate: nextDue?.paymentDate ?? null,
    nextDueAmount: nextDue?.paymentAmount ?? null,
    overdueCount,
    paidCount: paidSet.size,
    totalPeriods: schedule.length,
    progressPct: schedule.length > 0 ? Math.round((paidSet.size / schedule.length) * 100) : 0,
  }
}
