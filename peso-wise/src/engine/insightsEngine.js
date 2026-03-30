const PRIORITY = { warning: 0, alert: 1, win: 2, info: 3 }

export function generateInsights(currentMonthTxns, prevMonthTxns, budgets, bills) {
  const insights = []

  // Month-over-month category comparison
  const currentByCategory = groupByCategory(currentMonthTxns.filter(t => !t.isIncome))
  const prevByCategory = groupByCategory(prevMonthTxns.filter(t => !t.isIncome))

  Object.entries(currentByCategory).forEach(([category, amount]) => {
    const prevAmount = prevByCategory[category] || 0
    if (prevAmount > 0) {
      const change = ((amount - prevAmount) / prevAmount) * 100
      if (change > 30) {
        insights.push({
          type: 'alert',
          headline: `${category} spending up ${Math.round(change)}% vs last month`,
          detail: `You spent ${formatPHP(amount)} on ${category} this month vs ${formatPHP(prevAmount)} last month.`,
          tip: `Consider setting a budget limit for ${category} to track spending.`,
        })
      } else if (change < -20) {
        insights.push({
          type: 'win',
          headline: `${category} spending down ${Math.abs(Math.round(change))}%`,
          detail: `You spent ${formatPHP(amount)} on ${category} this month vs ${formatPHP(prevAmount)} last month.`,
        })
      }
    }
  })

  // Budget wins and losses
  if (budgets && budgets.length > 0) {
    budgets.forEach(b => {
      const spent = currentByCategory[b.category] || 0
      if (b.monthlyLimit > 0) {
        if (spent <= b.monthlyLimit * 0.5) {
          insights.push({
            type: 'win',
            headline: `Great job on ${b.category}!`,
            detail: `You've only used ${Math.round((spent / b.monthlyLimit) * 100)}% of your ${b.category} budget.`,
          })
        } else if (spent > b.monthlyLimit) {
          insights.push({
            type: 'warning',
            headline: `Over budget on ${b.category}`,
            detail: `You've spent ${formatPHP(spent)} against a ${formatPHP(b.monthlyLimit)} budget.`,
            tip: `You're over by ${formatPHP(spent - b.monthlyLimit)}. Review recent ${b.category} expenses.`,
          })
        }
      }
    })
  }

  // Biggest single expense
  const expenses = currentMonthTxns.filter(t => !t.isIncome)
  if (expenses.length > 0) {
    const biggest = expenses.reduce((max, t) => t.amount > max.amount ? t : max, expenses[0])
    insights.push({
      type: 'info',
      headline: `Biggest expense: ${formatPHP(biggest.amount)}`,
      detail: `${biggest.description || biggest.category} on ${formatDateShort(biggest.date)} (${biggest.bank}).`,
    })
  }

  // Income trend
  const currentIncome = currentMonthTxns.filter(t => t.isIncome).reduce((s, t) => s + t.amount, 0)
  const prevIncome = prevMonthTxns.filter(t => t.isIncome).reduce((s, t) => s + t.amount, 0)
  if (prevIncome > 0 && currentIncome > 0) {
    const change = ((currentIncome - prevIncome) / prevIncome) * 100
    if (Math.abs(change) > 10) {
      insights.push({
        type: change > 0 ? 'win' : 'alert',
        headline: `Income ${change > 0 ? 'up' : 'down'} ${Math.abs(Math.round(change))}% vs last month`,
        detail: `This month: ${formatPHP(currentIncome)} vs last month: ${formatPHP(prevIncome)}.`,
      })
    }
  }

  // Net cash warning
  const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0)
  if (currentIncome > 0 && totalExpenses > currentIncome) {
    insights.push({
      type: 'warning',
      headline: 'Spending exceeds income this month',
      detail: `You've spent ${formatPHP(totalExpenses)} but only earned ${formatPHP(currentIncome)}.`,
      tip: 'Review your expenses and see where you can cut back.',
    })
  }

  // Bills due
  if (bills && bills.length > 0) {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const unpaid = bills.filter(b => b.isActive && (!b.paidMonths || !b.paidMonths.includes(currentMonth)))
    const overdue = unpaid.filter(b => b.dueDay < now.getDate())
    if (overdue.length > 0) {
      insights.push({
        type: 'warning',
        headline: `${overdue.length} bill${overdue.length > 1 ? 's' : ''} overdue`,
        detail: `${overdue.map(b => b.name).join(', ')} — pay these as soon as possible.`,
      })
    }
  }

  return insights.sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type])
}

function groupByCategory(transactions) {
  const map = {}
  transactions.forEach(t => {
    map[t.category] = (map[t.category] || 0) + t.amount
  })
  return map
}

function formatPHP(amount) {
  return '₱' + Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDateShort(date) {
  const d = date?.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}
