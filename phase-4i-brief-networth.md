# Phase 4I Brief — Accounts & Net Worth (focused addendum to Phase 4)

> Paste this into Claude Code as a follow-up. Read end-to-end, propose plan + migration, confirm with the user, implement. Phases 1–4 (4A–4F) are shipped; 4H (Income Sources) is queued. 4I can ship before, after, or interleaved with 4H — they touch independent surfaces, with the only overlap being the dashboard Money card. If both addenda land sequentially, the later one merges its dashboard line into whatever 4H/4I shape the earlier one left behind.

---

## 1. What this addendum delivers

After this lands:

1. A new **Net Worth** tab in `/money` (last tab in the row) where the user can model his accounts — checking, savings, brokerage, crypto, credit card, student loan, etc. — and track total net worth over time via manually-entered balance snapshots.
2. A **Net worth** line on the dashboard "Money this month" card, with the current value and the delta since the start of the month.
3. A simple net-worth-over-time line chart and a current-composition donut, computed from the user's snapshot history.
4. No external API integration. No real-time price fetching. No bank linking. Pure manual updates — user punches in a balance whenever they check it, the app keeps history.

Out of scope (deliberately): real-time investment prices, ticker/position tracking, cost basis, P&L, automatic bank balance sync, multi-currency conversion, asset class auto-categorization. All of those can be layered on later without restructuring this.

---

## 2. Design philosophy

The point of this module is **net worth visibility**, not portfolio management. The user is a student with maybe 3–5 accounts, no active trading, and ~monthly check-ins on his balances. The whole module is built around that cadence:

- Balance updates are manual, one tap, one number.
- The chart's data points are exactly the user's snapshot events — no interpolation, no fake daily granularity. If you update once a month, you get ~12 dots a year. Honest.
- Investments are just "an account with a balance you update when you check it." Same UX as savings. Real-time prices are a future feature.

Resist any urge to add bank API integration, ticker symbols, or live prices in this phase. They're separate beasts and locking in choices here would be premature.

---

## 3. Schema additions

Two new models, no changes to existing tables.

```prisma
model Account {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name              String                              // "Revolut checking", "N26 savings", "Trade Republic", "Visa credit"
  type              String                              // cash | savings | investment | crypto | credit | loan | other
  isLiability       Boolean  @default(false)            // drives net worth math; defaults from type but user-editable
  balanceCents      Int      @default(0)                // always stored positive; sign applied at render time via isLiability
  currency          String   @default("EUR")
  includeInNetWorth Boolean  @default(true)             // user can toggle individual accounts in/out of total
  archived          Boolean  @default(false)
  notes             String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  snapshots         BalanceSnapshot[]
}

model BalanceSnapshot {
  id           String   @id @default(cuid())
  accountId    String
  account      Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  balanceCents Int
  takenAt      DateTime @default(now())
  note         String?
  createdAt    DateTime @default(now())
  @@index([accountId, takenAt])
}
```

Migration name: `<ts>_accounts_and_networth`. `isLiability` defaults from type on create (`true` for credit/loan, `false` otherwise) but the field is the source of truth — flipping it overrides the default behavior. `balanceCents` is always non-negative; the sign in net worth math comes from `isLiability`.

---

## 4. Net worth math (`src/lib/money/networth.ts`)

```
calculateNetWorth(userId): Promise<{ totalCents, assetCents, liabilityCents, byType: Record<string, number> }>
```

For all non-archived, `includeInNetWorth = true` accounts:
- Sum `balanceCents` where `isLiability = false` → assets.
- Sum `balanceCents` where `isLiability = true` → liabilities.
- Total = assets − liabilities.
- `byType` is a breakdown by account type (for the composition donut), with liabilities as negative entries.

```
netWorthHistory(userId, range: { from?: Date, to?: Date }): Promise<Array<{ at: Date, totalCents: number }>>
```

For each `BalanceSnapshot` in the user's history (across all included accounts) within the range:
1. Sort all snapshots by `takenAt` ascending.
2. Walk through them, maintaining a per-account "last known balance" map.
3. At each snapshot point, update the map and compute the running total (assets − liabilities, summed across the map). Emit a data point.

This produces a step-function-ish series: net worth only "changes" when an account got updated. Connect with lines on the chart. Don't interpolate.

---

## 5. Server actions

In `src/app/(app)/money/actions.ts` (or a sub-file `accounts.ts`):

- `createAccount(input)` → validate Zod, insert account, create initial `BalanceSnapshot` with `balanceCents = account.balanceCents`. Revalidate `/money` + `/dashboard`.
- `updateAccount(id, patch)` → owner check, update fields. Does NOT touch balance — that's the dedicated action below.
- `updateAccountBalance(id, newBalanceCents, takenAt?, note?)`:
  1. Owner check.
  2. Update `Account.balanceCents = newBalanceCents`.
  3. Insert a `BalanceSnapshot` with the new value and the supplied or current timestamp.
  4. Revalidate.
- `archiveAccount(id)` / `unarchiveAccount(id)` → toggle `archived`; snapshots preserved.
- `deleteSnapshot(id)` → owner check (via snapshot's account), delete. The user might log a wrong number; let them clean up. Doesn't auto-rewind `Account.balanceCents` — that field reflects the most recent intentional update, not the latest snapshot. If a deletion leaves a gap, that's fine, the history just gets less granular.
- `setIncludeInNetWorth(id, included)` → toggle. Triggers re-render of dashboard + tab.

Use the existing `requireOwner` helper. Authorize by checking `account.userId === session.user.id`.

---

## 6. UI — Net Worth tab

Sixth tab in `/money`, placed at the end (so existing tab order isn't disrupted). Inside:

### Top — Net worth summary card
- Big headline: "€12,340 net worth" — color: stone if positive, amber if negative.
- Sub-line: "€14,200 assets · €1,860 liabilities".
- Delta since start of current month: "▲ €230 this month" (or "▼ €40"). Use the snapshot history; for the start-of-month value, take the running total at the first day of the current month in user's tz.

### Middle — Two charts side-by-side (stack on mobile)
- **Net worth over time** (Recharts `LineChart`): X = snapshot timestamps, Y = running net worth. Range selector: 1M / 3M / 6M / 1Y / All (defaults to 6M). Tooltip shows the date and net worth on hover. No interpolation between points.
- **Composition** (Recharts donut): breakdown by account type as of today. Liabilities show as a separate red slice OR labeled negative — pick the rendering that's clearest at small sizes. Click a slice → filters the account list below.

### Bottom — Accounts list
- Sorted: assets first (by type, then balance desc), then liabilities. Archived in a collapsed "Archived" section below.
- Each row shows: account name, type label with small icon, current balance (formatted), "Last updated N days ago" relative time, "Update balance" primary button, overflow menu (edit, view history, archive, toggle include-in-net-worth).
- Each row's balance is rendered with sign awareness: liability accounts show as "−€X" in muted red; assets show plain.
- The toggle "Include in net worth" is visible on each row's overflow menu and reflected by a subtle visual indicator when excluded (e.g., dimmed row, "(excluded)" tag).

### Update balance dialog
Pre-filled with current balance and today's date, both editable. Optional note field. Confirm → server action → toast: "Updated. €X → €Y."

### Add account button
Form fields: name (required), type (radio cards with icons: Cash / Savings / Investment / Crypto / Credit / Loan / Other), is liability (toggle, defaults from type), starting balance (cents-aware input), notes (optional). Submit → create + initial snapshot + revalidate.

### Snapshot history view (per-account drill-down)
Reached via overflow menu → "View history". Shows a vertical list of all `BalanceSnapshot` rows for that account, newest first: date, balance, note, delete button. No edit on snapshots — if a number is wrong, delete and add a new one.

### Empty state
"No accounts yet — add one to start tracking your net worth."

---

## 7. Dashboard integration

Insert one new line into the Money this month card, between the existing "next expected income" line (from 4H if shipped) and the savings-goals progress line:

> **Net worth: €12,340 · ▲ €230 this month**

- Click → `/money?tab=networth`.
- If the user has zero non-archived accounts with `includeInNetWorth = true`, hide the line entirely — don't render "€0 net worth" which would be misleading.
- If 4H hasn't shipped yet, this line slots in just after upcoming bills.

No additional dashboard card. The Money card is already dense.

---

## 8. Tone

Same money-module restraint. Net worth is one of the most emotionally-loaded numbers in the app — don't celebrate or scold.

Examples:
- "▲ €230 this month" / "▼ €40 this month" (deltas — neutral arrows, no emoji, no "Nice!").
- "Updated. €4,200 → €4,310." (balance change toast).
- "Net worth: €-340 — heads up." (negative net worth — calm, no alarm).
- "No accounts yet — add one to start tracking your net worth." (empty state).
- "Excluded from net worth." (toggle confirmation toast).
- For the snapshot delete confirm: "Delete this snapshot? The history will show fewer points but won't reshape the totals."

Read every new string aloud. If it would sound like a finance app trying to make you feel something, soften it.

---

## 9. Acceptance criteria

This addendum is done when:

- [ ] Migration `<ts>_accounts_and_networth` runs cleanly; no existing data touched.
- [ ] User can create accounts of each type (cash, savings, investment, crypto, credit, loan, other).
- [ ] `isLiability` defaults correctly from type on create but is user-editable.
- [ ] Updating an account balance creates a snapshot AND updates `Account.balanceCents`.
- [ ] Net worth headline matches `(sum of asset balances) − (sum of liability balances)` for included accounts.
- [ ] Toggling `includeInNetWorth` off removes the account from the total immediately.
- [ ] Net-worth-over-time chart renders one point per snapshot, with the running total computed correctly across multiple accounts.
- [ ] Composition donut shows the right asset/liability split.
- [ ] Snapshot history per account is viewable; deleting a snapshot updates the chart but doesn't rewind `balanceCents`.
- [ ] Dashboard Money card shows the net worth line + month delta when at least one account is included; hides cleanly when zero.
- [ ] Negative net worth renders amber, not red; copy stays neutral.
- [ ] 375px responsive: charts stack vertically, accounts list collapses to single column, update-balance dialog stays usable.
- [ ] `npx tsc --noEmit` and `npx next build` clean.
- [ ] Tone audit: every new string passes the read-aloud check.

---

## 10. Don't deviate without asking

Stop and ask before:
- Adding any paid dependency. Recharts/date-fns already cover the charts.
- Integrating a price API (Alpha Vantage, Yahoo, etc.) for live investment values — explicitly out of scope for this phase.
- Adding a Plaid/Open Banking integration — explicitly out of scope.
- Adding ticker/position/share-count fields to `Account` — investment tracking stays balance-only.
- Auto-computing snapshots from transactions (don't try to derive account balances by summing transaction history; balances and transactions are independent in this module).
- Converting currencies for the net worth total — single-currency v1.
- Adding more account types beyond the seven specified — `other` is the escape hatch.

After implementation: demo the Net Worth tab with a few accounts of different types (including at least one liability), walk through updating a balance and seeing the chart update, and check the dashboard line. Ask the user to verify before declaring this done.
