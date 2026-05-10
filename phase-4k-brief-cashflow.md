# Phase 4K Brief — Cash Flow Forecast

> Paste this into Claude Code as a follow-up to Phases 4H (Income) and 4J (Account Detail). Read end-to-end, propose plan + migration, confirm with the user, implement. This adds the forward-looking comparison layer the user asked for — matching expected income against recurring outflows over the next 30/60/90 days, with a running-balance projection and tight-spot detection.

---

## 1. What this addendum delivers

After this lands:

1. A new **Cash Flow** tab in `/money` (placed after Goals, before Net Worth) showing a forward-looking forecast:
   - Income events from `IncomeSource` (4H), projected forward via their cadence.
   - Outflow events from `Bill`, `Subscription`, loan payments, and credit card payments — all the recurring stuff the user has already modeled.
   - A running-balance projection starting from the sum of "cash flow accounts" (cash + savings by default).
   - Tight-spot warnings when projected balance dips below a user-set threshold.
   - Per-month summary cards: "This month: €1,200 in, €890 out, €310 net" — for the current and upcoming months in horizon.
2. A **dashboard line** on the Money this month card: "Next 30 days: ▲ €310 projected · 1 tight spot on May 22".
3. A **Recurring outflow summary** at the bottom of the Cash Flow tab: total monthly recurring (bills + subs + loan + credit payments), plus the annualized total, with a breakdown by category. Makes subscription creep visible.
4. Optional **discretionary-spend estimate** layer: trailing 60-day average of non-recurring transactions per day, smeared evenly across the horizon. Toggleable per-user — defaults on once enough history exists, off until then.

Out of scope: forecasting actual investment returns, modeling FX changes, multi-currency forecasts, savings interest accumulation in the projection, predicting income raises/promotions, scenario modeling ("what if I cancel Netflix?"). Those can come later if useful.

---

## 2. The mental model

Every modeled financial obligation already exists in the DB. The forecast just walks forward from today, asking each one: "When are you next? How much?" — and stitches the answers into a timeline.

- `IncomeSource.nextExpectedAt` + cadence → next N receipts.
- `Bill.dueDate` (one-off, if in horizon) OR `Bill.dueDay` + `recurring` → next N occurrences.
- `Subscription.nextChargeAt` + `billingCycle` → next N charges.
- `Account` of type `loan` with `monthlyPaymentCents` + `paymentDueDay` → monthly outflows.
- `Account` of type `credit` with `monthlyPaymentCents` + `paymentDueDay` → monthly outflows.
- Optional: trailing-average discretionary, spread per day.

The user-side question this answers: "Over the next 30 days, am I going to be ok? And when will I be tightest?"

---

## 3. Schema changes

### Extend `Account`

```prisma
model Account {
  // ... existing fields from 4I/4J unchanged ...

  // Cash-flow flag
  includeInCashFlow Boolean @default(true)
  // Defaults are seeded on account create based on type:
  //   cash, savings              → true
  //   investment, crypto         → false
  //   credit, loan, other        → false
  // User-editable per account.
}
```

### Extend `User` (preferences)

```prisma
model User {
  // ... existing ...
  cashFlowHorizonDays            Int      @default(30)     // 30, 60, or 90
  cashFlowTightThresholdCents    Int      @default(10000)  // default €100 — adjustable
  cashFlowIncludeDiscretionary   Boolean  @default(true)   // auto-true if enough history exists; UI honors this
  cashFlowDiscretionaryDailyCents Int?                     // user override; if null, use rolling 60-day average
}
```

### Reuse, don't duplicate

`monthlyPaymentCents` and `paymentDueDay` from 4J already exist on `Account`. 4J's brief framed them as loan-only and credit-only respectively, but the columns are shared. In 4K's UI, expose both fields on both **credit** and **loan** accounts so they can participate in the forecast. No additional schema needed.

Migration name: `<ts>_cash_flow_forecast`.

---

## 4. Forecast engine

A single pure function in `src/lib/money/cashflow.ts`:

```
buildForecast({
  userId,
  horizonDays,             // 30 | 60 | 90
  startingBalanceCents,    // sum of includeInCashFlow accounts as of today
  includeDiscretionary,
  discretionaryDailyCents, // resolved value (override or computed average)
  tz,
}): {
  events: ForecastEvent[],
  runningBalance: Array<{ at: Date, balanceCents: number }>,
  monthlyBuckets: Array<{ monthStart: Date, inCents: number, outCents: number, netCents: number }>,
  tightSpots: Array<{ at: Date, balanceCents: number }>,
  recurringMonthlyTotalCents: number,
  recurringAnnualizedCents: number,
}

type ForecastEvent = {
  at: Date,
  kind: "income" | "bill" | "subscription" | "loan_payment" | "credit_payment" | "discretionary",
  label: string,                     // "Part-time job", "Phone bill", "Spotify", "Student loan", "Visa credit", "Daily discretionary"
  amountCents: number,               // signed: positive = inflow, negative = outflow
  sourceId?: string,                 // FK to whichever entity produced it (income source, bill, etc.)
}
```

### Algorithm

1. **Income**: for each active `IncomeSource`, enumerate occurrences from `nextExpectedAt` forward, stepping by cadence, until past `today + horizonDays`. Emit a positive event per occurrence.
2. **Bills**: for each `Bill`:
   - `recurring = true`: from current month, step monthly using `dueDay`, last-valid-day fallback for short months.
   - `recurring = false`: emit one event at `dueDate` if it falls in the horizon.
   - Skip bills marked paid for the current cycle (use `lastPaidAt` to determine current-cycle status).
3. **Subscriptions**: from `nextChargeAt`, step by `billingCycle` (monthly/annual), emit events.
4. **Loan payments** (per Account of type `loan` with `monthlyPaymentCents` set): step monthly using `paymentDueDay` (or default to the loan's start-of-month if `paymentDueDay` is null — but UI should encourage filling it in).
5. **Credit payments** (per Account of type `credit` with `monthlyPaymentCents` + `paymentDueDay` set): step monthly. Skip if user hasn't filled these — surface a hint instead.
6. **Discretionary** (if enabled): emit one negative event per day in horizon with amount = `discretionaryDailyCents`. (Or emit one weekly aggregate if per-day events make the chart too noisy — pick whichever renders cleaner.)
7. Sort all events ascending by `at`.
8. Compute `runningBalance`: start at `startingBalanceCents`, then for each event, snapshot `(at, balance += amountCents)`. Add a starting-point at `today, startingBalanceCents`.
9. Bucket events by calendar month (user's tz) into `monthlyBuckets`.
10. Detect `tightSpots`: points where the running balance dips below the user's threshold. De-dupe so we don't emit one per discretionary tick — collapse consecutive tight points into one event with the lowest reached.

### Discretionary auto-average

In `src/lib/money/discretionary.ts`:

```
computeDiscretionaryDaily(userId, lookbackDays = 60, tz): { cents: number, basedOnDays: number, basedOnTxCount: number }
```

Look at `Transaction` rows in the last `lookbackDays` where `amountCents < 0` AND `source !== "income-source"` AND `category` is not in the recurring set (`paymentDueDay`-driven transactions tagged via `source = "bill"` / `source = "subscription"` etc., if we're tagging them — if not, fall back to "all negative non-income transactions"). Sum, divide by `lookbackDays`. Return absolute value.

If fewer than 14 days of data exist, return `cents: 0, basedOnDays: <actual>` and the UI shows a hint: "Discretionary estimate will appear after about 2 weeks of logged spending."

---

## 5. Server actions

In `src/app/(app)/money/actions.ts` (or sub-file `cashflow.ts`):

- `getForecast()` — server-side data load for the Cash Flow tab. Reads user prefs, computes starting balance from `includeInCashFlow = true` accounts, calls `buildForecast`. Returns full shape.
- `setCashFlowHorizon(days)` — 30 | 60 | 90 only; persist on User.
- `setCashFlowTightThreshold(cents)` — persist.
- `setCashFlowDiscretionary({ include?, dailyCentsOverride? })` — `include` toggles, `dailyCentsOverride` of null means "use auto-computed".
- `setIncludeInCashFlow(accountId, included)` — toggle per-account.

All authorized via existing patterns.

---

## 6. UI — Cash Flow tab

Placed after Goals tab, before Net Worth tab in `/money`.

### Top — Summary row
- **Starting balance**: "€840 across 2 cash flow accounts" (sums `includeInCashFlow` accounts).
- **Horizon selector**: 30 / 60 / 90 day chips.
- **Tight threshold control**: small inline input "Alert below: €100" — clicking opens a numeric input.

### Middle — Running balance chart
- Recharts `LineChart` over the horizon.
- X: time. Y: projected balance.
- Color-coded line segments: stone above threshold, amber when dipping below, no red.
- Markers at each event point. Hover tooltip: date + event labels + delta.
- A horizontal dashed line at the tight-threshold.
- Below chart: tight-spot callouts as small chips ("May 22: dips to €40 — 3 days before next paycheck"). Click → scroll the events list to that date.

### Middle-right — Monthly buckets
- For each calendar month in the horizon (current + 1 or 2 more depending on horizon), a small card:
  - Month name.
  - "€1,200 in · €890 out".
  - Net line, color-stoned if positive, amber if negative.
  - Mini progress bar visualizing in vs out.

### Lower — Events timeline
- Vertical list, grouped by date.
- Each row: time-of-day if present (most events are date-only), event icon, label, amount with sign and color, source link (click → bill detail, subscription detail, etc.).
- Filter chips at top: All / Income / Bills / Subscriptions / Loan & Credit / Discretionary. Default All.
- Discretionary events render lighter and grouped (e.g., "Daily discretionary · €15/day · 30 days") rather than one row per day.

### Bottom — Recurring outflow summary
- "**Recurring monthly outflow: €420**" — a stat at the top of the section.
- Below: "**Annualized: €5,040**" — quietly informative, not alarmist.
- Breakdown table: by category, by source (bills / subs / loan / credit). Ordered by total descending.
- A "Subscription creep" callout if subscriptions alone are >20% of monthly recurring or >€50/month (whichever): friendly nudge, single line, "Heads up — subscriptions add up to €72/month, about 18% of your monthly recurring." No further pressure.

### Account-level controls
- A small "Cash flow accounts" link below starting balance opens a sheet listing all accounts with a toggle for `includeInCashFlow`. Defaults stay sensible; user can override.

### Empty / partial states
- No income sources yet: "Add an income source to start projecting forward." → links to Income tab.
- Income exists but no bills/subs: "Looks like you only have income modeled — your forecast won't show outflows. Add bills or subscriptions to see the full picture."
- Credit/loan accounts exist but missing `monthlyPaymentCents` or `paymentDueDay`: inline hint per account, "Add monthly payment + due day to include this in the forecast." Don't fail silently — these are common omissions.

---

## 7. Dashboard wiring

One new line on the Money this month card, placed below the existing net line (or, if 4H hasn't shipped yet, in the equivalent position):

> **Next 30 days: ▲ €310 projected · 1 tight spot on May 22**

- Click → `/money?tab=cashflow`.
- If projected net is negative for the horizon: render in amber with "▼", no exclamation.
- Tight-spot suffix appears only when there's at least one. Plural if multiple.
- Hide the whole line gracefully if the forecast can't compute (no income sources OR no usable accounts).

---

## 8. Tone

This is the most "advisory" surface in the Money module — it's literally telling the user what to expect. Keep it calm, neutral, and oriented toward awareness, not anxiety.

- "Next 30 days: ▲ €310 projected · 1 tight spot on May 22" — factual.
- "Dips to €40 on May 22 — 3 days before your next paycheck." — explanatory, no scolding.
- "Heads up — subscriptions add up to €72/month, about 18% of your monthly recurring." — one-time observation, not a lecture.
- "Discretionary estimate will appear after about 2 weeks of logged spending." — gentle gating.
- "Add monthly payment + due day to include this in the forecast." — direct, no shame.
- Negative monthly net: "May: €1,200 in · €1,350 out · ▼ €150" — neutral, color-stoned amber.
- Empty horizon: "No forecast yet — add an income source and a few bills to see the picture."

Specifically avoid: "You're overspending," "Save more!", any encouragement to cut subscriptions beyond a single observational line, any framing that implies judgment about the user's financial choices.

---

## 9. Acceptance criteria

This addendum is done when:

- [ ] Migration `<ts>_cash_flow_forecast` runs cleanly. No existing data shape changes.
- [ ] Cash Flow tab renders at `/money` after Goals.
- [ ] Forecast correctly projects income occurrences via cadence (monthly anchorDay, biweekly +14, weekly +7, one-off in-range).
- [ ] Forecast projects recurring bills correctly across month boundaries with last-valid-day fallback.
- [ ] Subscriptions step by billingCycle (monthly/annual).
- [ ] Loan and credit accounts contribute outflows when `monthlyPaymentCents` and `paymentDueDay` are filled; surface a hint per account otherwise.
- [ ] Running balance chart line color correctly transitions stone → amber when balance is below tight threshold.
- [ ] Tight spots are detected, de-duplicated across consecutive discretionary ticks, and surfaced in the chart + callouts.
- [ ] Monthly buckets sum income and outflow correctly per calendar month in user's tz.
- [ ] Discretionary toggle works: on by default once ≥14 days of history; off otherwise. Override input works.
- [ ] Recurring monthly outflow + annualized totals compute correctly across bills + subs + loan + credit.
- [ ] Subscription-creep callout fires only when subscriptions are >20% of recurring or >€50/month.
- [ ] `includeInCashFlow` defaults seed correctly on account creation based on type, and the per-account toggle in the sheet works.
- [ ] Dashboard "Next 30 days" line renders correctly with positive, negative, and tight-spot variants. Hides gracefully when forecast can't compute.
- [ ] Horizon selector persists per-user.
- [ ] 375px responsive: chart and monthly buckets stack to one column; events list stays scannable.
- [ ] `npx tsc --noEmit` and `npx next build` clean.
- [ ] Tone audit: every new string passes the read-aloud check.

---

## 10. Don't deviate without asking

Stop and ask before:
- Adding a paid dependency. Recharts/date-fns from earlier phases already cover this.
- Adding scenario modeling ("what if I cancel X?") — separate future feature.
- Auto-detecting recurring outflows from transaction history (the user already models them explicitly via Bill/Sub/Account; deriving them again from transactions is duplicative).
- Including investment returns or savings interest accrual in the forecast — keep the projection grounded in known cash events only.
- Modeling actual variable categories separately ("I'll spend €X on food, €Y on transport") — for v1 it's one combined discretionary line.
- Persisting the forecast itself (recompute on each load — it's cheap and always fresh).
- Forecast horizons beyond 90 days — quality degrades fast past a quarter, and the UI would crowd.
- Multi-currency forecasts — single currency stays.
- Bright red anywhere — tight spots and negative nets render amber, never red.

After implementation: demo the tab with at least one income source, one bill, one subscription, and one credit/loan account all contributing to a horizon that has at least one tight spot. Walk through the dashboard line. Walk through the monthly buckets. Ask the user to verify before declaring this done.
