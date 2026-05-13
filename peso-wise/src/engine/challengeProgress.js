function toDateStr(ts) {
  if (!ts) return ''
  const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts)
  return d.toISOString().split('T')[0]
}

export function evaluateChallenge(challenge, transactions, budgets = []) {
  const start = toDateStr(challenge.startDate)
  const end = toDateStr(challenge.endDate)
  const today = new Date().toISOString().split('T')[0]

  const inRange = transactions.filter(t => {
    const d = toDateStr(t.date)
    return d >= start && d <= end
  })

  const isExpired = today > end

  switch (challenge.type) {
    case 'no-spend': {
      const allowed = challenge.allowedCategories || []
      const targetCat = challenge.targetCategory || null
      const violations = inRange.filter(t => {
        if (t.isIncome || t.type === 'income') return false
        if (t.type === 'transfer') return false
        if (targetCat) return t.category === targetCat
        return !allowed.includes(t.category)
      })
      const isComplete = violations.length === 0 && isExpired
      const isFailed = violations.length > 0 && isExpired
      const daysElapsed = Math.min(
        Math.ceil((new Date(Math.min(new Date(today), new Date(end))) - new Date(start)) / 86400000),
        challenge.durationDays
      )
      return {
        progress: Math.max(0, challenge.durationDays - violations.length),
        progressPct: violations.length === 0
          ? Math.round((daysElapsed / challenge.durationDays) * 100)
          : Math.max(0, Math.round(((challenge.durationDays - violations.length) / challenge.durationDays) * 100)),
        isComplete,
        isFailed,
        statusText: violations.length === 0
          ? isExpired ? 'Completed!' : `${challenge.durationDays - daysElapsed} days left`
          : `${violations.length} violation${violations.length > 1 ? 's' : ''}`,
        detail: violations.length > 0 ? `Spent on: ${[...new Set(violations.map(v => v.category))].join(', ')}` : null,
      }
    }

    case 'save-amount': {
      const saved = inRange
        .filter(t => t.category === 'Savings Contribution' || t.type === 'savings')
        .reduce((s, t) => s + (t.amount || 0), 0)
      const isComplete = saved >= challenge.targetAmount
      const isFailed = isExpired && !isComplete
      return {
        progress: saved,
        progressPct: challenge.targetAmount > 0 ? Math.min(100, Math.round((saved / challenge.targetAmount) * 100)) : 0,
        isComplete,
        isFailed,
        statusText: isComplete ? 'Goal reached!' : `₱${saved.toLocaleString()} / ₱${challenge.targetAmount.toLocaleString()}`,
        detail: null,
      }
    }

    case 'streak': {
      const savingsDays = new Set(
        inRange
          .filter(t => t.category === 'Savings Contribution' || t.type === 'savings')
          .map(t => toDateStr(t.date))
      )
      let streak = 0
      let cur = new Date(start)
      const endD = new Date(Math.min(new Date(today), new Date(end)))
      while (cur <= endD) {
        if (savingsDays.has(cur.toISOString().split('T')[0])) streak++
        cur.setDate(cur.getDate() + 1)
      }
      const isComplete = streak >= challenge.durationDays
      const isFailed = isExpired && !isComplete
      return {
        progress: streak,
        progressPct: Math.min(100, Math.round((streak / challenge.durationDays) * 100)),
        isComplete,
        isFailed,
        statusText: isComplete ? 'Streak complete!' : `${streak} / ${challenge.durationDays} days`,
        detail: null,
      }
    }

    case 'under-budget': {
      if (!budgets.length) return { progress: 0, progressPct: 0, isComplete: false, isFailed: false, statusText: 'No budgets set', detail: null }
      const spending = {}
      inRange.filter(t => !t.isIncome && t.type !== 'income' && t.type !== 'transfer').forEach(t => {
        spending[t.category] = (spending[t.category] || 0) + (t.amount || 0)
      })
      const overBudget = budgets.filter(b => (spending[b.category] || 0) > b.monthlyLimit)
      const isComplete = overBudget.length === 0 && isExpired
      const isFailed = overBudget.length > 0 && isExpired
      const passing = budgets.length - overBudget.length
      return {
        progress: passing,
        progressPct: budgets.length > 0 ? Math.round((passing / budgets.length) * 100) : 0,
        isComplete,
        isFailed,
        statusText: overBudget.length === 0
          ? isExpired ? 'All budgets kept!' : `${budgets.length} budgets on track`
          : `Over in: ${overBudget.map(b => b.category).join(', ')}`,
        detail: null,
      }
    }

    default:
      return { progress: 0, progressPct: 0, isComplete: false, isFailed: isExpired, statusText: '', detail: null }
  }
}
