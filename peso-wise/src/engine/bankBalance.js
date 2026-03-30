export function calculateBankBalance(bankName, openingBalance, transactions, transfers) {
  const income = transactions
    .filter(t => t.isIncome && t.bank === bankName)
    .reduce((sum, t) => sum + t.amount, 0)
  const expenses = transactions
    .filter(t => !t.isIncome && t.bank === bankName)
    .reduce((sum, t) => sum + t.amount, 0)
  const transfersIn = transfers
    .filter(t => t.toBank === bankName)
    .reduce((sum, t) => sum + t.amount, 0)
  const transfersOut = transfers
    .filter(t => t.fromBank === bankName)
    .reduce((sum, t) => sum + t.amount, 0)
  return openingBalance + income - expenses + transfersIn - transfersOut
}

export function calculateAllBankBalances(banks, transactions, transfers) {
  return banks.map(bank => ({
    ...bank,
    balance: calculateBankBalance(bank.name, bank.openingBalance, transactions, transfers),
  }))
}

export function getTotalBalance(banks, transactions, transfers) {
  return banks.reduce((total, bank) => {
    return total + calculateBankBalance(bank.name, bank.openingBalance, transactions, transfers)
  }, 0)
}
