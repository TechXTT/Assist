import {
  addDays,
  addMonths,
  addYears,
  getDaysInMonth,
  setDate,
  startOfMonth,
  startOfWeek
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

import { prisma } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ForecastEventKind =
  | "income"
  | "bill"
  | "subscription"
  | "loan_payment"
  | "credit_payment"
  | "discretionary";

export type ForecastEvent = {
  at: Date;
  kind: ForecastEventKind;
  label: string;
  amountCents: number; // positive = inflow, negative = outflow
  sourceId?: string;
};

export type RunningBalancePoint = { at: Date; balanceCents: number };

export type MonthlyBucket = {
  monthStart: Date;
  inCents: number;
  outCents: number;
  netCents: number;
};

export type TightSpot = { at: Date; balanceCents: number };

export type RecurringBreakdownRow = {
  kind: "bill" | "subscription" | "loan_payment" | "credit_payment";
  label: string;
  monthlyCents: number;
  category: string | null;
};

export type Forecast = {
  events: ForecastEvent[];
  runningBalance: RunningBalancePoint[];
  monthlyBuckets: MonthlyBucket[];
  tightSpots: TightSpot[];
  recurringMonthlyTotalCents: number;
  recurringAnnualizedCents: number;
  recurringBreakdown: RecurringBreakdownRow[];
  /**
   * Accounts that look like they should contribute but are missing fields
   * (loan/credit with no monthlyPayment+paymentDueDay). Surfaced as inline
   * hints in the UI.
   */
  incompleteAccounts: { id: string; name: string; type: string; missing: string[] }[];
};

type Bill = {
  id: string;
  name: string;
  amountCents: number;
  recurring: boolean;
  dueDay: number | null;
  dueDate: Date | null;
  lastPaidAt: Date | null;
  category: string | null;
};

type Subscription = {
  id: string;
  name: string;
  amountCents: number;
  billingCycle: string;
  nextChargeAt: Date;
  category: string | null;
};

type IncomeSource = {
  id: string;
  name: string;
  expectedAmountCents: number;
  cadence: string;
  cadenceAnchorDay: number | null;
  nextExpectedAt: Date;
  active: boolean;
};

type AccountForFlow = {
  id: string;
  name: string;
  type: string;
  monthlyPaymentCents: number | null;
  paymentDueDay: number | null;
};

// ----- Date / cadence helpers -----

function endOfHorizon(now: Date, horizonDays: number): Date {
  return new Date(now.getTime() + horizonDays * DAY_MS);
}

function monthlyAnchor(day: number, tz: string, baseline: Date): Date {
  const localBaseline = toZonedTime(baseline, tz);
  const local = startOfMonth(localBaseline);
  const capped = setDate(local, Math.min(day, getDaysInMonth(local)));
  return fromZonedTime(capped, tz);
}

function advanceMonthlyAnchor(prev: Date, day: number, tz: string): Date {
  const localPrev = toZonedTime(prev, tz);
  const nextLocal = startOfMonth(addMonths(localPrev, 1));
  const capped = setDate(nextLocal, Math.min(day, getDaysInMonth(nextLocal)));
  return fromZonedTime(capped, tz);
}

function nextIncomeOccurrence(
  current: Date,
  cadence: string,
  anchorDay: number | null,
  tz: string
): Date | null {
  if (cadence === "oneoff") return null;
  if (cadence === "weekly") return addDays(current, 7);
  if (cadence === "biweekly") return addDays(current, 14);
  if (cadence === "monthly") {
    if (!anchorDay) return addMonths(current, 1);
    return advanceMonthlyAnchor(current, anchorDay, tz);
  }
  return null;
}

// ----- Per-source event generation -----

function generateIncomeEvents(
  sources: IncomeSource[],
  end: Date,
  tz: string
): ForecastEvent[] {
  const out: ForecastEvent[] = [];
  for (const s of sources) {
    if (!s.active) continue;
    let at: Date | null = s.nextExpectedAt;
    let guard = 0;
    while (at && at <= end && guard < 200) {
      out.push({
        at,
        kind: "income",
        label: s.name,
        amountCents: s.expectedAmountCents,
        sourceId: s.id
      });
      at = nextIncomeOccurrence(at, s.cadence, s.cadenceAnchorDay, tz);
      guard++;
    }
  }
  return out;
}

function generateBillEvents(bills: Bill[], now: Date, end: Date, tz: string): ForecastEvent[] {
  const out: ForecastEvent[] = [];
  const localNow = toZonedTime(now, tz);

  for (const b of bills) {
    if (b.recurring && b.dueDay) {
      // Start at this month's anchor (already-paid cycles are skipped).
      let at = monthlyAnchor(b.dueDay, tz, now);
      let guard = 0;
      while (at <= end && guard < 60) {
        const cycleAlreadyPaid =
          b.lastPaidAt !== null &&
          toZonedTime(b.lastPaidAt, tz).getMonth() === toZonedTime(at, tz).getMonth() &&
          toZonedTime(b.lastPaidAt, tz).getFullYear() === toZonedTime(at, tz).getFullYear();
        if (!cycleAlreadyPaid && at >= now) {
          out.push({
            at,
            kind: "bill",
            label: b.name,
            amountCents: -Math.abs(b.amountCents),
            sourceId: b.id
          });
        }
        at = advanceMonthlyAnchor(at, b.dueDay, tz);
        guard++;
      }
    } else if (!b.recurring && b.dueDate) {
      const paid = b.lastPaidAt !== null && b.lastPaidAt >= b.dueDate;
      if (!paid && b.dueDate >= now && b.dueDate <= end) {
        out.push({
          at: b.dueDate,
          kind: "bill",
          label: b.name,
          amountCents: -Math.abs(b.amountCents),
          sourceId: b.id
        });
      }
    }
  }
  // Touch localNow to keep date-fns-tz import happy if reorganized later.
  void localNow;
  return out;
}

function generateSubscriptionEvents(
  subs: Subscription[],
  now: Date,
  end: Date
): ForecastEvent[] {
  const out: ForecastEvent[] = [];
  for (const s of subs) {
    let at = s.nextChargeAt;
    let guard = 0;
    while (at <= end && guard < 200) {
      if (at >= now) {
        out.push({
          at,
          kind: "subscription",
          label: s.name,
          amountCents: -Math.abs(s.amountCents),
          sourceId: s.id
        });
      }
      at = s.billingCycle === "annual" ? addYears(at, 1) : addMonths(at, 1);
      guard++;
    }
  }
  return out;
}

function generateAccountPaymentEvents(
  accounts: AccountForFlow[],
  now: Date,
  end: Date,
  tz: string
): { events: ForecastEvent[]; incomplete: Forecast["incompleteAccounts"] } {
  const events: ForecastEvent[] = [];
  const incomplete: Forecast["incompleteAccounts"] = [];

  for (const a of accounts) {
    if (a.type !== "loan" && a.type !== "credit") continue;
    const missing: string[] = [];
    if (!a.monthlyPaymentCents) missing.push("monthlyPayment");
    if (!a.paymentDueDay) missing.push("paymentDueDay");
    if (missing.length > 0) {
      incomplete.push({ id: a.id, name: a.name, type: a.type, missing });
      continue;
    }
    let at = monthlyAnchor(a.paymentDueDay!, tz, now);
    let guard = 0;
    while (at <= end && guard < 60) {
      if (at >= now) {
        events.push({
          at,
          kind: a.type === "loan" ? "loan_payment" : "credit_payment",
          label: a.name,
          amountCents: -Math.abs(a.monthlyPaymentCents!),
          sourceId: a.id
        });
      }
      at = advanceMonthlyAnchor(at, a.paymentDueDay!, tz);
      guard++;
    }
  }

  return { events, incomplete };
}

/**
 * Spread daily discretionary across the horizon as one event per
 * Monday-aligned week. Last partial week is pro-rated.
 */
function generateDiscretionaryEvents(
  dailyCents: number,
  now: Date,
  end: Date,
  tz: string
): ForecastEvent[] {
  if (dailyCents <= 0) return [];
  const out: ForecastEvent[] = [];
  const localNow = toZonedTime(now, tz);
  let weekStartLocal = startOfWeek(localNow, { weekStartsOn: 1 });

  let cursor = fromZonedTime(weekStartLocal, tz);
  // First boundary may be in the past; jump forward to the next Monday >= now.
  while (cursor < now) {
    cursor = fromZonedTime(addDays(weekStartLocal, 7), tz);
    weekStartLocal = addDays(weekStartLocal, 7);
  }

  while (cursor <= end) {
    const weekEnd = fromZonedTime(addDays(weekStartLocal, 7), tz);
    const sliceEnd = weekEnd > end ? end : weekEnd;
    const days = Math.max(0, Math.round((sliceEnd.getTime() - cursor.getTime()) / DAY_MS));
    if (days > 0) {
      out.push({
        at: cursor,
        kind: "discretionary",
        label: "Daily discretionary",
        amountCents: -Math.abs(dailyCents) * days
      });
    }
    weekStartLocal = addDays(weekStartLocal, 7);
    cursor = fromZonedTime(weekStartLocal, tz);
  }

  return out;
}

// ----- Aggregations -----

function buildRunningBalance(
  startingBalanceCents: number,
  events: ForecastEvent[],
  now: Date
): RunningBalancePoint[] {
  const points: RunningBalancePoint[] = [{ at: now, balanceCents: startingBalanceCents }];
  let balance = startingBalanceCents;
  for (const e of events) {
    balance += e.amountCents;
    points.push({ at: e.at, balanceCents: balance });
  }
  return points;
}

function bucketByMonth(events: ForecastEvent[], tz: string): MonthlyBucket[] {
  const buckets = new Map<string, MonthlyBucket>();
  for (const e of events) {
    const local = toZonedTime(e.at, tz);
    const monthLocal = startOfMonth(local);
    const monthStartUtc = fromZonedTime(monthLocal, tz);
    const key = monthStartUtc.toISOString();
    const existing = buckets.get(key) ?? {
      monthStart: monthStartUtc,
      inCents: 0,
      outCents: 0,
      netCents: 0
    };
    if (e.amountCents > 0) existing.inCents += e.amountCents;
    else existing.outCents += Math.abs(e.amountCents);
    existing.netCents = existing.inCents - existing.outCents;
    buckets.set(key, existing);
  }
  return Array.from(buckets.values()).sort(
    (a, b) => a.monthStart.getTime() - b.monthStart.getTime()
  );
}

function detectTightSpots(
  points: RunningBalancePoint[],
  threshold: number
): TightSpot[] {
  if (points.length === 0) return [];
  const spots: TightSpot[] = [];
  let inDip = false;
  let dipStart: TightSpot | null = null;
  for (const p of points) {
    if (p.balanceCents < threshold) {
      if (!inDip) {
        dipStart = { at: p.at, balanceCents: p.balanceCents };
        inDip = true;
      } else if (dipStart && p.balanceCents < dipStart.balanceCents) {
        dipStart = { at: p.at, balanceCents: p.balanceCents };
      }
    } else if (inDip && dipStart) {
      spots.push(dipStart);
      inDip = false;
      dipStart = null;
    }
  }
  if (inDip && dipStart) spots.push(dipStart);
  return spots;
}

function computeRecurringTotals(
  bills: Bill[],
  subs: Subscription[],
  accounts: AccountForFlow[]
): { monthlyCents: number; breakdown: RecurringBreakdownRow[] } {
  const breakdown: RecurringBreakdownRow[] = [];
  let total = 0;

  for (const b of bills) {
    if (!b.recurring) continue;
    const cents = Math.abs(b.amountCents);
    total += cents;
    breakdown.push({
      kind: "bill",
      label: b.name,
      monthlyCents: cents,
      category: b.category
    });
  }
  for (const s of subs) {
    const cents = s.billingCycle === "annual" ? Math.round(s.amountCents / 12) : s.amountCents;
    total += cents;
    breakdown.push({
      kind: "subscription",
      label: s.name,
      monthlyCents: cents,
      category: s.category
    });
  }
  for (const a of accounts) {
    if ((a.type !== "loan" && a.type !== "credit") || !a.monthlyPaymentCents) continue;
    total += a.monthlyPaymentCents;
    breakdown.push({
      kind: a.type === "loan" ? "loan_payment" : "credit_payment",
      label: a.name,
      monthlyCents: a.monthlyPaymentCents,
      category: null
    });
  }

  breakdown.sort((a, b) => b.monthlyCents - a.monthlyCents);
  return { monthlyCents: total, breakdown };
}

// ----- Main entry point -----

export type ForecastInput = {
  userId: string;
  horizonDays: number;
  startingBalanceCents: number;
  includeDiscretionary: boolean;
  discretionaryDailyCents: number;
  tz: string;
  now?: Date;
  /** Recurring sources to omit from the forecast (scenario modeling). */
  excludedBillIds?: string[];
  excludedSubscriptionIds?: string[];
  excludedAccountIds?: string[];
};

export async function buildForecast(args: ForecastInput): Promise<Forecast> {
  const now = args.now ?? new Date();
  const end = endOfHorizon(now, args.horizonDays);
  const excludedBills = new Set(args.excludedBillIds ?? []);
  const excludedSubs = new Set(args.excludedSubscriptionIds ?? []);
  const excludedAccounts = new Set(args.excludedAccountIds ?? []);

  const [incomeSources, billsRaw, subscriptionsRaw, accountsRaw] = await Promise.all([
    prisma.incomeSource.findMany({
      where: { userId: args.userId, active: true },
      select: {
        id: true,
        name: true,
        expectedAmountCents: true,
        cadence: true,
        cadenceAnchorDay: true,
        nextExpectedAt: true,
        active: true
      }
    }),
    prisma.bill.findMany({
      where: {
        userId: args.userId,
        OR: [{ recurring: true }, { lastPaidAt: null }]
      },
      select: {
        id: true,
        name: true,
        amountCents: true,
        recurring: true,
        dueDay: true,
        dueDate: true,
        lastPaidAt: true,
        category: true
      }
    }),
    prisma.subscription.findMany({
      where: { userId: args.userId },
      select: {
        id: true,
        name: true,
        amountCents: true,
        billingCycle: true,
        nextChargeAt: true,
        category: true
      }
    }),
    prisma.financialAccount.findMany({
      where: {
        userId: args.userId,
        archived: false,
        type: { in: ["loan", "credit"] }
      },
      select: {
        id: true,
        name: true,
        type: true,
        monthlyPaymentCents: true,
        paymentDueDay: true
      }
    })
  ]);

  const bills = billsRaw.filter((b) => !excludedBills.has(b.id));
  const subscriptions = subscriptionsRaw.filter((s) => !excludedSubs.has(s.id));
  const accounts = accountsRaw.filter((a) => !excludedAccounts.has(a.id));

  const incomeEvents = generateIncomeEvents(incomeSources, end, args.tz);
  const billEvents = generateBillEvents(bills, now, end, args.tz);
  const subEvents = generateSubscriptionEvents(subscriptions, now, end);
  const { events: accountEvents, incomplete } = generateAccountPaymentEvents(
    accounts,
    now,
    end,
    args.tz
  );
  const discEvents = args.includeDiscretionary
    ? generateDiscretionaryEvents(args.discretionaryDailyCents, now, end, args.tz)
    : [];

  const events = [...incomeEvents, ...billEvents, ...subEvents, ...accountEvents, ...discEvents].sort(
    (a, b) => a.at.getTime() - b.at.getTime()
  );

  const runningBalance = buildRunningBalance(args.startingBalanceCents, events, now);
  const monthlyBuckets = bucketByMonth(events, args.tz);
  const tightSpots = detectTightSpots(runningBalance, args.userId ? 0 : 0); // placeholder; replaced below
  const recurring = computeRecurringTotals(bills, subscriptions, accounts);

  return {
    events,
    runningBalance,
    monthlyBuckets,
    tightSpots, // replaced by the caller-supplied threshold via a second pass
    recurringMonthlyTotalCents: recurring.monthlyCents,
    recurringAnnualizedCents: recurring.monthlyCents * 12,
    recurringBreakdown: recurring.breakdown,
    incompleteAccounts: incomplete
  };
}

/**
 * Threshold-aware variant that exposes tight spots based on a user-provided
 * minimum balance. Callers use this from server pages where the threshold
 * is loaded from User prefs.
 */
export async function buildForecastWithThreshold(
  args: ForecastInput & { tightThresholdCents: number }
): Promise<Forecast> {
  const base = await buildForecast(args);
  const tightSpots = detectTightSpots(base.runningBalance, args.tightThresholdCents);
  return { ...base, tightSpots };
}
