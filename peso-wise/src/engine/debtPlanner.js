export function calculateDebtPayoff(debts, strategy = 'avalanche', extraPayment = 0) {
  if (!debts || debts.length === 0) {
    return { schedule: [], totalInterestPaid: 0, totalMonths: 0, payoffDates: {} }
  }

  const sorted = [...debts].sort((a, b) => {
    if (strategy === 'avalanche') return b.interestRate - a.interestRate
    return a.balance - b.balance
  })

  let remaining = sorted.map(d => ({
    id: d.id,
    name: d.name,
    balance: d.balance,
    rate: d.interestRate / 100 / 12,
    minPayment: d.minPayment,
    originalBalance: d.balance,
  }))

  let totalInterestPaid = 0
  let month = 0
  const maxMonths = 600
  const payoffDates = {}
  const schedule = []

  while (remaining.some(d => d.balance > 0) && month < maxMonths) {
    month++
    let monthInterest = 0
    let monthPrincipal = 0
    let extraLeft = extraPayment

    remaining.forEach(debt => {
      if (debt.balance <= 0) return
      const interest = debt.balance * debt.rate
      debt.balance += interest
      monthInterest += interest
      totalInterestPaid += interest
    })

    remaining.forEach(debt => {
      if (debt.balance <= 0) return
      const payment = Math.min(debt.minPayment, debt.balance)
      debt.balance -= payment
      monthPrincipal += payment
      if (debt.balance <= 0) {
        debt.balance = 0
        if (!payoffDates[debt.id]) {
          payoffDates[debt.id] = month
          extraLeft += debt.minPayment
        }
      }
    })

    const target = remaining.find(d => d.balance > 0)
    if (target && extraLeft > 0) {
      const payment = Math.min(extraLeft, target.balance)
      target.balance -= payment
      monthPrincipal += payment
      if (target.balance <= 0) {
        target.balance = 0
        if (!payoffDates[target.id]) {
          payoffDates[target.id] = month
        }
      }
    }

    schedule.push({
      month,
      interest: monthInterest,
      principal: monthPrincipal,
      totalRemaining: remaining.reduce((s, d) => s + d.balance, 0),
    })
  }

  return {
    schedule,
    totalInterestPaid,
    totalMonths: month,
    payoffDates,
  }
}

export function compareStrategies(debts, extraPayment = 0) {
  const avalanche = calculateDebtPayoff(debts, 'avalanche', extraPayment)
  const snowball = calculateDebtPayoff(debts, 'snowball', extraPayment)
  const savings = snowball.totalInterestPaid - avalanche.totalInterestPaid
  return {
    avalanche,
    snowball,
    avalancheSaves: savings > 0 ? savings : 0,
    snowballSaves: savings < 0 ? Math.abs(savings) : 0,
  }
}
