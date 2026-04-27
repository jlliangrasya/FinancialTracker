// ─── Per-page fixed verses ────────────────────────────────────────────────────

export const PAGE_VERSES = {
  budgetTracker: {
    quote: 'Know well the condition of your flocks, and give attention to your herds.',
    reference: 'Proverbs 27:23',
  },
  debtPlanner: {
    quote: 'The wicked borrow and do not repay, but the righteous give generously.',
    reference: 'Psalm 37:21',
  },
  transactions: {
    quote: 'Lazy hands make for poverty, but diligent hands bring wealth.',
    reference: 'Proverbs 10:4',
  },
  healthScore: {
    quote: 'Command those who are rich in this present world not to be arrogant nor to put their hope in wealth, which is so uncertain, but to put their hope in God, who richly provides us with everything for our enjoyment.',
    reference: '1 Timothy 6:17',
  },
  burnRate: {
    quote: "Suppose one of you wants to build a tower. Won't you first sit down and estimate the cost to see if you have enough money to complete it?",
    reference: 'Luke 14:28',
  },
  investments: {
    quote: 'The plans of the diligent lead to profit as surely as haste leads to poverty.',
    reference: 'Proverbs 21:5',
  },
  reports: {
    quote: 'For the love of money is a root of all kinds of evils. It is through this craving that some have wandered away from the faith.',
    reference: '1 Timothy 6:10',
  },
}

// ─── Savings page — daily rotation ───────────────────────────────────────────

export const SAVINGS_VERSES = [
  {
    quote: 'In the house of the wise are stores of choice food and oil, but a foolish man devours all he has.',
    reference: 'Proverbs 21:20',
  },
  {
    quote: 'Go to the ant, you sluggard; consider its ways and be wise! It stores its provisions in summer and gathers its food at harvest.',
    reference: 'Proverbs 6:6–8',
  },
  {
    quote: 'Dishonest money dwindles away, but whoever gathers money little by little makes it grow.',
    reference: 'Proverbs 13:11',
  },
  {
    quote: "A good person leaves an inheritance for their children's children.",
    reference: 'Proverbs 13:22',
  },
]

// ─── Bills page — daily rotation ─────────────────────────────────────────────

export const BILLS_VERSES = [
  {
    quote: 'Pay to all what is owed to them: taxes to whom taxes are owed, revenue to whom revenue is owed, respect to whom respect is owed, honor to whom honor is owed.',
    reference: 'Romans 13:7',
  },
  {
    quote: 'The wicked borrow and do not repay, but the righteous give generously.',
    reference: 'Psalm 37:21',
  },
]

// ─── Dashboard — daily rotation (remaining general verses) ───────────────────

export const DASHBOARD_VERSES = [
  {
    quote: 'You cannot manage what you cannot measure.',
    reference: '— Peter Drucker',
  },
  {
    quote: 'Whoever can be trusted with very little can also be trusted with much.',
    reference: 'Luke 16:10',
  },
  {
    quote: 'Commit to the Lord whatever you do, and he will establish your plans.',
    reference: 'Proverbs 16:3',
  },
  {
    quote: 'For which of you, desiring to build a tower, does not first sit down and count the cost?',
    reference: 'Luke 14:28',
  },
  {
    quote: 'Honor the Lord with your wealth and with the firstfruits of all your produce.',
    reference: 'Proverbs 3:9',
  },
]

// ─── PIN screen — always fixed ────────────────────────────────────────────────

export const PIN_QUOTE = {
  quote: 'You cannot manage what you cannot measure.',
  reference: '— Peter Drucker',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dailyIndex(pool) {
  const day = Math.floor(Date.now() / 86400000)
  return day % pool.length
}

export function getDashboardVerse() {
  return DASHBOARD_VERSES[dailyIndex(DASHBOARD_VERSES)]
}

export function getSavingsVerse() {
  return SAVINGS_VERSES[dailyIndex(SAVINGS_VERSES)]
}

export function getBillsVerse() {
  return BILLS_VERSES[dailyIndex(BILLS_VERSES)]
}
