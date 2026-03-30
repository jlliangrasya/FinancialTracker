export function calculateBurnRate(totalSpent, remainingBudget, periodStartDate, periodEndDate) {
  const today = new Date()
  const start = periodStartDate instanceof Date ? periodStartDate : new Date(periodStartDate)
  const end = periodEndDate instanceof Date ? periodEndDate : new Date(periodEndDate)

  const daysElapsed = Math.max(1, Math.floor((today - start) / (1000 * 60 * 60 * 24)))
  const daysRemaining = Math.max(0, Math.floor((end - today) / (1000 * 60 * 60 * 24)))
  const dailyAverage = totalSpent / daysElapsed
  const projectedTotal = totalSpent + (dailyAverage * daysRemaining)
  const safeDailyTarget = daysRemaining > 0 ? remainingBudget / daysRemaining : 0
  const totalBudget = totalSpent + remainingBudget
  const willOverspend = projectedTotal > totalBudget
  const overAmount = willOverspend ? projectedTotal - totalBudget : 0

  return {
    dailyAverage,
    daysElapsed,
    daysRemaining,
    safeDailyTarget,
    projectedTotal,
    willOverspend,
    overAmount,
    totalBudget,
  }
}

export function getBurnRateStatus(dailyAverage, safeDailyTarget) {
  if (safeDailyTarget <= 0) return 'critical'
  const ratio = dailyAverage / safeDailyTarget
  if (ratio <= 0.8) return 'safe'
  if (ratio <= 1.0) return 'warning'
  return 'critical'
}

export function getDailySpending(transactions, periodStartDate, periodEndDate) {
  const start = periodStartDate instanceof Date ? periodStartDate : new Date(periodStartDate)
  const end = periodEndDate instanceof Date ? periodEndDate : new Date(periodEndDate)
  const today = new Date()
  const actualEnd = end < today ? end : today

  const dailyMap = {}
  const current = new Date(start)
  while (current <= actualEnd) {
    const key = current.toISOString().split('T')[0]
    dailyMap[key] = 0
    current.setDate(current.getDate() + 1)
  }

  transactions.forEach(t => {
    if (t.isIncome) return
    const date = t.date?.toDate ? t.date.toDate() : new Date(t.date)
    const key = date.toISOString().split('T')[0]
    if (dailyMap[key] !== undefined) {
      dailyMap[key] += t.amount
    }
  })

  return Object.entries(dailyMap).map(([date, amount]) => ({ date, amount }))
}
