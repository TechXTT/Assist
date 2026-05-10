# Phase 4J Brief — Account Type Detail (replaces the earlier "loan & investment detail" draft)

> Paste this into Claude Code as a follow-up to Phase 4I. Read end-to-end, propose plan + migration, confirm with the user, implement. This brief replaces the earlier `phase-4j-brief-loan-investment-detail.md` — the previous version only addressed loans and investments. This expanded version gives proper depth to **every** account type so each one actually models what it represents, not just a single number.

---

## 1. What this addendum delivers

After this lands, each account type captures the data that actually matters for that kind of money:

- **Cash** — balance + optional location/institution label. Stays simple by design.
- **Savings** — APY, optional institution. Renders projected annual interest and monthly accrual estimate.
- **Investment** — opt-in **holdings** model (ticker + shares + avg cost + last known price). Account balance auto-computes from the sum of position values. Per-position gain/loss when cost basis is set.
- **Crypto** — uses the same `Holding` model as investments. Different label and default tickers (BTC, ETH, SOL, etc.) but identical mechanics.
- **Credit card** — credit limit, APR, statement closing day, payment due day. Renders utilization %, available credit, and "carry cost if you keep this balance" projection.
- **Loan** — original principal, interest rate, monthly payment, term, loan-started date. Renders payoff date projection, total interest projected, paid-down progress bar.
- **Other** — balance + optional notes. Escape hatch, no depth.

All depth fields are **optional and opt-in**. Existing balance-only behavior stays intact. Users who want to keep an account simple keep it simple; users who want detail can fill in fields per-account at any time.

Out of scope (still): live price APIs, broker integrations, bank/Plaid integrations, buy/sell transaction ledgers, dividend tracking, tax-lot accounting, multi-currency holdings, FX conversion, reward-rate tracking on credit cards.

---

## 2. Design philosophy reminder

Manual-update is the rule. Every "current value" the app shows comes from a number the user typed in — balances, prices, rates, payments. The app's job is to do the math and display the consequences (payoff dates, interest accruals, position values), not to fetch data from the world. This keeps the system simple, free, and predictable, and avoids locking architecture decisions early.

---

## 3. Schema changes

### Extend `Account`

```prisma
model Account {
  // ... existing fields from 4I unchanged ...

  // Shared rate field (used by savings APY, credit APR, loan APR — semantically different but same shape)
  // For SAVINGS this is APY; for CREDIT and LOAN it's APR. Display label varies by type.
  rateBps                Int?      // basis points; 4.5% = 450; avoids float drift

  // Loan-specific
  originalPrincipalCents Int?
  monthlyPaymentCents    Int?
  loanTermMonths         Int?
  loanStartedAt          DateTime?

  // Credit-specific
  creditLimitCents       Int?
  statementDay           Int?      // 1–31
  paymentDueDay          Int?      // 1–31

  // Cash/savings/other-specific
  institution            String?   // optional label, e.g., "Revolut", "N26", "Trade Republic", "Coinbase"

  // Investment + crypto
  trackHoldings          Boolean   @default(false)  // when true, balanceCents is derived from holdings
  holdings               Holding[]
}
```

`rateBps` is a **single shared field** because it's the same concept — annual interest rate in basis points. The display label changes per type ("APY" for savings, "APR" for credit and loan), but the data shape is identical. Simpler than three separate fields.

### New `Holding` model

```prisma
model Holding {
  id                  String   @id @default(cuid())
  accountId           String
  account             Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  ticker              String                              // free text — "VWCE", "BTC", "AAPL"; no registry validation
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

`Decimal(20, 10)` for shares handles fractional stocks (buy €50 of a €104 ETF → 0.4823 shares) and crypto (0.00547 BTC). Prisma annotation; works on SQLite (text-stored) and Postgres (native decimal).

Migration name: `<ts>_account_type_detail`.

---

## 4. Math modules

Build a small helper per type. All return discriminated unions so the UI can render different states cleanly (computable / missing-data / edge-case).

### `src/lib/money/loans.ts`

```
projectPayoff({ balanceCents, rateBps, monthlyPaymentCents }):
  | { kind: "computable", monthsRemaining, payoffDate, totalInterestProjectedCents }
  | { kind: "payment_too_low" }
  | { kind: "missing_data", missing: string[] }
```

- Monthly rate `r = rateBps / 10000 / 12`.
- Monthly interest `i = balance * r`.
- If `payment <= i` → `payment_too_low` (loan never amortizes).
- Otherwise `n = -log(1 - (r * balance / payment)) / log(1 + r)` months. `payoffDate = today + ceil(n) months`. `totalInterestProjected = ceil(n) * payment - balance`.

Paid-down ratio (when `originalPrincipalCents` set): `1 - balance / originalPrincipal`.

### `src/lib/money/savings.ts`

```
projectInterest({ balanceCents, rateBps }):
  | { kind: "computable", annualInterestCents, monthlyInterestCents }
  | { kind: "missing_data" }
```

- `annual = balance * rateBps / 10000`.
- `monthly = annual / 12`.

These are simple-interest projections (don't compound across months in v1). Note in the UI footnote: "Estimate — assumes balance stays constant."

### `src/lib/money/credit.ts`

```
analyzeCredit({ balanceCents, creditLimitCents, rateBps, statementDay, paymentDueDay, today, tz }):
  {
    utilizationRatio?: number            // balance / limit, 0..1+
    availableCents?: number              // limit - balance, can be negative if over limit
    monthlyCarryCostCents?: number       // balance * rateBps / 10000 / 12
    nextStatementDate?: Date
    nextPaymentDueDate?: Date
    daysUntilStatement?: number
    daysUntilPayment?: number
  }
```

Each sub-field is undefined when its inputs are missing. UI conditionally renders.

### `src/lib/money/investments.ts`

```
positionValue(holding): cents
positionGainLoss(holding): { absoluteCents, ratio } | null    // null if no avgCost
accountValueFromHoldings(account): cents
```

Same as the previous 4J draft. When `Account.trackHoldings = true`, `Account.balanceCents` is denormalized from `accountValueFromHoldings` — recomputed and a `BalanceSnapshot` written on every holding add/edit/delete.

---

## 5. Server actions

In `src/app/(app)/money/actions.ts` (or a sub-file `accounts.ts`):

- `updateAccountDetails(accountId, patch)` — single action that accepts any of the type-specific fields. Validate via Zod with discriminated schemas per type (savings allows `rateBps`+`institution`, credit allows the credit fields, etc.). Reject patches with fields irrelevant to the account's type. Doesn't touch `balanceCents` — that's the `updateAccountBalance` action from 4I.
- Holdings actions (unchanged from previous 4J draft):
  - `setTrackHoldings(accountId, enabled)` — flip flag; on enable, balance becomes derived; on disable, balance becomes manual again with the last-derived value frozen. Holdings rows preserved either way.
  - `addHolding(accountId, input)` — insert + recompute account balance + snapshot.
  - `updateHolding(id, patch)` — recompute balance + snapshot if shares/price changed.
  - `updatePrice(holdingId, lastKnownPriceCents)` — quick-action variant; recompute + snapshot.
  - `deleteHolding(id)` — remove + recompute + snapshot.

All actions go through `requireOwner` checks (existing pattern from Phase 2).

---

## 6. UI changes

### Account form — type-specific expandable sections

In the existing add/edit account form, replace the flat field list with a "Details (optional)" section that **changes based on selected type**:

- **Cash** → optional Institution field, optional Notes.
- **Savings** → APY (percent input), Institution, Notes.
- **Investment** → "Track individual holdings" toggle (default off), Institution.
- **Crypto** → same as investment, but field labels reference "exchange/wallet" instead of "broker", and the holdings dialog default ticker placeholder is "BTC" instead of "VWCE".
- **Credit** → Credit limit, APR (percent), Statement closing day (1–31), Payment due day (1–31), Institution.
- **Loan** → Original principal, APR (percent), Monthly payment, Loan term (months), Loan started on (date), Institution.
- **Other** → Notes only.

All optional. Form-level validation is permissive: any subset can be filled. Math modules render "missing data" hints inline when computations would need fields the user hasn't filled.

### Account row rendering — type-specific enrichment

Each account row in the Net Worth tab shows the existing balance line, then a type-specific enrichment line below (only when relevant data is filled):

- **Cash** — nothing extra unless Institution set; then small caption "at Revolut".
- **Savings** — "≈ €34/mo interest at 4.0% APY" or "Add an APY to see projected interest" when balance is set but rate isn't.
- **Investment / Crypto** (when trackHoldings) — total gain/loss across holdings (if any cost basis), expandable holdings sub-list. When trackHoldings is off, behaves like savings (just balance).
- **Credit** — utilization bar with "€420 of €2,000 used (21%)" caption; if balance > 0 and rateBps set, "≈ €5/mo carry cost at 19.9% APR"; "Statement closes in 4 days" when statementDay is set.
- **Loan** — paid-down progress bar (if originalPrincipal set) with "€2,300 of €8,000 paid (29%)"; payoff projection line ("On track to pay off in 28 months — June 2028" / "Add an interest rate to see payoff projection" / "At this rate, payments don't cover monthly interest").
- **Other** — nothing extra unless Notes set; then small caption with the note (truncated).

### Holdings sub-list (investment + crypto)

When `trackHoldings = true`, the row expands into a holdings table:
- Columns: ticker (+ optional name), shares, current price, position value, gain/loss (if cost basis).
- Each row: "Update price" quick-action, "Edit" overflow, "Delete" overflow.
- "Add holding" button opens dialog: ticker (uppercase auto-format), name (optional), shares (decimal), avg cost (optional), last known price, last update date (defaults today).

### Empty states
- No accounts: existing 4I empty state.
- No holdings (when trackHoldings on, no holdings yet): "No holdings yet — add a position to get started."

---

## 7. Tone

The depth fields are exactly the places where the app could slip into "finance app" voice — celebrating gains, scolding debt, congratulating savings rate. Resist all of it. Same audit standard as the rest of the Money module.

Examples per type:

- **Savings**: "≈ €34/mo interest at 4.0% APY" — flat fact, no "great rate!"
- **Credit utilization**: "€420 of €2,000 used (21%)" — neutral. No "good!" / "warning!" until utilization > 80% (then a calm "above 80% — heads up" line, single time, not in your face).
- **Credit carry cost**: "≈ €5/mo at 19.9% APR if you keep this balance" — informative, no shame.
- **Loan progress**: "€2,300 of €8,000 paid (29%) · payoff: June 2028" — no encouragement, no pressure.
- **Loan payment too low**: "At this rate, payments don't cover monthly interest yet — bump the amount or check the rate." — actionable, neutral.
- **Holding gain**: "+€42.10 · +3.4%" — subtle green at most. No flames, no rockets.
- **Holding loss**: "−€18.30 · −1.2%" — subtle amber at most. No red, no warning icons.
- **Update toasts**: "Saved." / "Holding added." / "Price updated. New balance: €1,402." — terse, no fanfare.

Read every new string aloud before shipping. Especially gain/loss and utilization displays — those are the hardest to keep neutral and the most likely to feel judgy.

---

## 8. Acceptance criteria

This addendum is done when:

- [ ] Migration `<ts>_account_type_detail` runs cleanly. No existing data shape changes.
- [ ] Existing accounts created in 4I keep working in balance-only mode without forced detail entry.
- [ ] User can fill type-specific fields on each account type via the edit form, with type-aware field sets.
- [ ] **Cash**: institution label renders if set; nothing required.
- [ ] **Savings**: with APY set, monthly interest estimate renders; without APY, the friendly "Add an APY" hint shows.
- [ ] **Investment + Crypto**: trackHoldings toggle works; adding holdings recomputes account balance and creates a `BalanceSnapshot`; per-holding gain/loss shows correctly when cost basis is set; fractional shares (e.g., 0.4823) round-trip via Decimal.
- [ ] **Credit**: utilization bar reflects balance/limit; carry-cost line appears when balance > 0 and APR set; statement/due day countdowns compute correctly across month boundaries.
- [ ] **Loan**: payoff projection renders when balance + APR + monthly payment all present; payment-too-low edge case renders without crashing; paid-down progress bar appears only when originalPrincipal set.
- [ ] **Other**: notes render; no other depth.
- [ ] Toggling trackHoldings off preserves the last-derived balance and leaves holdings rows intact.
- [ ] Type-specific math modules (loans, savings, credit, investments) live in `src/lib/money/` and have unit-style coverage at minimum for the edge cases listed (payment_too_low, missing_data, fractional shares, statement-day across month boundaries).
- [ ] Net worth chart still ticks correctly when holdings drive a balance change.
- [ ] Dashboard "Money this month" net-worth line is unchanged from 4I.
- [ ] 375px responsive: holdings sub-list collapses to stacked rows; credit utilization bar wraps cleanly; loan and savings projections wrap cleanly.
- [ ] `npx tsc --noEmit` and `npx next build` clean.
- [ ] Tone audit: every new string passes the read-aloud check; no celebratory language on gains/savings/payoffs; no alarmist language on losses/debt/utilization.

---

## 9. Don't deviate without asking

Stop and ask before:
- Adding a live price API (Alpha Vantage, Yahoo, IEX, CoinGecko, etc.).
- Adding broker, bank, or exchange integrations.
- Building a buy/sell transaction ledger inside investment/crypto accounts.
- Adding tax-lot accounting (FIFO/LIFO) or wash-sale logic.
- Validating tickers against any registry.
- Adding dividend, distribution, or interest-earned ledger entries (savings interest is projection-only in v1).
- Adding reward-rate or cashback tracking on credit cards.
- Multi-currency support within a single account.
- Compounding savings interest across months in the projection (simple interest only, footnoted as estimate).
- Auto-fetching loan amortization schedules or credit card statement histories.
- Bright red / bright green for gain/loss or utilization displays — keep them subtle (stone neutral, soft amber/soft green at most).

After implementation: demo at minimum one account of each type with depth fields filled, plus one without (to confirm graceful absence). Walk through the dashboard net-worth line and the per-account enrichments in the Net Worth tab. Ask the user to verify before declaring this done.
