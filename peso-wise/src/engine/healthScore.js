export function calculateHealthScore({ transactions, budgets, bills, debts, savingsGoals, monthLabel }) {
  const savingsRate = scoreSavingsRate(transactions, monthLabel)
  const budgetAdherence = scoreBudgetAdherence(transactions, budgets, monthLabel)
  const billConsistency = scoreBillConsistency(bills)
  const debtToIncome = scoreDebtToIncome(transactions, debts, monthLabel)
  const emergencyFund = scoreEmergencyFund(transactions, savingsGoals, monthLabel)
  const total = savingsRate + budgetAdherence + billConsistency + debtToIncome + emergencyFund
  const label = total >= 81 ? 'Excellent' : total >= 61 ? 'Good' : total >= 41 ? 'Fair' : 'Poor'
  return { total, label, pillars: { savingsRate, budgetAdherence, billConsistency, debtToIncome, emergencyFund } }
}

function getMonthTransactions(transactions, monthLabel) {
  return transactions.filter(t => {
    const date = t.date?.toDate ? t.date.toDate() : new Date(t.date)
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const label = months[date.getMonth()] + '-' + date.getFullYear()
    return label === monthLabel
  })
}

function scoreSavingsRate(transactions, monthLabel) {
  const monthTxns = getMonthTransactions(transactions, monthLabel)
  const income = monthTxns.filter(t => t.isIncome).reduce((s, t) => s + t.amount, 0)
  const expenses = monthTxns.filter(t => !t.isIncome).reduce((s, t) => s + t.amount, 0)
  if (income === 0) return 0
  const rate = (income - expenses) / income
  if (rate >= 0.2) return 20
  if (rate <= 0) return 0
  return Math.round((rate / 0.2) * 20)
}

function scoreBudgetAdherence(transactions, budgets, monthLabel) {
  if (!budgets || budgets.length === 0) return 10
  const monthTxns = getMonthTransactions(transactions, monthLabel)
  let withinCount = 0
  budgets.forEach(b => {
    const spent = monthTxns
      .filter(t => t.category === b.category && !t.isIncome)
      .reduce((s, t) => s + t.amount, 0)
    if (spent <= b.monthlyLimit) withinCount++
  })
  const ratio = withinCount / budgets.length
  return Math.round(ratio * 20)
}

function scoreBillConsistency(bills) {
  if (!bills || bills.length === 0) return 20
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const activeBills = bills.filter(b => b.isActive)
  if (activeBills.length === 0) return 20
  const paidCount = activeBills.filter(b => b.paidMonths && b.paidMonths.includes(currentMonth)).length
  const ratio = paidCount / activeBills.length
  return Math.round(ratio * 20)
}

function scoreDebtToIncome(transactions, debts, monthLabel) {
  const monthTxns = getMonthTransactions(transactions, monthLabel)
  const income = monthTxns.filter(t => t.isIncome).reduce((s, t) => s + t.amount, 0)
  if (income === 0) return debts && debts.length > 0 ? 0 : 20
  const totalMinPayments = (debts || []).reduce((s, d) => s + (d.minPayment || 0), 0)
  const ratio = totalMinPayments / income
  if (ratio < 0.1) return 20
  if (ratio < 0.2) return 15
  if (ratio < 0.3) return 10
  if (ratio < 0.5) return 5
  return 0
}

function scoreEmergencyFund(transactions, savingsGoals, monthLabel) {
  const monthTxns = getMonthTransactions(transactions, monthLabel)
  const monthlyExpenses = monthTxns.filter(t => !t.isIncome).reduce((s, t) => s + t.amount, 0)
  // Prefer the dedicated Emergency Fund goal; fall back to all savings combined
  const goals = savingsGoals || []
  const efGoal = goals.find(g => g.name?.toLowerCase().includes('emergency'))
  const totalSaved = efGoal
    ? (efGoal.savedAmount || 0)
    : goals.reduce((s, g) => s + (g.savedAmount || 0), 0)
  if (monthlyExpenses === 0) return totalSaved > 0 ? 20 : 10
  const monthsCovered = totalSaved / monthlyExpenses
  if (monthsCovered >= 3) return 20
  if (monthsCovered >= 2) return 15
  if (monthsCovered >= 1) return 10
  if (monthsCovered > 0) return 5
  return 0
}

export function getScoreColor(score) {
  if (score >= 71) return 'success'
  if (score >= 41) return 'warning'
  return 'danger'
}
