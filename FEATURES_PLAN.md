# Peso Wise — 4 New Features Plan

## Context
Adding four new features to differentiate Peso Wise in the Play Store: GCash PDF import, Financial Challenges, Loan Tracker with amortization, and toggleable Couples/Business modes in Settings. These features target Filipino users specifically and are being built ahead of a React Native / Expo migration.

---

## Implementation Order
1. **Loan Tracker** — extends existing page, no new packages, pure math
2. **Toggleable Modes** (Couples + Business) — Settings infrastructure needed early
3. **Financial Challenges** — reads existing transactions, standalone page
4. **GCash PDF Import** — requires new npm package, most parsing risk

---

## Feature 1: Loan Tracker with Amortization

**Complexity: L**

### New Files
- `src/firebase/loans.js` — `addLoan`, `updateLoan`, `deleteLoan`, `getLoans`, `markLoanPayment` (mirror `debts.js` pattern)
- `src/engine/loanAmortization.js` — pure functions:
  - `calculateMonthlyPayment(principal, annualRate, termMonths)` — standard PMT formula
  - `calculateAmortizationSchedule(loan)` — returns array of `{ periodNumber, paymentDate, paymentAmount, principalPortion, interestPortion, remainingBalance }`
  - `calculate56Schedule(principal, termWeeks, frequency)` — flat 20% interest, divide by periods
  - `getLoanSummary(loan, paidPeriods)` — totals, next due, overdue count
- `src/pages/LoanTracker.jsx` — rendered inside DebtPlanner (not a standalone page):
  - Loan list with summary cards (type badge, principal, next payment, progress bar)
  - Add Loan form: loanName, loanType (PAG-IBIG / SSS / Bank Personal Loan / Credit Card Installment / 5-6), principalAmount, interestRate, termMonths, startDate, paymentFrequency
  - Amortization table modal: scrollable, checkbox per row to mark paid, paid rows strikethrough
  - 5-6 type: show "Collection per period" prominently; use daily/weekly periods

### Modified Files
- `src/pages/DebtPlanner.jsx` — add tab switcher `[Debt Payoff | Loan Tracker]` at top using `useState('debts'|'loans')`; render `<LoanTracker />` when `activeView === 'loans'`
- `src/pages/DebtPlanner.module.css` — add tab styles (same pattern as `QuickAdd.module.css`)

### Firestore
New collection `loans`:
```
userId, loanName, loanType, principalAmount, interestRate,
termMonths, startDate, paymentFrequency, firstPaymentDate,
paidPeriods: [{ periodNumber, paidAt, amountPaid }], notes, createdAt
```

### Risk
- 5-6 is flat interest, NOT standard PMT — use `totalRepayable = principal * 1.2; periodicPayment = totalRepayable / numPeriods`
- Engine is pure JS — zero browser APIs, migrates to React Native unchanged

---

## Feature 2: Toggleable Modes (Settings)

**Complexity: M for Business, L for Couples**

### Settings Changes
Extend Firestore settings object (non-breaking via `updateUserSettings`):
```js
{ couplesMode: false, sharedBudgetId: null, businessMode: false }
```
Add these to the `refreshUserProfile` patch block in `src/context/AuthContext.jsx`.

### Settings Page (`src/pages/Settings.jsx`)
Add a new **"Features"** section block with two toggle rows:
- **Couples Mode** toggle → calls `updateUserSettings(uid, { couplesMode: !current })`
- **Business Mode** toggle → calls `updateUserSettings(uid, { businessMode: !current })`
When Couples Mode is on, render inline `<CouplesModePanel />` (invite by token flow).

### Business Mode — New Files
- `src/firebase/businessTransactions.js` — `addBusinessTransaction`, `getBusinessTransactions`, `deleteBusinessTransaction` (identical pattern to `transactions.js`, collection = `'businessTransactions'`)
- `src/pages/Business.jsx` — daily sales/expense entry (inline form), weekly/monthly P&L summary card, transaction list grouped by date
- `src/pages/Business.module.css`

### Business Mode — Modified Files
- `src/App.jsx` — add route `/business` → `<Business />`
- `src/AppLayout.jsx` — load `settings`, derive `featureFlags = { businessMode, couplesMode }`, pass to `<BottomNav featureFlags={featureFlags} />`
- `src/components/BottomNav.jsx` — accept `featureFlags` prop; conditionally add Business entry to `DRAWER_ITEMS` when `featureFlags.businessMode === true`; add Business SVG icon case

### Couples Mode — New Files
- `src/firebase/sharedBudgets.js` — `createSharedBudget`, `acceptInvite(token, userId)`, `getSharedBudget`, `getSharedTransactions`
- `src/pages/CouplesSetup.jsx` — invite panel: generate invite token, share link, show pending/active partner name

### Couples Mode — Modified Files
- `src/pages/Transactions.jsx` — when `couplesMode && sharedBudgetId`, fetch shared transactions, merge with personal list, show "Partner" badge on partner's transactions

### Firestore
New collection `sharedBudgets`:
```
createdBy, members: [uid1, uid2], memberEmails: [...],
status ('pending'|'active'), inviteToken, createdAt
```

### Risk (Couples)
- Email-based invite is unsafe (Firestore rules block querying other users' settings) → use **invite token** (user generates a code, partner enters it to join)
- Firestore security rules must be extended to allow both `members` UIDs to read/write `sharedBudgets/{sharedId}`

---

## Feature 3: Financial Challenges

**Complexity: M**

### New Files
- `src/firebase/challenges.js` — `addChallenge`, `updateChallenge`, `deleteChallenge`, `getChallenges` (mirror `savingsGoals.js`)
- `src/utils/challengePresets.js` — constant array of preset challenge templates:
  - No-Spend Week (7 days, no non-essential spending)
  - Save ₱500 This Week (7 days, savings transactions ≥ ₱500)
  - 30-Day Savings Streak (log savings every day for 30 days)
  - Under Budget This Month (stay within all category limits for a full period)
- `src/engine/challengeProgress.js` — `evaluateChallenge(challenge, transactions, budgets)` → `{ progress, progressPct, isComplete, isFailed, statusText }`. Progress computed client-side from existing transactions — no redundant Firestore writes.
- `src/pages/Challenges.jsx` — three sections: Active (cards with progress bars), Available Presets (grid with "Start" button), Completed/Failed history. Custom challenge creation form: name, type, goal amount, duration, allowed categories (for no-spend), reward note.
- `src/pages/Challenges.module.css`

### Modified Files
- `src/App.jsx` — add route `/challenges`
- `src/components/BottomNav.jsx` — add Challenges to `DRAWER_ITEMS` (trophy/flag SVG icon)

### Firestore
New collection `challenges`:
```
userId, name, type ('no-spend'|'save-amount'|'streak'|'under-budget'|'custom'),
isPreset, targetAmount, targetCategory, allowedCategories: [],
startDate, endDate, durationDays, status ('active'|'completed'|'failed'),
rewardNote, createdAt
```

### Risk
- On Challenges page mount: run `evaluateChallenge` for all active challenges; if `isFailed` and status is still `'active'`, call `updateChallenge(id, { status: 'failed' })` — client-side sweep, no Cloud Functions needed

---

## Feature 4: GCash PDF Import

**Complexity: XL**

### New Dependency
```
npm install pdfjs-dist
```
Lazy-load via dynamic import to keep initial bundle lean:
```js
const pdfjsLib = await import('pdfjs-dist')
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url
).href
```

### New Files
- `src/utils/gcashParser.js` — pure parsing functions (no browser APIs except what pdfjs provides):
  - `parseGCashPDF(pdfDocument)` — iterates all pages, collects text items
  - `groupTextItemsByRow(items, tolerance=3)` — groups by Y coordinate proximity
  - `mapRowsToTransactions(rows, headerXRanges)` — assigns text to columns by X range; detects header row by looking for "Date", "Description", "Debit", "Credit"; parses amounts (strip commas/₱, parse float); debit → expense, credit → income
  - `guessCategory(description)` — keyword matching (e.g. "GRAB" → Transportation, "MERALCO" → Bills & Utilities, "SHOPEE" → Shopping)
- `src/components/GCashImport.jsx` — multi-step modal:
  - Step 1: File drop zone (`<input type="file" accept=".pdf" />`)
  - Step 2: Parse with loading spinner ("Parsing PDF…")
  - Step 3: Preview table — checkbox, date, description, amount, type, category `<select>` (pre-filled by `guessCategory`); duplicate rows shown with warning badge, checkbox defaulted off
  - Step 4: "Import X transactions" confirm → loop `addTransaction` calls, show progress ("Importing 3 of 12…"), success toast
- `src/components/GCashImport.module.css`

### Modified Files
- `src/pages/Settings.jsx` — in existing **Data** section, add "Import from GCash" button; `showGCashImport` state controls modal; pass `existingTransactions` for duplicate detection
- `src/pages/Transactions.jsx` — add Import icon button in page header as a more discoverable entry point

### Duplicate Detection
Fingerprint: `dateISO + '|' + amount + '|' + description.toLowerCase().trim()` — compare against existing transactions fetched on modal open.

### Risk
- GCash PDF format can change — use header detection (not fixed column indices); show clear error if header row not found
- pdfjs-dist does NOT work in React Native — all pdfjs calls are isolated in `gcashParser.js`; for the Expo build, swap parser for a Cloud Function that accepts PDF upload and returns JSON

---

## Files Summary

| File | Action | Feature |
|------|--------|---------|
| `src/pages/DebtPlanner.jsx` | Modify — add tab switcher | Loan Tracker |
| `src/pages/DebtPlanner.module.css` | Modify — add tab styles | Loan Tracker |
| `src/firebase/loans.js` | Create | Loan Tracker |
| `src/engine/loanAmortization.js` | Create | Loan Tracker |
| `src/pages/LoanTracker.jsx` | Create | Loan Tracker |
| `src/pages/Settings.jsx` | Modify — add Features section + GCash button | Modes + GCash |
| `src/context/AuthContext.jsx` | Modify — patch new settings fields | Modes |
| `src/AppLayout.jsx` | Modify — derive + pass featureFlags | Business Mode |
| `src/components/BottomNav.jsx` | Modify — conditional Business nav + Challenges nav | Modes + Challenges |
| `src/firebase/businessTransactions.js` | Create | Business Mode |
| `src/pages/Business.jsx` | Create | Business Mode |
| `src/pages/Business.module.css` | Create | Business Mode |
| `src/firebase/sharedBudgets.js` | Create | Couples Mode |
| `src/pages/CouplesSetup.jsx` | Create | Couples Mode |
| `src/pages/Transactions.jsx` | Modify — merge shared transactions | Couples Mode |
| `src/App.jsx` | Modify — add /challenges, /business routes | Challenges + Business |
| `src/firebase/challenges.js` | Create | Challenges |
| `src/utils/challengePresets.js` | Create | Challenges |
| `src/engine/challengeProgress.js` | Create | Challenges |
| `src/pages/Challenges.jsx` | Create | Challenges |
| `src/pages/Challenges.module.css` | Create | Challenges |
| `src/utils/gcashParser.js` | Create | GCash Import |
| `src/components/GCashImport.jsx` | Create | GCash Import |
| `src/components/GCashImport.module.css` | Create | GCash Import |

---

## Verification

- **Loan Tracker**: Add a sample PAG-IBIG loan and a 5-6 loan; verify amortization table math; mark a period paid and confirm it persists
- **Business Mode**: Toggle on in Settings, verify Business nav item appears; add a sale and expense; check P&L summary
- **Couples Mode**: Generate invite token on one account, accept on another; verify shared transactions appear with "Partner" badge
- **Challenges**: Start a "Save ₱500" challenge; add a savings transaction; verify progress bar updates; let a challenge expire and verify it auto-fails
- **GCash Import**: Upload a real GCash PDF; verify rows parse correctly; check duplicate detection; confirm imported transactions appear in Transactions page
