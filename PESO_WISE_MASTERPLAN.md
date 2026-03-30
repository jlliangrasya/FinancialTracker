# Peso Wise — Complete App Masterplan
> Feed this file to Claude Code. Follow every section in order. Do not skip steps. Do not add libraries not listed in the tech stack.

---

## 1. App Overview

**Name:** Peso Wise  
**Type:** Progressive Web App (PWA)  
**Purpose:** Personal finance tracker built for Filipinos — multi-bank, multi-user, offline-capable. Not just logging. Active budget tracking, burn rate forecasting, paycheck allocation, and financial coaching.  
**Target users:** Salaried employees, freelancers, and side hustlers managing multiple Philippine bank accounts (EastWest, Maribank, GCash, PNB, and any custom bank the user adds).

---

## 2. Tech Stack — Locked. Do Not Deviate.

| Layer | Technology | Notes |
|---|---|---|
| Language | JavaScript ES6+ | No TypeScript |
| UI Framework | React 18 | Component-based |
| Build Tool | Vite | Zero config, hot reload |
| Routing | React Router v6 | Pages + protected routes |
| Styling | CSS Modules | Scoped per component, no Tailwind |
| Charts | Chart.js + react-chartjs-2 | All 5 charts |
| Database | Firebase Firestore | Multi-user, offline, realtime |
| Auth | Firebase Auth | Email + Google sign-in |
| PIN Auth | localStorage (SHA-256 hashed) | Local PIN gate over Firebase session |
| State | React Context + useState | No Redux |
| Offline | Firestore offline persistence (built-in) | Enable in firebase config |
| PWA | vite-plugin-pwa | manifest + service worker |
| Hosting | Netlify | Auto-deploy from GitHub |
| Version Control | GitHub | Required for Netlify |

### 2.1 NPM packages to install

```bash
npm create vite@latest peso-wise -- --template react
cd peso-wise
npm install
npm install react-router-dom
npm install firebase
npm install react-chartjs-2 chart.js
npm install vite-plugin-pwa
```

### 2.2 Folder structure

```
peso-wise/
├── public/
│   ├── icons/          # PWA icons (192x192, 512x512)
│   └── manifest.json
├── src/
│   ├── auth/
│   │   ├── AuthContext.jsx
│   │   ├── PinContext.jsx
│   │   └── ProtectedRoute.jsx
│   ├── components/
│   │   ├── BottomNav.jsx
│   │   ├── QuickAdd.jsx
│   │   ├── ProgressBar.jsx
│   │   ├── BankCard.jsx
│   │   ├── InsightCard.jsx
│   │   └── Toast.jsx
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── PinSetup.jsx
│   │   ├── PinEntry.jsx
│   │   ├── Onboarding.jsx
│   │   ├── Dashboard.jsx
│   │   ├── QuickAddModal.jsx
│   │   ├── PaycheckAllocator.jsx
│   │   ├── BudgetTracker.jsx
│   │   ├── BurnRate.jsx
│   │   ├── Transactions.jsx
│   │   ├── Banks.jsx
│   │   ├── Bills.jsx
│   │   ├── SavingsGoals.jsx
│   │   ├── Investments.jsx
│   │   ├── DebtPlanner.jsx
│   │   ├── HealthScore.jsx
│   │   ├── SmartInsights.jsx
│   │   ├── Reports.jsx
│   │   └── Settings.jsx
│   ├── engine/
│   │   ├── bankBalance.js
│   │   ├── budgetStatus.js
│   │   ├── burnRate.js
│   │   ├── rollover.js
│   │   ├── healthScore.js
│   │   ├── insightsEngine.js
│   │   ├── debtPlanner.js
│   │   └── paycheckAllocator.js
│   ├── firebase/
│   │   ├── config.js
│   │   ├── transactions.js
│   │   ├── transfers.js
│   │   ├── budgetPeriods.js
│   │   ├── budgets.js
│   │   ├── bills.js
│   │   ├── savingsGoals.js
│   │   ├── investments.js
│   │   ├── debts.js
│   │   └── settings.js
│   ├── styles/
│   │   ├── global.css
│   │   └── variables.css
│   ├── utils/
│   │   ├── formatCurrency.js
│   │   ├── hashPin.js
│   │   ├── dateHelpers.js
│   │   └── exportData.js
│   ├── App.jsx
│   └── main.jsx
├── .env
├── vite.config.js
└── index.html
```

---

## 3. Environment Variables

Create `.env` in the project root. Never commit this file.

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

---

## 4. Firebase Setup

### 4.1 firebase/config.js

```js
import { initializeApp } from 'firebase/app'
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

// Enable offline persistence
enableIndexedDbPersistence(db).catch(console.error)
```

### 4.2 Firestore Security Rules

Deploy these rules in the Firebase console:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{collection}/{document} {
      allow read, write: if request.auth != null
        && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.userId;
    }
    match /settings/{userId} {
      allow read, write: if request.auth != null
        && request.auth.uid == userId;
    }
  }
}
```

---

## 5. Data Model — All Firestore Collections

Every document (except settings) must include `userId: string` matching Firebase Auth UID.

### 5.1 `transactions`
```js
{
  id: string,           // auto Firestore ID
  userId: string,       // Firebase Auth UID
  date: Timestamp,
  type: 'expense' | 'income',
  amount: number,       // always positive
  description: string,
  category: string,     // from EXPENSE_CATEGORIES or INCOME_CATEGORIES
  subCategory: string,
  bank: string,         // must match a bank in user's settings
  paymentMethod: string,
  isIncome: boolean,
  periodId: string,     // ref to budgetPeriods doc (nullable)
  createdAt: Timestamp,
}
```

### 5.2 `transfers`
```js
{
  id: string,
  userId: string,
  date: Timestamp,
  fromBank: string,
  toBank: string,
  amount: number,
  note: string,
  createdAt: Timestamp,
}
```

### 5.3 `budgetPeriods`
```js
{
  id: string,
  userId: string,
  periodType: 'weekly' | 'biweekly' | 'monthly' | 'custom',
  startDate: Timestamp,
  endDate: Timestamp,
  mode: 'combined' | 'separate',
  totalBudget: number,        // used when mode = 'combined'
  expensesBudget: number,     // used when mode = 'separate'
  billsBudget: number,        // used when mode = 'separate'
  status: 'active' | 'archived',
  createdAt: Timestamp,
}
```

### 5.4 `budgets`
```js
{
  id: string,
  userId: string,
  category: string,
  monthlyLimit: number,
}
```

### 5.5 `bills`
```js
{
  id: string,
  userId: string,
  name: string,
  amount: number,
  dueDay: number,         // 1-31, day of month
  frequency: 'Monthly' | 'Quarterly' | 'Semi-Annual' | 'Annual' | 'One-time',
  bank: string,
  category: string,
  paidMonths: string[],   // ['2026-03', '2026-04']
  isActive: boolean,
  createdAt: Timestamp,
}
```

### 5.6 `savingsGoals`
```js
{
  id: string,
  userId: string,
  name: string,
  targetAmount: number,
  targetDate: Timestamp,
  savedAmount: number,
  bank: string,
  createdAt: Timestamp,
}
```

### 5.7 `investments`
```js
{
  id: string,
  userId: string,
  name: string,
  type: string,           // from INVESTMENT_TYPES list
  platform: string,
  amountInvested: number,
  currentValue: number,
  dateStarted: Timestamp,
  notes: string,
  createdAt: Timestamp,
}
```

### 5.8 `debts`
```js
{
  id: string,
  userId: string,
  name: string,
  balance: number,
  interestRate: number,   // annual percentage e.g. 24 for 24%
  minPayment: number,
  type: 'Credit Card' | 'Personal Loan' | 'Home Loan' | 'Car Loan' | 'Other',
  startDate: Timestamp,
  createdAt: Timestamp,
}
```

### 5.9 `settings` (document ID = userId)
```js
{
  userId: string,
  banks: [
    { name: string, openingBalance: number, color: string }
  ],
  payDay: number,               // day of month
  currency: 'PHP',
  lowBalanceAlert: number,      // threshold in PHP
  customExpenseCategories: string[],
  customIncomeCategories: string[],
  onboardingCompleted: boolean,
  pinSetupCompleted: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

---

## 6. Category Lists — Hardcoded Constants

Create `src/utils/categories.js`:

```js
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
```

---

## 7. Authentication System — Full Flow

### 7.1 Overview

The app uses a two-layer auth system:

**Layer 1 — Firebase Auth:** Handles real authentication (email/password or Google). Session is persistent (`browserLocalPersistence`). User is never logged out of Firebase unless they explicitly tap "Switch account."

**Layer 2 — PIN Gate:** A 4-digit PIN stored as SHA-256 hash in `localStorage` keyed by `pesowise_pin_${uid}`. Every time the app opens or comes back from background, the PIN screen is shown. Firebase is already authenticated — the PIN just guards the UI.

### 7.2 Auth flow states

```
App opens
  └─ Firebase session exists?
       ├─ NO → Login page (email + Google)
       │         └─ Successful login
       │               └─ PIN setup completed? (check settings.pinSetupCompleted)
       │                     ├─ NO → PinSetup page (set + confirm PIN)
       │                     └─ YES → PinEntry page
       └─ YES → PIN setup completed?
                   ├─ NO → PinSetup page
                   └─ YES → PinEntry page
                               └─ Correct PIN → App (Dashboard)
```

### 7.3 PIN rules

- Exactly 4 digits, numeric only
- Cannot be all same digits (1111, 2222, etc.)
- Cannot be sequential (1234, 4321)
- Stored as SHA-256 hash: `sha256(uid + pin)`
- Max 3 wrong attempts before 30-second lockout
- After lockout, user can try PIN again or sign in with email/password
- "Switch account" = Firebase `signOut()` + clear PIN from localStorage + redirect to Login

### 7.4 hashPin utility

```js
// src/utils/hashPin.js
export async function hashPin(uid, pin) {
  const data = uid + pin
  const encoded = new TextEncoder().encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export function getPinKey(uid) {
  return `pesowise_pin_${uid}`
}

export async function savePin(uid, pin) {
  const hash = await hashPin(uid, pin)
  localStorage.setItem(getPinKey(uid), hash)
}

export async function verifyPin(uid, pin) {
  const stored = localStorage.getItem(getPinKey(uid))
  if (!stored) return false
  const hash = await hashPin(uid, pin)
  return hash === stored
}

export function clearPin(uid) {
  localStorage.removeItem(getPinKey(uid))
}
```

### 7.5 PIN screens to build

**Login.jsx** — Standard email + password form. Google sign-in button. "New to Peso Wise? Sign up" link. On success, check `settings.pinSetupCompleted` and route accordingly.

**PinSetup.jsx** — Two-step process:
- Step 1: "Create your 4-digit PIN" — 4 dot indicators + numpad
- Step 2: "Confirm your PIN" — same UI, validate match
- Progress bar showing step 1 of 2 / step 2 of 2
- On mismatch: shake animation + "PINs do not match. Try again."
- On success: save hashed PIN to localStorage, update `settings.pinSetupCompleted = true`, navigate to Dashboard

**PinEntry.jsx** — Daily use:
- Show user avatar (initials from displayName) + "Welcome back, [first name]"
- 4 dot indicators + numpad
- Wrong PIN: shake dots, show "Incorrect PIN — X attempts left"
- After 3 wrong attempts: show lockout screen with 30-second countdown timer
- "Switch account" link at bottom → Firebase signOut + clear PIN + Login page
- On correct PIN: navigate to Dashboard

### 7.6 AuthContext.jsx

```js
// Manages Firebase auth state
// Exposes: currentUser, loading, login(), loginWithGoogle(), logout(), signup()
// Sets Firebase persistence to browserLocalPersistence on init
```

### 7.7 PinContext.jsx

```js
// Manages PIN state for the session
// Exposes: isPinVerified, verifyPin(), resetPinVerified()
// isPinVerified = true after correct PIN entry
// resetPinVerified() called when app goes to background (visibilitychange event)
// On visibility hidden → set isPinVerified = false → show PinEntry on return
```

### 7.8 ProtectedRoute.jsx

Wraps all app routes. Checks:
1. Firebase auth (redirect to /login if not authenticated)
2. Onboarding completed (redirect to /onboarding if not)
3. PIN verified this session (show PinEntry if not)

---

## 8. All 15 Screens — Complete Specification

---

### Screen 1: Login (`/login`)

**Purpose:** First-time login and account switching.

**UI elements:**
- Peso Wise logo (P in blue rounded square)
- "Welcome to Peso Wise" heading
- Email input
- Password input (with show/hide toggle)
- "Sign in" primary button
- Divider "or"
- "Continue with Google" button (with Google logo)
- "Don't have an account? Sign up" link
- "Forgot password?" link

**Behavior:**
- On successful sign-in: check `settings.onboardingCompleted` → route to /onboarding or /pin-setup or /pin
- Show error messages inline below the relevant field
- Loading spinner on button while Firebase request is in flight

---

### Screen 2: PIN Setup (`/pin-setup`)

**Purpose:** One-time PIN creation after first login.

**UI elements:**
- Step indicator: "Step 1 of 2" / "Step 2 of 2"
- Progress bar (two segments)
- Title changes per step
- 4 PIN dot indicators
- Numeric keypad (3×4 grid: 1–9, blank, 0, backspace)
- No "skip" option — PIN is mandatory

**Step 1:** "Create your 4-digit PIN"  
**Step 2:** "Confirm your PIN" — validates match, shake + error on mismatch

**Validation before accepting:**
- Not all same digits
- Not sequential (1234, 2345, 9876, etc.)
- Show error: "PIN too simple. Avoid patterns like 1234 or 1111."

---

### Screen 3: PIN Entry (`/pin`)

**Purpose:** Every app open after initial setup.

**UI elements:**
- User avatar circle (initials, colored background)
- "Welcome back, [First name]"
- "Enter your 4-digit PIN"
- 4 PIN dot indicators
- Numeric keypad
- "Switch account" text link at bottom

**States:**
- Default: empty dots
- Filling: dots fill blue as digits entered
- Wrong PIN: dots turn red, shake animation, "Incorrect PIN — X attempts left"
- Lockout: lock icon, "Account locked. Try again in X seconds." countdown bar, "Sign in with email" button

---

### Screen 4: Onboarding (`/onboarding`)

**Purpose:** First-login setup wizard. Never shown again after completion.

**Step 1 — Your banks:**
- "Which banks do you use?" heading
- Default list: EastWest, Maribank, GCash, PNB (all checked by default)
- "+ Add custom bank" option
- For each selected bank: input field for opening balance
- Label: "Enter your current balance in each account"

**Step 2 — Budget limits:**
- "Set your monthly budget per category"
- List of all EXPENSE_CATEGORIES
- Number input next to each (in PHP)
- "Skip for now" option (can set later in Settings)

**Step 3 — Recurring bills:**
- "Add your regular bills"
- "+ Add bill" button → inline form: name, amount, due day, frequency, bank
- Pre-populated examples: Meralco, PLDT, Netflix
- "Skip for now" option

**Completion:**
- Set `settings.onboardingCompleted = true`
- Set `settings.pinSetupCompleted = true` (PIN was already set)
- Navigate to `/dashboard`

---

### Screen 5: Dashboard (`/dashboard`)

**Purpose:** Daily open screen. Full financial snapshot of the current month.

**Sections (top to bottom):**

**Header bar:**
- "Peso Wise" logo left
- Current month + year center
- Notification bell right (future)

**Net cash card:**
- "This month" label
- Total income minus total expenses (big number)
- "Leftover from [last month]: ₱X,XXX" (rollover from previous month)
- Green if positive, red if negative

**Burn Rate alert bar** *(power feature)*:
- Shows only if budget period is active
- "Burning ₱XXX/day — budget runs out in X days"
- Color: green (safe), amber (warning), red (critical)
- Tap → navigates to /burn-rate

**Bank balance cards** (horizontal scroll, one card per bank):
- Bank name, current balance (auto-calculated)
- Green if above low balance threshold, red if below
- Tap card → navigates to /banks

**Budget status** (top 5 categories by spending):
- Category name + progress bar (green/amber/red)
- "₱X,XXX of ₱X,XXX"
- "See all" → /budget-tracker

**Bills due in 7 days:**
- List of unpaid bills due within 7 days
- Shows bill name, amount, days until due
- "No bills due" empty state
- Tap → /bills

**Financial Health Score mini card** *(power feature)*:
- Score badge: e.g. "74/100"
- One-line description: "Good — keep it up!"
- Color-coded: red (0–40), amber (41–70), green (71–100)
- Tap → /health-score

**Smart insight of the day** *(power feature)*:
- One auto-generated insight card
- E.g. "You spent 34% more on food this month vs last month."
- Tap → /insights

**Savings goals progress:**
- Each goal with progress bar + % complete
- Tap → /savings-goals

**Floating action button:**
- Large "+" button fixed bottom-right
- Opens Quick Add modal

---

### Screen 6: Quick Add Modal (overlay from any screen)

**Purpose:** Log expense, income, or transfer in under 10 seconds.

**UI:**
- Slides up from bottom (bottom sheet)
- Drag handle at top
- Type selector tabs: **Expense** | **Income** | **Transfer**

**Expense fields:**
- Amount input (large, auto-focused, number keyboard)
- Category dropdown (from EXPENSE_CATEGORIES)
- Sub-category dropdown (filtered by category)
- Bank/wallet dropdown (user's banks)
- Payment method dropdown
- Date (defaults to today, tappable to change)
- Description text input (optional)
- "Save" primary button

**Income fields:**
- Amount input
- Source / Payer text input
- Category dropdown (from INCOME_CATEGORIES)
- Bank received in dropdown
- Date (defaults to today)
- Notes (optional)
- "Save" button → **triggers Paycheck Allocator if amount > 0**

**Transfer fields:**
- Amount input
- From bank dropdown
- To bank dropdown
- Purpose / note (optional)
- Date (defaults to today)
- Live balance check: "Insufficient funds in EastWest" if from-bank balance < amount
- "Save" button

**On save:**
- Write to Firestore transactions or transfers collection
- Update React context state immediately
- Show toast: "Expense saved ✓"
- Close modal
- Dashboard and all active screens re-render with new data

---

### Screen 7: Paycheck Allocator (`/paycheck-allocator`) *(power feature)*

**Purpose:** Triggered automatically after saving income. Allocate every peso before spending. Zero-based budgeting.

**Trigger condition:** Quick Add saved with type = "Income"

**UI layout:**
- "You received ₱[amount]" heading
- "Let's allocate every peso now" subheading
- Three allocation buckets with drag sliders + manual input:

**Bucket 1 — Bills (auto-populated):**
- Pre-fills with total of upcoming bills for the period
- User can adjust
- Shows: "Bills this period: ₱X,XXX"

**Bucket 2 — Savings:**
- Slider + manual input
- Shows savings goals and monthly needed amounts as reference

**Bucket 3 — Spending (Expenses):**
- Remaining amount (auto-calculated)
- Cannot be manually reduced below zero

**Live math bar:**
- Visual bar divided into three colored sections (bills / savings / spending)
- Updates as sliders move

**Unallocated remainder:**
- Shows in red if total of 3 buckets ≠ income amount
- "₱X,XXX unallocated" or "₱X,XXX over-allocated"

**"Confirm allocation" button:**
- Creates a new `budgetPeriods` document in Firestore with the allocated amounts
- Sets status = 'active'
- Navigates back to Dashboard

**"Skip for now" link:**
- Dismisses without creating period

---

### Screen 8: Budget Tracker (`/budget-tracker`) *(enhanced feature)*

**Purpose:** Active envelope budgeting. See allocated budget, log expenses against it, and track remaining budget in real time.

**Period selector (top of screen):**
- Tab pills: **Weekly** | **Bi-weekly** | **Monthly** | **Custom**
- When "Custom" selected: two date pickers appear (Start date, End date)
- Date range pill shows: "Mar 1 – Mar 15, 2026 · 6 days left"
- "Resets on [date]" note

**Budget mode toggle:**
- Two options displayed as card tabs:
  - **Combined budget** — one total budget shared between expenses and bills
  - **Separate budgets** — expenses have their own budget, bills have their own budget
- Switching mode re-renders the budget hero and footer

**Budget hero (changes based on mode):**

*Combined mode:*
- "Total allocated budget: ₱X,XXX"
- Single progress bar (green → amber at 80% → red at 100%)
- "₱X,XXX spent — XX% used"

*Separate mode — Expenses tab:*
- "Expenses budget: ₱X,XXX"
- Progress bar for expenses only

*Separate mode — Bills tab:*
- "Bills budget: ₱X,XXX"
- Progress bar for bills only

**Tab navigation: Expenses | Bills**

**Expenses tab:**
- List of all expense transactions within the current period
- Each row: colored dot (by category) + description + category + date + bank + amount
- "+ Add expense" button → opens Quick Add modal pre-set to Expense type
- Empty state: "No expenses logged this period yet."

**Bills tab:**
- List of all bills due within the current period
- Each bill row: status badge (Overdue / Due Soon / Upcoming / Paid) + name + due date + bank + amount + mark-paid checkbox
- Overdue badge: red background
- Due Soon badge (≤7 days): amber background
- Paid badge: green background
- Upcoming badge: gray background
- "+ Add bill" → opens bill creation form
- Empty state: "No bills due this period."

**Footer (always visible, fixed at bottom):**

*Combined mode:*
- Total expenses: −₱X,XXX
- Bills paid: −₱X,XXX
- Bills unpaid (due): −₱X,XXX (amber color)
- Divider
- **Remaining budget: ₱X,XXX** (large, color-coded)
- Status pill: "On track" / "Running low" / "Over budget!"
- Burn rate: "Burning ₱XXX/day"
- Resets on: [date]

*Separate mode:*
- Expenses section: spent / budget / remaining
- Bills section: paid / unpaid / budget / remaining
- Each with their own color status

**Auto-archive behavior:**
- When period end date passes, the period status changes to 'archived' in Firestore
- A new period is NOT auto-created — the user must start a new one or use Paycheck Allocator
- Historical periods are accessible in Reports

---

### Screen 9: Burn Rate Tracker (`/burn-rate`) *(power feature)*

**Purpose:** Show how fast the user is spending and predict when budget runs out.

**Calculations (in `engine/burnRate.js`):**
```js
const daysElapsed = daysSincePeriodStart()
const dailyAverage = totalSpent / daysElapsed
const daysRemaining = daysToPeriodEnd()
const projectedTotal = totalSpent + (dailyAverage * daysRemaining)
const safeDailyTarget = remainingBudget / daysRemaining
const runOutDate = addDays(today, remainingBudget / dailyAverage)
```

**UI sections:**
- Large stat: "₱[dailyAverage]/day" — current burn rate
- Predicted run-out date (if on current pace)
- Safe daily target: "Stay under ₱[safeDailyTarget]/day to stay on budget"
- Velocity bar: visual from Slow to Fast (based on % of safe target used)
- Alert banner: "At this pace you'll overspend by ₱X,XXX" (red if projected > budget)
- Spending pace chart: bar chart showing daily spend for each day in the period

---

### Screen 10: Transactions (`/transactions`)

**Purpose:** Full history of every peso in and out.

**Filter bar (sticky top):**
- Month selector (dropdown or scroll)
- Type filter: All | Expenses | Income | Transfers
- Bank filter: All | [each bank]
- Category filter: All | [each category]
- Search input: filters by description text

**Transaction list:**
- Grouped by date (today, yesterday, then dates)
- Each row: category color dot + description + category tag + bank + amount (red for expense, green for income, gray for transfer)
- Tap row → edit modal (same as Quick Add but pre-filled)
- Long press or swipe left → delete confirmation

**Summary header:**
- Total income this period: ₱X,XXX
- Total expenses this period: ₱X,XXX
- Net: ₱X,XXX

**Empty state:** "No transactions yet. Tap + to add your first one."

---

### Screen 11: Banks & Transfers (`/banks`)

**Purpose:** Live bank balances and inter-account transfers.

**Bank balance formula (in `engine/bankBalance.js`):**
```js
balance = openingBalance
  + SUMIFS(income where bank = this bank)
  - SUMIFS(expenses where bank = this bank)
  + SUMIFS(transfers where toBank = this bank)
  - SUMIFS(transfers where fromBank = this bank)
```

**UI sections:**

**Bank cards (one per bank):**
- Bank name + current balance (large)
- Status: "✓ OK" (green) / "⚠ Low balance" (amber) / "⛔ Negative" (red)
- Low balance threshold set in Settings
- Tap card → shows transaction history for that bank only

**Total across all banks:**
- Sum card at bottom of bank list

**Transfer form:**
- "Transfer between accounts" section
- From bank dropdown
- To bank dropdown
- Amount input
- Note / purpose (optional)
- Date (defaults today)
- Live check: "⚠ Insufficient funds in [bank]" if amount > from-bank balance
- "Transfer" button
- NOTE: transfers are NOT counted as income or expense. They only affect bank balances.

**Transfer history:**
- List of recent transfers
- From → To, amount, date, note

---

### Screen 12: Bills & Subscriptions (`/bills`)

**Purpose:** All recurring payments. Status tracking and due-date alerts.

**Summary bar:**
- Total bills this month: ₱X,XXX
- Paid: ₱X,XXX
- Unpaid: ₱X,XXX

**Bill list (sorted by status: Overdue first, then Due Soon, then Upcoming, then Paid):**
- Status badge + bill name + due day + bank + frequency + amount + mark-paid toggle
- "Days until due" auto-calculated: `dueDay - DAY(today)`, adjusted for month end
- Status rules:
  - Paid: bill.paidMonths includes current month ('2026-03')
  - Overdue: daysUntilDue < 0 AND not paid
  - Due Soon: daysUntilDue >= 0 AND daysUntilDue <= 7 AND not paid
  - Upcoming: daysUntilDue > 7 AND not paid
- Annual total per bill: auto-calculated based on frequency

**Mark paid behavior:**
- Adds current month string to `paidMonths` array in Firestore
- Resets automatically next month (new month string not in paidMonths)

**Add bill form:**
- Name, amount, due day (1–31), bank dropdown, category dropdown, frequency dropdown
- "+ Add bill" button at top right

---

### Screen 13: Savings Goals (`/savings-goals`)

**Purpose:** Track savings targets with projected completion.

**Calculations (in `engine/savingsGoals.js`):**
```js
const remaining = targetAmount - savedAmount
const monthsLeft = DATEDIF(today, targetDate, 'months')
const monthlyNeeded = monthsLeft > 0 ? remaining / monthsLeft : remaining
const percentComplete = Math.min(savedAmount / targetAmount, 1)
const isOnTrack = savedAmount / monthsElapsed >= monthlyNeeded
const projectedCompletion = addMonths(today, remaining / monthlySavingRate)
```

**Goal card (one per goal):**
- Goal name + stored-in bank
- Target amount + deadline
- Progress bar (filled proportionally, green when complete)
- "₱[saved] of ₱[target]"
- "₱[monthly needed]/month needed"
- "On track ✓" or "Behind ⚠" status
- "Est. completion: [date]"
- "Update savings" button → input field to update savedAmount
- Edit and delete options

**Add goal form:**
- Goal name, target amount, target date, starting saved amount, which bank

**Empty state:** "You have no savings goals yet. Add your first one to start tracking."

---

### Screen 14: Investments (`/investments`)

**Purpose:** Track investment portfolio. Feeds net worth calculation.

**Portfolio summary:**
- Total invested: ₱X,XXX
- Current value: ₱X,XXX
- Total gain/loss: ₱X,XXX (XX%)
- Color: green if gain, red if loss

**Investment list:**
- Each row: name + type badge + platform + amount invested + current value + gain/loss ₱ + gain/loss %
- Gain/loss: `currentValue - amountInvested`
- Gain/loss %: `(currentValue - amountInvested) / amountInvested * 100`
- Tap row → edit (mainly to update current value)

**Add investment form:**
- Name, type dropdown, platform/broker, amount invested, current value, date started, notes

---

### Screen 15: Debt Payoff Planner (`/debt-planner`) *(power feature)*

**Purpose:** Track debts and compare payoff strategies.

**Debt summary:**
- Total debt: ₱X,XXX
- Total monthly minimum payments: ₱X,XXX
- Estimated payoff date (based on selected strategy)

**Strategy toggle:**
- **Avalanche** — pay highest interest rate first (saves most money)
- **Snowball** — pay smallest balance first (fastest psychological wins)
- Show: "Avalanche saves ₱X,XXX vs Snowball"

**Calculations (in `engine/debtPlanner.js`):**
```js
// For each strategy, simulate monthly payments:
// - Apply minimum payments to all debts
// - Apply extra payment to target debt (avalanche: highest rate, snowball: lowest balance)
// - Calculate months to payoff per debt and total interest paid
```

**Debt list (ordered by strategy priority):**
- Debt name + type + balance + interest rate + min payment
- Priority badge: "Pay first" on the debt targeted by current strategy
- Payoff date for each debt
- Progress bar: balance paid vs original balance

**Extra payment impact calculator:**
- "If I pay an extra ₱[X] per month..."
- Shows new payoff date and interest saved

**Add debt form:**
- Name, type dropdown, current balance, annual interest rate (%), minimum monthly payment, start date

---

### Screen 16: Financial Health Score (`/health-score`) *(power feature)*

**Purpose:** Gamified single score reflecting overall financial health.

**Score calculation (in `engine/healthScore.js`):**

5 pillars, each 0–20 points:

| Pillar | Max | Criteria |
|---|---|---|
| Savings rate | 20 | % of income saved this month (20 pts = saving ≥20% of income) |
| Budget adherence | 20 | % of categories within budget (20 pts = 100% within budget) |
| Bill consistency | 20 | % of bills paid on time this month (20 pts = all paid) |
| Debt-to-income | 20 | Monthly debt payments vs income (20 pts = debt < 30% of income) |
| Emergency fund | 20 | Months of expenses covered in savings (20 pts = ≥3 months) |

Total score: sum of all 5 pillars (0–100)

**UI:**
- Large circular score gauge (e.g. donut chart)
- Score label: "Poor" (0–40) / "Fair" (41–60) / "Good" (61–80) / "Excellent" (81–100)
- 5 pillar breakdown bars (each showing score/20)
- Top insight: "Your weakest pillar is [X]. Here's how to improve it: [tip]"
- Score history line chart (last 6 months)
- Score recalculates every time any financial data changes

---

### Screen 17: Smart Insights (`/insights`) *(power feature)*

**Purpose:** Auto-generated observations from the user's transaction history.

**Insights generated (in `engine/insightsEngine.js`):**

```js
// Month-over-month: compare each category this month vs last month
// Top merchant: find most frequent payee by description
// Unusual spend: category spending > 150% of 3-month average
// Savings streak: consecutive months where savings > 0
// Budget wins: categories that finished under budget
// Biggest single expense: largest transaction this month
// Income trend: growing / stable / declining vs 3-month average
```

**Insight card format:**
- Icon (colored dot by type)
- Short headline: "Food spending up 34% vs last month"
- Detail: "You spent ₱4,200 on food this month vs ₱3,130 last month. Grab deliveries account for most of the increase."
- Actionable tip (where applicable)

**Insight types with icons:**
- Alert (amber) — spending spike, budget near limit
- Win (green) — under budget, savings streak, bill paid on time
- Info (blue) — comparisons, trends
- Warning (red) — overspent, negative net cash

**Display:**
- List of all insights for the current month
- Sorted: alerts and warnings first, then wins, then info
- "Insight of the day" = first item, shown as card on Dashboard

---

### Screen 18: Reports & Charts (`/reports`)

**Purpose:** Visual financial summaries. Month selector to view any past month.

**Month selector:**
- Left/right arrows to navigate months
- Current month shown by default

**5 charts (Chart.js):**

**Chart 1: Income vs Expenses (grouped bar chart)**
- X-axis: last 12 months
- Two bars per month: income (green) and expenses (red)
- Tap bar → shows month breakdown

**Chart 2: Spending by Category (doughnut chart)**
- Each segment = one expense category
- Shows % and ₱ amount
- Legend below chart

**Chart 3: Budget vs Actual (horizontal bar chart)**
- One bar per category
- Budget limit shown as background bar
- Actual spending shown as foreground bar
- Red if over budget

**Chart 4: Net Worth Trend (line chart)**
- X-axis: last 12 months
- Y-axis: total net worth (bank balances + investments - debts)
- Area fill below the line

**Chart 5: Financial Health Score History (line chart)**
- X-axis: last 6 months
- Y-axis: score (0–100)
- Horizontal reference lines at 40, 60, 80

**Top 5 Expenses table:**
- Category, amount, % of total spending

---

### Screen 19: Settings (`/settings`)

**Purpose:** Configuration and account management.

**Sections:**

**Account:**
- Display name and email (read-only)
- "Change PIN" → requires current PIN, then PinSetup flow
- "Sign out" → Firebase signOut + clear PIN + redirect to Login
- "Switch account" → same as sign out

**Banks:**
- List of user's banks with current opening balance
- Edit opening balance (affects all historical calculations)
- Add custom bank
- Cannot delete a bank that has transactions

**Categories:**
- View default categories (read-only)
- Add custom expense categories
- Add custom income categories

**Budget defaults:**
- Set default monthly limits per category (same as Onboarding Step 2)

**Alerts:**
- Low balance alert threshold (₱)
- Toggle: bills due reminder (7 days before)

**Data:**
- "Export as CSV" — downloads all transactions, transfers, bills as CSV
- "Export as JSON" — full data backup
- "Import from JSON" — restore from backup

**Danger zone:**
- "Delete account" — requires PIN + confirmation dialog — deletes all Firestore data + Firebase account

---

## 9. Calculation Engine — `src/engine/`

All calculation functions are pure JavaScript. No Firebase calls inside engine functions. Accept data as parameters, return computed values.

### 9.1 bankBalance.js
```js
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
```

### 9.2 budgetStatus.js
```js
export function calculateBudgetStatus(category, monthlyLimit, transactions, monthLabel) {
  const spent = transactions
    .filter(t => t.category === category && t.monthLabel === monthLabel && !t.isIncome)
    .reduce((sum, t) => sum + t.amount, 0)
  const remaining = monthlyLimit - spent
  const percentUsed = monthlyLimit > 0 ? spent / monthlyLimit : 0
  const status = percentUsed >= 1 ? 'over' : percentUsed >= 0.8 ? 'warning' : 'ok'
  return { spent, remaining, percentUsed, status }
}
```

### 9.3 burnRate.js
```js
export function calculateBurnRate(totalSpent, remainingBudget, periodStartDate, periodEndDate) {
  const today = new Date()
  const daysElapsed = Math.max(1, differenceInDays(today, periodStartDate))
  const daysRemaining = Math.max(0, differenceInDays(periodEndDate, today))
  const dailyAverage = totalSpent / daysElapsed
  const projectedTotal = totalSpent + (dailyAverage * daysRemaining)
  const safeDailyTarget = daysRemaining > 0 ? remainingBudget / daysRemaining : 0
  const willOverspend = projectedTotal > (totalSpent + remainingBudget)
  const overAmount = willOverspend ? projectedTotal - (totalSpent + remainingBudget) : 0
  return { dailyAverage, daysRemaining, safeDailyTarget, projectedTotal, willOverspend, overAmount }
}
```

### 9.4 rollover.js
```js
export function calculateRollover(previousMonthIncome, previousMonthExpenses, previousRollover = 0) {
  const netSavings = previousMonthIncome - previousMonthExpenses
  return previousRollover + netSavings
}
```

### 9.5 healthScore.js
```js
export function calculateHealthScore({ transactions, bills, debts, savingsGoals, monthLabel }) {
  // Each pillar returns a value 0–20
  const savingsRate = scoreSavingsRate(transactions, monthLabel)
  const budgetAdherence = scoreBudgetAdherence(transactions, monthLabel)
  const billConsistency = scoreBillConsistency(bills)
  const debtToIncome = scoreDebtToIncome(transactions, debts, monthLabel)
  const emergencyFund = scoreEmergencyFund(transactions, savingsGoals)
  const total = savingsRate + budgetAdherence + billConsistency + debtToIncome + emergencyFund
  const label = total >= 81 ? 'Excellent' : total >= 61 ? 'Good' : total >= 41 ? 'Fair' : 'Poor'
  return { total, label, pillars: { savingsRate, budgetAdherence, billConsistency, debtToIncome, emergencyFund } }
}
```

### 9.6 insightsEngine.js
```js
export function generateInsights(currentMonthTxns, prevMonthTxns, budgets, bills) {
  const insights = []
  // Compare category spending month over month
  // Find top merchant by description frequency
  // Flag categories > 150% of 3-month average
  // Calculate savings streak
  // Identify budget wins and losses
  return insights.sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type])
}
```

### 9.7 debtPlanner.js
```js
export function calculateDebtPayoff(debts, strategy = 'avalanche', extraPayment = 0) {
  // strategy: 'avalanche' (highest rate first) or 'snowball' (lowest balance first)
  // Returns: payoffSchedule[], totalInterestPaid, payoffDate per debt
}
```

---

## 10. Navigation Structure

### 10.1 Route definitions (App.jsx)

```
/login                  → Login (public)
/pin-setup              → PinSetup (requires Firebase auth)
/pin                    → PinEntry (requires Firebase auth)
/onboarding             → Onboarding (requires auth + PIN)
/dashboard              → Dashboard (protected)
/transactions           → Transactions (protected)
/budget-tracker         → BudgetTracker (protected)
/burn-rate              → BurnRate (protected)
/banks                  → Banks (protected)
/bills                  → Bills (protected)
/savings-goals          → SavingsGoals (protected)
/investments            → Investments (protected)
/debt-planner           → DebtPlanner (protected)
/health-score           → HealthScore (protected)
/insights               → SmartInsights (protected)
/reports                → Reports (protected)
/paycheck-allocator     → PaycheckAllocator (protected)
/settings               → Settings (protected)
```

### 10.2 Bottom navigation bar (mobile)

Shown on all protected routes. 5 tabs:

| Tab | Icon | Route |
|---|---|---|
| Home | House | /dashboard |
| Tracker | Bar chart | /budget-tracker |
| Add | Plus (large, accent) | Opens Quick Add modal |
| Banks | Building | /banks |
| More | Grid | Opens drawer: Bills, Savings, Investments, Debt, Health, Insights, Reports, Settings |

---

## 11. UI/UX Rules

### 11.1 Design principles
- Mobile-first. All layouts designed for 375px width minimum
- All touch targets minimum 44×44px
- Bottom navigation fixed, never overlaps content (add padding-bottom to page content)
- All monetary values formatted: `₱X,XXX.XX` using `toLocaleString('en-PH')`
- All percentages rounded to 1 decimal place
- All dates in Philippine format: "Mar 15, 2026"
- No hardcoded colors — use CSS variables from `variables.css`

### 11.2 Color system (variables.css)

```css
:root {
  --color-primary: #1565C0;
  --color-primary-light: #E3F2FD;
  --color-success: #2E7D32;
  --color-success-light: #E8F5E9;
  --color-warning: #E65100;
  --color-warning-light: #FFF3E0;
  --color-danger: #B71C1C;
  --color-danger-light: #FFEBEE;
  --color-text-primary: #212121;
  --color-text-secondary: #757575;
  --color-text-hint: #BDBDBD;
  --color-background: #FAFAFA;
  --color-surface: #FFFFFF;
  --color-border: #E0E0E0;
  --border-radius-sm: 6px;
  --border-radius-md: 10px;
  --border-radius-lg: 16px;
  --border-radius-xl: 24px;
}
```

### 11.3 Status color rules
- Green (success): within budget, positive balance, on track, paid, score > 70
- Amber (warning): 80–100% of budget used, low balance, 7 days to due date, score 41–70
- Red (danger): over budget, negative balance, overdue, score < 40

### 11.4 Loading states
- Every screen that fetches Firestore data shows a skeleton loader (gray animated rectangles) while loading
- Never show blank screens or unformatted numbers while data loads

### 11.5 Empty states
- Every list has a friendly empty state with an illustration (simple SVG) and a call-to-action button
- Examples: "No transactions yet. Tap + to add your first one."

### 11.6 Toast notifications
- Show for all successful saves: "Expense saved ✓", "Transfer complete ✓", "Goal updated ✓"
- Show for errors: "Failed to save. Check your connection."
- Duration: 3 seconds, slides in from bottom above nav bar

---

## 12. PWA Configuration

### 12.1 vite.config.js

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Peso Wise',
        short_name: 'PesoWise',
        description: 'Personal finance tracker for Filipinos',
        theme_color: '#1565C0',
        background_color: '#FAFAFA',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ]
      }
    })
  ]
})
```

---

## 13. Build Order — Follow Exactly

### Phase 1 — Foundation (do this first, everything depends on it)

- [ ] Step 1: Create Vite + React project, set up folder structure, install all npm packages
- [ ] Step 2: Create `variables.css` and `global.css` with full color system and base styles
- [ ] Step 3: Set up Firebase config, connect Firestore with offline persistence enabled
- [ ] Step 4: Build AuthContext (Firebase auth state, login, logout, Google sign-in)
- [ ] Step 5: Build PIN system — hashPin utility, PinContext, savePin, verifyPin, clearPin
- [ ] Step 6: Build Login page (email form + Google button)
- [ ] Step 7: Build PinSetup page (2-step wizard with validation)
- [ ] Step 8: Build PinEntry page (numpad, wrong attempts, 30-second lockout)
- [ ] Step 9: Build ProtectedRoute wrapper
- [ ] Step 10: Set up React Router with all routes in App.jsx
- [ ] Step 11: Write all Firestore collection helpers (firebase/ folder — all 9 files)
- [ ] Step 12: Write all calculation engine functions (engine/ folder — all 7 files)
- [ ] Step 13: Deploy to Netlify from GitHub (set up pipeline now — deploy early, deploy often)

### Phase 2 — Core logging

- [ ] Step 14: Build Onboarding wizard (3 steps)
- [ ] Step 15: Build Quick Add modal (expense, income, transfer tabs)
- [ ] Step 16: Build Paycheck Allocator screen
- [ ] Step 17: Build Transactions page (list, filter, search, edit, delete)

### Phase 3 — Dashboard + Banks

- [ ] Step 18: Build Dashboard (all sections: net cash, burn rate, bank cards, budget bars, bills alert, health mini, insight card, savings progress)
- [ ] Step 19: Build Banks & Transfers page
- [ ] Step 20: Build Burn Rate tracker screen
- [ ] Step 21: Build Bottom navigation bar

### Phase 4 — Budget Tracker + Planning

- [ ] Step 22: Build Budget Tracker (period tabs, date picker, combined/separate mode, expenses tab, bills tab, footer)
- [ ] Step 23: Build Bills & Subscriptions page
- [ ] Step 24: Build Savings Goals page
- [ ] Step 25: Build Investments page
- [ ] Step 26: Build Debt Payoff Planner

### Phase 5 — Power features

- [ ] Step 27: Build Financial Health Score screen
- [ ] Step 28: Build Smart Insights screen
- [ ] Step 29: Build Reports & Charts (all 5 Chart.js charts)
- [ ] Step 30: Build Settings page (banks, categories, PIN change, export, delete account)

### Phase 6 — PWA + Polish

- [ ] Step 31: Configure Vite PWA plugin, create manifest, generate icons
- [ ] Step 32: Add service worker (offline support via Firestore cache is already handled — service worker handles asset caching)
- [ ] Step 33: Add skeleton loaders to all data-fetching screens
- [ ] Step 34: Add empty states to all list screens
- [ ] Step 35: Add toast notification system
- [ ] Step 36: Mobile responsive pass — test all screens at 375px, 390px, 414px
- [ ] Step 37: Performance pass — lazy load routes, memoize expensive calculations

---

## 14. Key Business Rules

1. **Transfers are never income or expense.** They only affect bank balances via the transfer formula. Never add a transfer to income or expense totals.

2. **Bank balance formula is always:** `openingBalance + allIncomeToBank - allExpensesFromBank + allTransfersIn - allTransfersOut`

3. **Month label format:** Always `MMM-YYYY` (e.g. `Mar-2026`). Use this consistently across all collections for filtering.

4. **Budget period auto-archive:** When today > `period.endDate`, mark period as `archived`. Never delete old periods — they feed Reports.

5. **Rollover:** The previous month's net (income − expenses) carries forward to the next month's Dashboard as "Leftover from last month." This is a display calculation only — not stored separately.

6. **PIN is local-only.** The PIN hash lives in `localStorage`. It is not synced to Firestore or any server. If the user clears their browser data, they must set up a new PIN (Firebase auth session may still be valid).

7. **Multi-device PIN:** Each device has its own PIN stored in localStorage. The user sets PIN per device on first login on that device.

8. **Bills paid status:** Bills use `paidMonths: string[]` (e.g. `['2026-03']`). A bill is "paid this month" if the current `MMM-YYYY` string is in that array. This resets automatically as months change — no code needed.

9. **Health score recalculates on every data change.** It is never stored in Firestore — always computed from live data.

10. **Smart insights are computed client-side** from the user's transaction data. Not stored in Firestore.

11. **All monetary amounts stored as numbers in PHP.** No currency conversion.

12. **The Paycheck Allocator is triggered but not mandatory.** If the user skips it, no budget period is created and the Budget Tracker shows an empty state prompting them to set one up.

---

## 15. Netlify Deployment

### netlify.toml (create in project root)

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

The `[[redirects]]` rule is critical for React Router to work on Netlify. Without it, direct URL navigation and page refresh will return 404.

### Environment variables in Netlify
Add all `VITE_FIREBASE_*` variables in Netlify → Site settings → Environment variables. Never commit `.env` to GitHub.

---

## 16. Notes for Claude Code

- Build one phase at a time. Complete each step before moving to the next.
- After each step, verify the app runs without errors before proceeding.
- Every component that reads from Firestore must handle three states: loading, error, and success.
- All numbers displayed to users must be formatted — never show raw JavaScript floats.
- CSS Modules: every component gets its own `.module.css` file. No inline styles except for dynamic values (e.g. progress bar width as a percentage).
- Keep the calculation engine (src/engine/) completely separate from Firebase and React. Pure functions only. This makes them easy to test and reason about.
- If a feature is complex, build a working simple version first, then enhance. Never leave a broken screen.
- Test on mobile viewport (375px) after building each screen.
- The PIN system must be built in Phase 1 Step 5–8 before anything else. Every other feature depends on it.