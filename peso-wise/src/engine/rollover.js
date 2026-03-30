export function calculateRollover(previousMonthIncome, previousMonthExpenses, previousRollover = 0) {
  const netSavings = previousMonthIncome - previousMonthExpenses
  return previousRollover + netSavings
}

export function getMonthTotals(transactions, monthLabel) {
  const monthTxns = transactions.filter(t => {
    const date = t.date?.toDate ? t.date.toDate() : new Date(t.date)
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const label = months[date.getMonth()] + '-' + date.getFullYear()
    return label === monthLabel
  })

  const income = monthTxns
    .filter(t => t.isIncome)
    .reduce((sum, t) => sum + t.amount, 0)
  const expenses = monthTxns
    .filter(t => !t.isIncome)
    .reduce((sum, t) => sum + t.amount, 0)

  return { income, expenses, net: income - expenses }
}

export function getPreviousMonthLabel(monthLabel) {
  const [monthStr, yearStr] = monthLabel.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  let monthIndex = months.indexOf(monthStr)
  let year = parseInt(yearStr)

  monthIndex--
  if (monthIndex < 0) {
    monthIndex = 11
    year--
  }

  return months[monthIndex] + '-' + year
}
