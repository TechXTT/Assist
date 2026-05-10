# Phase 4H Brief — Income Sources (focused addendum to Phase 4)

> Paste this into Claude Code as a follow-up to Phase 4. Read end-to-end, propose plan with the migration and file additions, confirm with the user, then implement. Phases 1–4 (sub-phases 4A–4F) are shipped and verified. 4G (Gmail receipt scan) is deferred; this addendum precedes it.

---

## 1. What this addendum delivers

After this lands:

1. A new **Income** tab in `/money` (between "Bills & Subscriptions" and "Goals") where the user can model recurring or one-off income sources — paycheck, allowance, scholarship payout, etc.
2. A **Mark received** flow on each income source that creates a positive `Transaction` and advances the cadence (or archives, for one-off sources).
3. The Spending tab gets a tri-state **All / Expenses / Income** filter, defaulting to Expenses (no behavior change for existing users).
4. The dashboard "Money this month" card adds a **net line** at the top (€X net — €Y in, €Z out) and a **next-expected-income** line below upcoming bills.

Out of scope: tax categorization, paycheck deduction modeling, multiple-payee inheritance, irregular gig-income forecasting. Income tracking stays manual-confirm — assistant suggests when income is expected, user marks it received. Symmetry with the Bills/Subscriptions pattern.

---

## 2. Pre-flight

- The existing `Transaction` model already stores signed `amountCents` (positive = income, negative = expense). No changes to it.
- The `Transaction.category` field is a free-text string. Income transactions get their category from the parent `IncomeSource.category`. No `BudgetCategory` row required for income — budgets are spending-only.
- Reuse the established cadence-advance pattern from `Bill` (recurring + `dueDay`) and `Subscription` (`billingCycle` + `nextChargeAt`). Don't reinvent.
- All money/period helpers from Phase 4 (`formatCents`, `currentMonth(tz)`, etc.) stay as-is and get used here.
- Currency stays single (`DEFAULT_CURRENCY`, currently EUR).

---

## 3. Schema additions

New model:

```prisma
model IncomeSource {
  id                  String   @id @default(cuid())
  userId              String
  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name                String                              // "Part-time job", "Allowance", "Scholarship payout"
  expectedAmountCents Int                                 // expected per cycle; actual on receipt may differ
  currency            String   @default("EUR")
  cadence             String                              // monthly | biweekly | weekly | oneoff
  cadenceAnchorDay    Int?                                // for monthly: 1-31 day of month; null otherwise
  nextExpectedAt      DateTime                            // the next date we expect income
  category            String   @default("Income")         // tag for the resulting Transaction
  source              String   @default("manual")         // for symmetry with Bill/Subscription
  active              Boolean  @default(true)             // one-off becomes inactive after first receive
  lastReceivedAt      DateTime?
  notes               String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

No changes to existing tables. Migration: `<ts>_income_sources`.

---

## 4. Cadence handling

In `src/lib/money/income.ts`:

```
nextDateForCadence(currentDate: Date, cadence: string, anchorDay?: number, tz: string): Date
```

Behavior:
- `monthly` + `anchorDay = 15` → next 15th of the month after `currentDate`. If currentDate is the 14th, returns currentDate's month's 15th. If currentDate IS the 15th or later, returns next month's 15th. Cap `anchorDay` at the last valid day of the target month (Feb 31 → Feb 28/29).
- `biweekly` → `currentDate + 14 days`. The anchor is implicit in `nextExpectedAt` — once set on creation, it just advances by 14 each receive.
- `weekly` → `currentDate + 7 days`.
- `oneoff` → no advance. Setting `active = false` is the caller's job.

All cadence math respects the user's timezone for date boundaries.

---

## 5. Server actions

In `src/app/(app)/money/actions.ts` (or a sub-file `income.ts` if it's getting busy):

- `createIncomeSource(input)` → validate Zod → insert. `nextExpectedAt` required; cadenceAnchorDay required when cadence === "monthly". Revalidate `/money` + `/dashboard`.
- `updateIncomeSource(id, patch)` → standard owner check + update + revalidate.
- `archiveIncomeSource(id)` → sets `active = false` (don't hard-delete — preserves history).
- `unarchiveIncomeSource(id)` → sets `active = true`.
- `markIncomeReceived(id, actualAmountCents?, receivedAt?)`:
  1. Owner check.
  2. Insert a `Transaction` with positive `amountCents` (default to source's `expectedAmountCents`, override with `actualAmountCents` if user edited), `category = source.category`, `description = source.name`, `occurredAt = receivedAt ?? now()`, `source = "income-source"`, `externalId = source.id`.
  3. Update the source: `lastReceivedAt = receivedAt ?? now()`. If cadence !== "oneoff", set `nextExpectedAt = nextDateForCadence(...)`. If cadence === "oneoff", set `active = false`.
  4. Revalidate `/money` + `/dashboard`.

Authorization helper from Phase 2 (`requireOwner`) extends naturally; reuse it.

---

## 6. UI — Income tab

New tab between Bills & Subscriptions and Goals. Two sections:

### Active sources
Sorted by `nextExpectedAt` ascending. Each row shows:
- Name and expected amount.
- Cadence label: "Monthly on the 15th" / "Biweekly" / "Weekly" / "One-off on June 15".
- "Next: in N days" with the date.
- "Mark received" button (primary action) → opens a small dialog pre-filled with expected amount and today's date, both editable. Confirm fires `markIncomeReceived`.
- Overflow menu (edit, archive).

### Archived sources
Collapsible "View archived" toggle (matches Goals tab pattern). Shows inactive sources with an "Unarchive" action.

### Add income source button
Form fields:
- Name (required).
- Expected amount in cents (currency-aware input, reuse `parseCentsInput` from Phase 4).
- Cadence (radio: Monthly / Biweekly / Weekly / One-off).
- If Monthly: anchor day picker (1–31, with a small "If month is shorter, use last valid day" note).
- Next expected date (date picker, required for all cadences).
- Category (string input, defaults to "Income", supports picking from existing transaction categories the user has used).
- Notes (optional textarea).

### Empty state
"No income sources yet — add one to track what's coming in."

---

## 7. Spending tab — type filter

Add a tri-state filter chip group at the top of the transaction list, alongside the existing category and date-range filters:
- **All** (default after this ships? see note below)
- **Expenses** (negative amounts)
- **Income** (positive amounts)

Default behavior decision: keep defaulting to **Expenses** so existing users see no behavior change. Add a tiny "+ N income txns this month" hint above the list so income isn't invisible.

The donut chart stays expenses-only — it's a spending breakdown, mixing income into it would muddy the view. If filter is "Income", hide the donut and show a simple list grouped by source/category.

---

## 8. Dashboard "Money this month" — net framing

Reshape the existing card. New top-down order:

1. **Net headline**: "€340 net this month" — color: stone if positive, amber if negative. Below it, small caption: "€800 in · €460 out".
2. **Top 3 expense categories** (unchanged from Phase 4F).
3. **Upcoming bills** (unchanged).
4. **Next expected income** (new): a single line — "Next: Part-time job in 5 days · €350 expected." Shows only if there's an active income source with `nextExpectedAt` within the next 30 days. If multiple, show the soonest.
5. **Savings goals progress** (unchanged).

If the user has zero income sources and zero positive transactions this month, hide the net line and the next-income line gracefully — the card falls back to its existing spending-focused shape.

Net calculation: sum of all `Transaction.amountCents` where `occurredAt` is within the current month, in user's tz. Positive sum = positive net.

---

## 9. Tone

Income copy stays calm and matter-of-fact. Don't celebrate inflows ("Money in! 🎉") — same restraint as elsewhere in the Money module.

Examples:
- "+ €350 received from Part-time job." (mark-received toast)
- "Marked received. Next cycle: June 15." (confirmation)
- "Next: Allowance in 3 days." (dashboard)
- "€-50 net this month — heads up." (negative net dashboard caption — neutral, no scolding)
- "No income sources yet — add one to track expected inflows." (empty state)

Read every new string aloud before shipping. The Money module's audit standard from §6 of the Phase 4 brief still applies here.

---

## 10. Acceptance criteria

This addendum is done when:

- [ ] Migration `<ts>_income_sources` runs cleanly; existing data untouched.
- [ ] User can add monthly, biweekly, weekly, and one-off income sources via the new tab.
- [ ] "Mark received" on a recurring source creates a positive Transaction AND advances `nextExpectedAt` by the correct cadence interval.
- [ ] "Mark received" on a one-off source creates the Transaction AND sets `active = false`.
- [ ] Monthly cadence handles edge cases: anchor day 31 → falls back to Feb 28/29 / Apr 30 correctly.
- [ ] Spending tab's new All/Expenses/Income filter works; donut hides on Income view.
- [ ] Dashboard "Money this month" card shows the net line and (when applicable) the next-expected-income line.
- [ ] Negative net renders amber, not red; copy is neutral.
- [ ] Archived income sources don't appear on the dashboard or in active-source lists.
- [ ] 375px responsive: Income tab cards stack to one column; dashboard card stays compact.
- [ ] `npx tsc --noEmit` and `npx next build` both clean.
- [ ] Tone audit: every new string passes the read-aloud check.

---

## 11. Don't deviate without asking

Stop and ask before:
- Adding any paid dependency. Recharts/date-fns/etc. from Phase 4 cover everything.
- Adding a separate `IncomeReceived` log table — the resulting Transaction rows ARE the log.
- Introducing tax/deduction modeling.
- Auto-marking income received based on heuristics (Gmail scan etc.) — that's a future power feature, like 4G.
- Changing the donut chart to include income — keep it spending-only.
- Forcing income transactions to require a `BudgetCategory` row — they don't, and shouldn't.

After implementation: demo the create/edit/mark-received flow, walk through dashboard net rendering with positive AND negative scenarios, and ask the user to verify before declaring this done.
