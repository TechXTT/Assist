# Phase 4 Brief — Money Module

> Paste this into Claude Code as a follow-up turn. **First** ship the Phase 3 multi-calendar addendum (`phase-3-addendum-multi-calendar.md`) — it's small and unrelated to money. Once that's verified, work through Phase 4 in the sub-phase order below, demoing at each checkpoint and asking the user to verify before moving on. Phase 4 is large; resist the urge to ship it as one giant PR.

---

## 1. What this phase delivers

By the end of Phase 4, the user can:

1. Open `/money` and see four tabs: **Spending**, **Budgets**, **Bills & Subscriptions**, **Goals**.
2. Log expenses and incomes manually, categorize them, filter by category and date range, and see a monthly breakdown chart.
3. Set per-category monthly budgets and watch progress bars fill across the month, with a clear warning when a category is >80% used with >7 days left.
4. Track bills (one-off or recurring monthly) and subscriptions (monthly or annual), get reminder banners 3 days before each next due date, and see a "Consider canceling?" hint on subscriptions flagged as unused.
5. Create savings goals with target amounts + dates, log savings progress manually, and see a projected completion date based on recent contribution rate.
6. See a **Money this month** card on the dashboard with the most important signals at a glance.
7. (Last sub-phase, optional) Opt in to a one-shot Gmail scan that surfaces *suggested* transactions parsed from receipts — never auto-added.

Out of scope: bank/Plaid integration, multi-currency UX (single currency, configurable), automatic subscription detection from card transactions, true categorization ML.

---

## 2. Pre-flight

- Models `Transaction`, `BudgetCategory`, `Bill`, `Subscription`, `SavingsGoal`, and `Reminder` already exist in `prisma/schema.prisma` from Phase 1. Use them as-is. Schema additions in §3 are pre-authorized.
- All money is stored as **integer cents**, never floats. Format at render time only.
- Default currency is configurable via env (`DEFAULT_CURRENCY=USD`). All v1 UI assumes a single currency — no per-row currency switching.
- All date ranges are computed in the user's timezone (`User.timezone` if set, else env default, else `Intl.DateTimeFormat().resolvedOptions().timeZone`). Use `date-fns-tz` already in the project.
- Reuse the **existing Reminder system from Phase 2** for bill reminders. Don't introduce a parallel reminder pipeline.
- No new cron — staleness/read-on-demand patterns continue.

---

## 3. Schema additions (pre-authorized)

Add to `Subscription`:
- `lastReminderShownAt DateTime?` — quiets the "Consider canceling?" hint after the user dismisses it once per cycle.
- `userMarkedUnused Boolean @default(false)` — explicit user signal feeds `suspectedUnused` logic.

Add to `Bill`:
- `reminderEnabled Boolean @default(true)` — drives the per-bill reminder toggle.
- `notes String?` — free-form notes (account number hint, payment URL, etc.).

Add to `BudgetCategory`:
- `archived Boolean @default(false)` — soft-hide a category without deleting it (preserves historical transaction tags).
- Make `(userId, name)` unique via `@@unique([userId, name])`.

Add to `SavingsGoal`:
- `archived Boolean @default(false)` — hide completed/abandoned goals without deleting history.

No changes to `Transaction` or `Reminder`. No new tables. New migration: `<ts>_money_module_extras`.

---

## 4. Sub-phase ordering — ship + verify in this order

### 4A — Categories + Transactions (foundation)

This is the bedrock of the whole module. Ship this first, demo, get sign-off.

- New helper `src/lib/money/format.ts` with `formatCents(cents, currency)` and `parseCentsInput(stringInput)` for `<input>`-to-cents conversion (handles "$12.34", "12.34", "12", commas, etc.).
- New helper `src/lib/money/period.ts` with `currentMonth(tz)`, `startOfMonth(date, tz)`, `endOfMonth(date, tz)`, `daysRemainingInMonth(tz)`.
- **Categories management**: small UI in the Spending tab (or a "Manage categories" sheet) where user can create, rename, archive, and color-code categories. Soft-delete via `archived` so historical transactions keep their tag. Server actions: `createCategory`, `renameCategory`, `archiveCategory`, `unarchiveCategory`. Uniqueness enforced per user.
- **Transactions CRUD**: list, add, edit, delete. Form fields: amount (positive number, with a sign toggle for "Expense" / "Income" — store negative for expense, positive for income), category (dropdown of non-archived categories + "+ New" inline), description (optional), date (defaults today). Filter by category (multi-select), date range (this month / last month / custom). Sort by date desc.
- **Monthly breakdown chart**: Recharts donut showing this-month spending by category, plus a small horizontal bar list of the top 5 categories with amounts. One client component, server-fetched data.
- **Empty states**: "No transactions yet — log one to get rolling." for empty list. Friendly tone; no judgment in money copy ever.

**Checkpoint 4A**: User can log 5–10 transactions across 3+ categories, filter the list, and see them rendered correctly in the donut. Build/typecheck clean. Demo + sign-off before moving on.

---

### 4B — Budgets

- **Budgets tab**: list of `BudgetCategory` rows with monthly limit + this-month spending + progress bar. Add/edit/delete (delete = archive, don't hard-delete).
- Form fields: name (must match an existing or new category), monthly limit (cents), color (small palette picker).
- **Progress bar coloring**: stone <50%, amber 50–80%, orange 80–100%, red >100%. Show "$X of $Y" and "N days left" beneath.
- **Over-budget banner**: at the top of the Budgets tab, if any category is >80% used with >7 days left in month, show a friendly warning ("Heads up — Coffee is at 87% with 12 days to go"). Multiple categories → list them; collapse if more than 3.
- Server actions: `createBudget`, `updateBudget`, `archiveBudget`.

**Checkpoint 4B**: User can create budgets for 2–3 categories, watch progress fill as transactions land in those categories, see the warning banner trigger. Demo + sign-off.

---

### 4C — Bills

- **Bills sub-section** of the Bills & Subscriptions tab. List of `Bill` rows sorted by next due date ascending.
- Form fields: name, amount (cents), category, recurring (toggle), dueDay (1–31, when recurring) OR dueDate (when one-off), reminder enabled (default on), notes.
- Each row shows: name, amount, "next due in X days" with date, category dot, "Mark paid" button. Mark paid sets `lastPaidAt = now()` and (for recurring) advances next-due to the next month.
- **Reminders**: when a bill is created/updated with `reminderEnabled = true`, upsert a `Reminder` row pointing at the bill (`billId` set, `taskId` null) with `fireAt = nextDue - 3 days`, level `firm`. When marked paid, delete pending reminders. When the bill recurs, the reminder regenerates for the next cycle (handle this in the same upsert helper that the task system uses, parameterized to know which entity).
- **Dashboard banners**: bill reminders surface in the same reminder banner stack as task reminders (Phase 2's banner component should already accept either; if not, refactor it to handle both — single banner stack, sorted by `fireAt`).

**Checkpoint 4C**: User can add a recurring bill, see "next due in N days" countdown, mark it paid, watch next cycle compute correctly. A bill due in 2 days should produce a reminder banner on dashboard. Demo + sign-off.

---

### 4D — Subscriptions

- **Subscriptions sub-section** of the same Bills & Subscriptions tab. List sorted by `nextChargeAt` ascending.
- Form fields: name, amount (cents), billing cycle (monthly | annual radio), nextChargeAt, category.
- Each row shows: name, amount, "billed monthly" / "billed annually", "next charge in N days", category dot, "Mark charged" button (advances `nextChargeAt` by one cycle).
- **Suspected-unused logic** (`src/lib/money/subscriptions.ts`):
  - `userMarkedUnused = true` → `suspectedUnused = true`.
  - Otherwise `suspectedUnused = false` for v1. (We don't have reliable usage signal yet — don't fake it. The brief's "no related transactions in 60 days" rule was loose; skip it until we have better data.)
- When `suspectedUnused`, show a small "Consider canceling?" hint inline on the row, with two buttons: "Yeah, I'll cancel" (just dismisses the hint and sets `lastReminderShownAt`) and "I do use this" (clears `userMarkedUnused`). Never auto-cancels — assistant suggests, user decides, exactly per the master brief.
- A small toggle on each subscription row labeled "I haven't been using this" maps to `userMarkedUnused`.

**Checkpoint 4D**: User can add a subscription, mark "I haven't been using this", see the cancel hint, dismiss it. Demo + sign-off.

---

### 4E — Savings goals

- **Goals tab**: card grid of `SavingsGoal` rows. Each card: name, progress bar (savedCents / targetCents), "$X of $Y" caption, target date if set, projected completion date if computable.
- Add Goal button → form: name, target (cents), target date (optional), notes.
- Each goal card has an "+ I saved $X" quick-action button → small inline form → adds to `savedCents`.
- **Projected completion math** (`src/lib/money/goals.ts`):
  - Look at the user's `savedCents` updates over the last 90 days (you'll need a `GoalContribution` table OR an `updatedAt` log on the goal — simplest: derive from `Transaction` rows tagged with category = the goal's name? Too coupled. Cleanest: add a small `GoalContribution` table now, but that's a schema add I haven't pre-authorized. **Alternative**: just track `savedCents` cumulatively and compute "average monthly contribution" from `(savedCents / months since createdAt)`. Use this approach for v1 — it's rough but honest.)
  - If average monthly rate > 0, projected = `now + (targetCents - savedCents) / monthlyRate * 30 days`.
  - Show "On track for August 2026" or "Pace too slow to hit Sep 2026" if behind target date.
- Archive completed goals via the `archived` field; show a "View archived" toggle.

**Checkpoint 4E**: User can create a goal, log savings additions, see progress bar fill, see a projected date update. Demo + sign-off.

---

### 4F — Dashboard "Money this month" card

Wire the dashboard placeholder to real data. Card sections:

1. **Headline number**: total spending this month (sum of negative-amount transactions, displayed as positive). Below it: "of $X budgeted across all categories" if any budgets exist.
2. **Top 3 categories by spend** with mini progress bars vs. their budgets (if any). Each shows `$amount / $limit`.
3. **Upcoming bills (next 7 days)**: count + total amount, e.g. "3 bills due — $124 total". Click → /money?tab=bills.
4. **Saving goals progress**: one-line summary, e.g. "$340 of $1,200 saved across 2 goals". Click → /money?tab=goals.
5. If any category is >80% used with >7 days left, render a small inline warning right inside this card.

Click anywhere on the card body (outside specific sub-links) → `/money`.

**Checkpoint 4F**: Dashboard now reflects all the money data. Demo + sign-off.

---

### 4G — Gmail scan (optional, ship last)

**Only after 4A–4F are signed off.** Defer if the user wants to skip it for now — the rest of the module fully works without it.

- New server route `POST /api/google/gmail/scan-receipts` triggered by an opt-in button on the Spending tab.
- Uses `getValidAccessToken` from Phase 3 + Gmail API to search a configurable query (default: `subject:(receipt OR invoice OR order) newer_than:30d`).
- For each matched email, attempt to extract amount + merchant + date with a small heuristic parser (regex on common receipt formats — don't try to be clever, accept low recall). For each match, create a **suggested transaction** with `source = "gmail"` and `externalId = messageId`, but **don't add it to the live ledger yet**.
- New UI: a "Suggested transactions" list at the top of the Spending tab when scan results exist. Each row shows the parsed amount, suggested category (best guess, editable), date, source email subject, and two buttons: "Add to ledger" (commits to `Transaction` table) and "Dismiss" (deletes the suggestion).
- Scan is **always manual** — the button on the Spending tab is the only way to trigger it. Never run it on a schedule. Never run it on dashboard load.
- Dedupe: skip if a suggestion with the same `externalId` already exists or has been dismissed.

**Checkpoint 4G**: User opts in, runs a scan, sees suggestions, confirms or dismisses each. Demo + sign-off.

---

## 5. Reminder system extension

The `Reminder` model already supports `taskId | billId` from Phase 1. Phase 2 wired up tasks. Phase 4C wires up bills. Update the existing Phase-2 reminder helpers to be entity-agnostic:

- `src/lib/reminders/upsert.ts`: parameterize on `{ kind: "task" | "bill", entityId, fireAt, level }`.
- The dashboard banner component should query both task reminders and bill reminders, merge, sort by `fireAt`. Friendly copy variants per kind:
  - Task: "Heads up — *Linear Algebra problem set* is due in 2 days."
  - Bill: "Heads up — *Phone bill* ($45) is due in 3 days."
- Dismiss flow stays the same; `sentAt = now()` is universal.

If Phase 2's reminder code lives somewhere too task-specific (e.g., `src/lib/tasks/reminders.ts`), move it to `src/lib/reminders/` during 4C. Don't leave a parallel half-implementation.

---

## 6. Tone (read carefully — money is sensitive)

The user is on a modest student budget and has explicitly told us he's a procrastinator. Money copy must be:

- **Friendly, never patronizing.** "Coffee is at $42 this month — heads up." NOT "You've overspent on coffee. Cut back."
- **Cost-conscious without scolding.** Highlight numbers, don't moralize.
- **No emojis in budget warnings.** Save them for empty states. Money warnings should be calm and grounded.
- **Never imply judgment about what he spends on.** Categories are user-defined; don't bake assumptions about "wants vs. needs".
- The "textbook reference" example from the master brief — skip it. Cute but presumptive. A clean number is better.

Examples:

- Empty state: "No transactions yet — log one when you've got a sec."
- Over-budget warning: "Coffee is at 112% — $56 over the $50 limit. 12 days left in the month."
- Bill reminder: "Phone bill ($45) is due in 3 days. Marking paid takes one tap."
- Cancel hint: "You marked Spotify as unused. Want to set a reminder to cancel?"
- Goal projection: "On track for August 2026 — about $80 a month does it."
- Goal projection (behind): "At your current pace, this lands in November — past your August target. No drama, just a heads-up."

---

## 7. Acceptance criteria (for the whole phase)

Phase 4 is "fully done" when:

- [ ] Multi-calendar addendum from Phase 3 is shipped first and verified.
- [ ] Migration `<ts>_money_module_extras` runs cleanly.
- [ ] All four tabs render at `/money`, mobile (375px) clean.
- [ ] User can manage categories (create, rename, archive).
- [ ] User can CRUD transactions, filter, see donut + top-categories bar.
- [ ] User can create budgets and watch progress fill; over-budget warnings trigger correctly at the 80%/7-days threshold.
- [ ] User can add a recurring bill; reminders surface 3 days before due; "Mark paid" advances the cycle correctly.
- [ ] User can add a subscription; "I haven't been using this" toggle surfaces the cancel hint.
- [ ] User can create a savings goal, log contributions, see progress + projected date.
- [ ] Dashboard "Money this month" card reflects live data and is wired to all the right sub-routes.
- [ ] Reminder banner stack on dashboard merges task + bill reminders, sorted by urgency.
- [ ] Optional: Gmail scan opt-in produces dismissable suggestions, never auto-adds to ledger.
- [ ] `npx tsc --noEmit` and `npx next build` clean.
- [ ] All money copy matches §6 tone guidance.

---

## 8. Don't deviate without asking

Stop and ask before:
- Adding any paid dependency. Recharts is already installed.
- Adding bank/Plaid/Open Banking integration — explicitly out of scope.
- Adding a `GoalContribution` table or any other schema model not pre-authorized in §3.
- Auto-adding Gmail-scanned transactions to the ledger.
- Auto-flagging subscriptions as unused based on heuristics.
- Implementing multi-currency conversion or per-transaction currency switching in v1.
- Moving the project layout (`src/app/...` vs `app/...`) — match existing convention.
- Changing the OAuth scopes (Gmail readonly is already authorized from Phase 1).

After each sub-phase (4A–4G): demo, ask the user to verify, get sign-off before continuing. Don't roll multiple sub-phases into one PR.

Match the friendly-casual tone everywhere. The Money module is the most likely place to feel "scoldy" if we're not careful — read your own copy out loud and ask "would I want a friend to talk to me this way?"
