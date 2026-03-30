export function calculateBudgetStatus(category, monthlyLimit, transactions, monthLabel) {
  const spent = transactions
    .filter(t => {
      const date = t.date?.toDate ? t.date.toDate() : new Date(t.date)
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      const label = months[date.getMonth()] + '-' + date.getFullYear()
      return t.category === category && label === monthLabel && !t.isIncome
    })
    .reduce((sum, t) => sum + t.amount, 0)
  const remaining = monthlyLimit - spent
  const percentUsed = monthlyLimit > 0 ? spent / monthlyLimit : 0
  const status = percentUsed >= 1 ? 'over' : percentUsed >= 0.8 ? 'warning' : 'ok'
  return { category, spent, remaining, percentUsed, status, monthlyLimit }
}

export function calculateAllBudgetStatuses(budgets, transactions, monthLabel) {
  return budgets.map(b =>
    calculateBudgetStatus(b.category, b.monthlyLimit, transactions, monthLabel)
  )
}

export function getPeriodBudgetStatus(transactions, period) {
  if (!period) return null
  const startDate = period.startDate?.toDate ? period.startDate.toDate() : new Date(period.startDate)
  const endDate = period.endDate?.toDate ? period.endDate.toDate() : new Date(period.endDate)

  const periodTxns = transactions.filter(t => {
    const date = t.date?.toDate ? t.date.toDate() : new Date(t.date)
    return date >= startDate && date <= endDate && !t.isIncome
  })

  const totalSpent = periodTxns.reduce((sum, t) => sum + t.amount, 0)
  const totalBudget = period.mode === 'combined'
    ? period.totalBudget
    : (period.expensesBudget || 0) + (period.billsBudget || 0)
  const remaining = totalBudget - totalSpent
  const percentUsed = totalBudget > 0 ? totalSpent / totalBudget : 0
  const status = percentUsed >= 1 ? 'over' : percentUsed >= 0.8 ? 'warning' : 'ok'

  return { totalSpent, totalBudget, remaining, percentUsed, status }
}
