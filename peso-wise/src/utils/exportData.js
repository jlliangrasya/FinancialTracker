export function exportToCSV(transactions, transfers, bills) {
  const headers = ['Date','Type','Amount','Description','Category','Bank','Payment Method']
  const rows = transactions.map(t => [
    t.date ? new Date(t.date.seconds * 1000).toLocaleDateString() : '',
    t.isIncome ? 'Income' : 'Expense',
    t.amount,
    t.description || '',
    t.category || '',
    t.bank || '',
    t.paymentMethod || '',
  ])

  const transferHeaders = ['Date','From Bank','To Bank','Amount','Note']
  const transferRows = transfers.map(t => [
    t.date ? new Date(t.date.seconds * 1000).toLocaleDateString() : '',
    t.fromBank,
    t.toBank,
    t.amount,
    t.note || '',
  ])

  let csv = 'Transactions\n'
  csv += headers.join(',') + '\n'
  rows.forEach(r => { csv += r.map(v => `"${v}"`).join(',') + '\n' })
  csv += '\nTransfers\n'
  csv += transferHeaders.join(',') + '\n'
  transferRows.forEach(r => { csv += r.map(v => `"${v}"`).join(',') + '\n' })

  downloadFile(csv, 'peso-wise-export.csv', 'text/csv')
}

export function exportToJSON(data) {
  const json = JSON.stringify(data, null, 2)
  downloadFile(json, 'peso-wise-backup.json', 'application/json')
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
