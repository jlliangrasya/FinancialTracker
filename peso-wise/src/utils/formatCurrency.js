export function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return '₱0.00'
  return '₱' + Number(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatPercent(value) {
  if (value == null || isNaN(value)) return '0.0%'
  return (value * 100).toFixed(1) + '%'
}
