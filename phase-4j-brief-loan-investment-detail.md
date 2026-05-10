# Phase 4J Brief — Loan & Investment Detail (follow-up to 4I)

> Paste this into Claude Code as a follow-up to Phase 4I. Read end-to-end, propose plan + migration, confirm with the user, implement. 4I shipped accounts as balance-only, which works for cash/savings but is too thin for loans (need rate + payment + payoff projection) and investments (need holdings, not just a number). This addendum adds proper depth to both account types without introducing live-price APIs or bank integrations.

---

## 1. What this addendum delivers

After this lands:

1. **Loan accounts** can capture original principal, interest rate, monthly payment, and term — and display a payoff date projection plus a paid-down progress bar.
2. **Investment accounts** can have **holdings** (ticker + shares + avg cost + last known price), and the account's balance auto-computes from the sum of position values. Per-holding gain/loss is shown.
3. Both depth features are **opt-in per account** — existing balance-only behavior stays as a default for users who don't want the detail.
4. No external APIs. No live price fetching. No bank integrations. Manual updates still — the philosophy from 4I holds.

Out of scope (still): real-time price feeds, broker integration (e.g., Trade Republic API), tax-lot accounting (FIFO/LIFO), buy/sell transaction ledger inside an account, dividend tracking, options/derivatives, multi-currency holdings within one account.

---

## 2. Schema changes

### Extend `Account`

```prisma
model Account {
  // ... existing fields from 4I unchanged ...

  // Loan-specific fields (all optional; populated when type = "loan" and user fills them)
  originalPrincipalCents Int?
  interestRateBps        Int?      // basis points: 4.5% APR = 450; avoids float drift
  monthlyPaymentCents    Int?
  loanTermMonths         Int?      // total term length (optional — used for context only)
  loanStartedAt          DateTime?

  // Investment-specific
  trackHoldings          Boolean   @default(false)  // when true, balanceCents is derived from holdings
  holdings               Holding[]
}
```

### New `Holding` model

```prisma
model Holding {
  id                  String   @id @default(cuid())
  accountId           String
  account             Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  ticker              String                              // free text — "VWCE", "BTC", "AAPL"; not validated against any registry
  name                String?                             // optional human-readable, e.g., "Vanguard FTSE All-World"
  shares              Decimal  @db.Decimal(20, 10)        // fractional shares + crypto need precision
  avgCostCents        Int?                                // per share, optional (user may not track cost basis)
  lastKnownPriceCents Int                                 // per share, manually entered
  lastPriceUpdate     DateTime @default(now())
  notes               String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  @@index([accountId])
}
```

`Decimal` for shares because fractional shares (€50 buys 0.4823 shares of a €104 stock) and crypto units (0.00547 BTC) both need real precision. SQLite stores it as text — the precision is an annotation Prisma uses on Postgres. Works fine on both.

Migration: `<ts>_loan_and_investment_detail`.

---

## 3. Loan math (`src/lib/money/loans.ts`)

```
projectPayoff({ balanceCents, interestRateBps, monthlyPaymentCents }):
  | { kind: "computable", monthsRemaining, payoffDate, totalInterestProjectedCents }
  | { kind: "payment_too_low", message }            // payment doesn't cover monthly interest
  | { kind: "missing_data", missing }
```

If all three of `balanceCents`, `interestRateBps`, `monthlyPaymentCents` are present:

1. Monthly rate `r = interestRateBps / 10000 / 12`.
2. Monthly interest accrual `i = balanceCents * r`.
3. If `monthlyPaymentCents <= i` → return `payment_too_low` (the loan never amortizes; flag friendly, not alarmist: "At this rate, payments don't cover monthly interest yet — bump the amount or check the rate.").
4. Otherwise, months remaining `n = -log(1 - (r * balanceCents / monthlyPaymentCents)) / log(1 + r)`.
5. `payoffDate = today + ceil(n) months`.
6. `totalInterestProjectedCents = ceil(n) * monthlyPaymentCents - balanceCents`.

If any field is missing, return `missing_data` with a list. The UI uses that to render a "Add interest rate to see payoff projection" hint.

Paid-down ratio (when `originalPrincipalCents` is set): `1 - balanceCents / originalPrincipalCents`. Render as a progress bar from 0% to 100% with subtle color.

---

## 4. Investment math (`src/lib/money/investments.ts`)

```
positionValue(holding): cents
  = round(holding.shares * holding.lastKnownPriceCents)

positionGainLoss(holding): { absoluteCents, ratio } | null
  // null if avgCostCents is not set
  = {
      absoluteCents: round(holding.shares * (holding.lastKnownPriceCents - holding.avgCostCents)),
      ratio: (holding.lastKnownPriceCents - holding.avgCostCents) / holding.avgCostCents
    }

accountValueFromHoldings(account): cents
  = sum of positionValue across non-archived holdings
```

When `Account.trackHoldings = true`, `Account.balanceCents` is **derived** from `accountValueFromHoldings` and stored on the account row whenever a holding is added/edited/deleted (denormalized for query speed; recompute via a single helper). The user cannot manually edit balance on a holdings-tracked account — the "Update balance" button is replaced with "Update holdings" which opens the holdings list.

`BalanceSnapshot` is still created on each holdings-driven balance change, same as 4I — net worth chart works unchanged.

---

## 5. Server actions

In `src/app/(app)/money/actions.ts` (or `accounts.ts` if it exists):

- `updateLoanDetails(accountId, { originalPrincipalCents?, interestRateBps?, monthlyPaymentCents?, loanTermMonths?, loanStartedAt? })` → owner check, update fields. No snapshot — these are static metadata, not balance.
- `setTrackHoldings(accountId, enabled)`:
  - Owner check.
  - When turning ON: if no holdings exist yet, just flip the flag; the user adds holdings next. Set `balanceCents = 0` until first holding lands.
  - When turning OFF: convert current `accountValueFromHoldings` into a static balance, leave holdings rows intact (archived-by-toggle pattern), `balanceCents` becomes manually-editable again.
- `addHolding(accountId, { ticker, name?, shares, avgCostCents?, lastKnownPriceCents, notes? })`:
  - Owner check on parent account, must have `trackHoldings = true`.
  - Insert holding.
  - Recompute `Account.balanceCents` and create a `BalanceSnapshot`.
- `updateHolding(id, patch)` → recompute account balance + snapshot if shares/price changed.
- `updatePrice(holdingId, lastKnownPriceCents)` → quick-action variant of update, just for price; recompute balance + snapshot.
- `deleteHolding(id)` → remove, recompute balance + snapshot.

Owner check via existing `requireOwner` pattern.

---

## 6. UI changes

### Account form (additions when type = "loan")
After the existing fields, an expandable "Loan details (optional)" section:
- Original principal (cents-aware input).
- Interest rate (percent input, e.g., "4.5", stored as 450 bps).
- Monthly payment (cents-aware).
- Loan term in months (number input).
- Loan started on (date picker).

All optional. Form-level zod validation: if any one is set, that's fine; the projection just renders missing-data hints until the trio (balance, rate, payment) is complete.

### Account form (additions when type = "investment" or "crypto")
- Toggle: **"Track individual holdings"** (default off).
- Note under the toggle: "Turn this on to track stocks, ETFs, or crypto by ticker and shares. Off = just a single balance number."

### Loan account row (Net Worth tab)
Below the existing balance line, add:
- Paid-down progress bar with "€X of €Y paid (Z%)" caption — only if `originalPrincipalCents` is set.
- One-line payoff projection: "On track to pay off in 28 months — June 2028." or "Add an interest rate to see payoff projection." or "At this rate, payments don't cover monthly interest." — depending on the projectPayoff result.

### Investment account row (Net Worth tab)
When `trackHoldings = true`:
- The row shows account name, total derived balance, total gain/loss across holdings (if any cost basis is set), and an "Update holdings" button.
- Click expands into a sub-list of holdings, each row: ticker (+ optional name), shares, current price, position value, gain/loss (if cost basis set, with color: stone if flat, subtle green if up, subtle amber if down — never red, never bright).
- Each holding row has a "Update price" quick-action, an "Edit" overflow, and a "Delete" overflow.
- "Add holding" button opens a small dialog: ticker (uppercase auto-format), name (optional), shares (decimal input), avg cost per share (optional), last known price per share, last update date (defaults today).

### Holdings empty state
"No holdings yet — add a position to get started."

---

## 7. Tone

Loans and investment performance can both veer into emotionally-loaded territory. Same restraint as the rest of the Money module:

- Loan progress: "€2,300 of €8,000 paid (29%) · payoff: June 2028." — no "great progress!" or "still a long way to go".
- Payment-too-low warning: "At this rate, payments don't cover monthly interest yet — bump the amount or check the rate." — neutral, actionable.
- Holding gain: "+€42.10 · +3.4%" — no green flame, no upward arrow with celebration.
- Holding loss: "−€18.30 · −1.2%" — no red flag, no warning icon. Subtle amber if anything.
- Holdings empty state: "No holdings yet — add a position to get started."
- Update toasts: "Holding added." / "Price updated. New balance: €1,402."

Read every new string aloud. Especially the gain/loss displays — those are the hardest to keep neutral.

---

## 8. Acceptance criteria

This addendum is done when:

- [ ] Migration `<ts>_loan_and_investment_detail` runs cleanly. No existing data shape changes.
- [ ] Existing loan and investment accounts created in 4I continue to work in balance-only mode (no forced migration to detail mode).
- [ ] User can fill loan details on an existing or new loan account; payoff projection renders correctly when all three required fields are present and shows missing-data hints otherwise.
- [ ] Payment-too-low edge case renders the friendly warning, doesn't crash.
- [ ] Paid-down progress bar appears only when `originalPrincipalCents` is set.
- [ ] User can toggle "Track holdings" on an investment account and add holdings.
- [ ] Adding/editing/deleting a holding correctly recomputes `Account.balanceCents` and creates a `BalanceSnapshot` (visible in the net worth chart).
- [ ] Per-holding gain/loss appears only when `avgCostCents` is set; absent gracefully otherwise.
- [ ] Toggling "Track holdings" off preserves the current balance and leaves holdings rows intact (so toggling back on restores the detail).
- [ ] Fractional shares (e.g., 0.4823) round-trip correctly via Decimal.
- [ ] 375px responsive: holdings list collapses into stacked rows, loan projection wraps cleanly.
- [ ] `npx tsc --noEmit` and `npx next build` clean.
- [ ] Tone audit: gain/loss colors stay subtle, no celebratory or alarmist copy anywhere.

---

## 9. Don't deviate without asking

Stop and ask before:
- Adding a live price API (Alpha Vantage, Yahoo Finance, IEX, etc.) — explicitly out of scope.
- Adding broker integration (Trade Republic, Interactive Brokers, etc.).
- Building a buy/sell transaction ledger inside investment accounts (we're storing current state, not transaction history).
- Adding tax-lot accounting (FIFO/LIFO) or wash-sale logic.
- Validating tickers against any registry — they're free text, user's responsibility.
- Adding dividend or distribution tracking — separate future feature.
- Multi-currency support within a single account.
- Auto-fetching loan rate or amortization schedules from a service.
- Bright red / bright green for gain/loss displays — keep them subtle (stone neutral, soft amber/soft green at most).

After implementation: demo a loan account with full details + projection, an investment account with 2–3 holdings (one with cost basis, one without), and confirm the dashboard net worth still ticks correctly. Ask the user to verify before declaring this done.
