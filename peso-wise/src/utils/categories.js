export const INCOME_CATEGORIES = [
  'Salary', 'Freelance / Project', 'Business Income',
  'Investment Returns', 'Side Income', 'Bonus / Incentive',
  'Gift / Allowance', 'Other Income'
]

export const EXPENSE_CATEGORIES = [
  'Food & Dining', 'Transportation', 'Housing & Rent',
  'Bills & Utilities', 'Healthcare', 'Personal Care',
  'Shopping & Clothing', 'Entertainment', 'Education',
  'Subscriptions', 'Family & Support', 'Savings Contribution',
  'Investment Contribution', 'Miscellaneous'
]

export const EXPENSE_SUBCATEGORIES = {
  'Food & Dining': ['Groceries','Restaurants','Fast Food','Coffee','Food Delivery'],
  'Transportation': ['Jeepney/Bus/MRT','Grab/Taxi','Gas & Fuel','Parking & Toll'],
  'Housing & Rent': ['Rent','Condo Dues','Home Maintenance'],
  'Bills & Utilities': ['Electricity','Water','Internet','Mobile Load'],
  'Healthcare': ['Medicine','Doctor / Hospital','Dental','Lab Tests'],
  'Personal Care': ['Salon / Haircut','Gym','Skincare'],
  'Shopping & Clothing': ['Clothes','Shoes','Accessories','Electronics'],
  'Entertainment': ['Movies','Events','Streaming','Hobbies'],
  'Education': ['Tuition','Books','Online Courses'],
  'Subscriptions': ['Netflix','Spotify','YouTube','Other Subscriptions'],
  'Family & Support': ['Family Remittance','Gifts','Allowance'],
  'Savings Contribution': ['Emergency Fund','Goal Savings'],
  'Investment Contribution': ['Stocks','Mutual Fund','Crypto'],
  'Miscellaneous': ['Other'],
}

export const PAYMENT_METHODS = [
  'Cash', 'GCash', 'Bank Transfer', 'Credit Card', 'Debit Card', 'Online Payment'
]

export const INVESTMENT_TYPES = [
  'Stocks / Equities', 'Mutual Fund / UITF', 'Cryptocurrency',
  'Time Deposit', 'Bonds / T-Bills', 'Real Estate', 'Business'
]

export const BILL_FREQUENCIES = [
  'Monthly', 'Quarterly', 'Semi-Annual', 'Annual', 'One-time'
]

export const DEFAULT_BANKS = ['EastWest', 'Maribank', 'GCash', 'PNB']
