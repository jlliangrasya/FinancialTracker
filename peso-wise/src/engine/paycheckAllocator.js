export function calculateDefaultAllocation(incomeAmount, upcomingBills, savingsGoals) {
  const billsTotal = (upcomingBills || [])
    .reduce((sum, b) => sum + (b.amount || 0), 0)

  const savingsNeeded = (savingsGoals || [])
    .reduce((sum, g) => {
      if (!g.targetDate || !g.targetAmount) return sum
      const target = g.targetDate?.toDate ? g.targetDate.toDate() : new Date(g.targetDate)
      const now = new Date()
      const monthsLeft = Math.max(1, (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()))
      const remaining = Math.max(0, g.targetAmount - (g.savedAmount || 0))
      return sum + (remaining / monthsLeft)
    }, 0)

  const suggestedBills = Math.min(billsTotal, incomeAmount)
  const suggestedSavings = Math.min(savingsNeeded, incomeAmount - suggestedBills)
  const suggestedSpending = Math.max(0, incomeAmount - suggestedBills - suggestedSavings)

  return {
    bills: Math.round(suggestedBills * 100) / 100,
    savings: Math.round(suggestedSavings * 100) / 100,
    spending: Math.round(suggestedSpending * 100) / 100,
    total: incomeAmount,
    billsReference: billsTotal,
    savingsReference: Math.round(savingsNeeded * 100) / 100,
  }
}

export function validateAllocation(bills, savings, spending, totalIncome) {
  const sum = bills + savings + spending
  const diff = Math.round((totalIncome - sum) * 100) / 100
  return {
    isBalanced: Math.abs(diff) < 0.01,
    unallocated: diff > 0 ? diff : 0,
    overAllocated: diff < 0 ? Math.abs(diff) : 0,
  }
}
