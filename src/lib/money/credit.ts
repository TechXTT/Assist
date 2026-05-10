import { addMonths, getDaysInMonth, setDate, startOfMonth } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export type CreditAnalysis = {
  utilizationRatio?: number; // 0..1+
  availableCents?: number; // can be negative if over limit
  monthlyCarryCostCents?: number;
  nextStatementDate?: Date;
  nextPaymentDueDate?: Date;
  daysUntilStatement?: number;
  daysUntilPayment?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function nextDayOfMonth(day: number, timezone: string, now: Date): Date {
  const local = toZonedTime(now, timezone);
  const thisMonthCapped = Math.min(day, getDaysInMonth(local));
  let candidate = setDate(startOfMonth(local), thisMonthCapped);
  if (candidate <= local) {
    const next = addMonths(local, 1);
    candidate = setDate(startOfMonth(next), Math.min(day, getDaysInMonth(next)));
  }
  return fromZonedTime(candidate, timezone);
}

export function analyzeCredit(input: {
  balanceCents: number;
  creditLimitCents: number | null;
  rateBps: number | null;
  statementDay: number | null;
  paymentDueDay: number | null;
  timezone: string;
  now?: Date;
}): CreditAnalysis {
  const now = input.now ?? new Date();
  const out: CreditAnalysis = {};

  if (input.creditLimitCents && input.creditLimitCents > 0) {
    out.utilizationRatio = input.balanceCents / input.creditLimitCents;
    out.availableCents = input.creditLimitCents - input.balanceCents;
  }

  if (input.rateBps && input.balanceCents > 0) {
    out.monthlyCarryCostCents = Math.round(
      (input.balanceCents * input.rateBps) / 10_000 / 12
    );
  }

  if (input.statementDay && input.statementDay >= 1 && input.statementDay <= 31) {
    const at = nextDayOfMonth(input.statementDay, input.timezone, now);
    out.nextStatementDate = at;
    out.daysUntilStatement = Math.max(0, Math.round((at.getTime() - now.getTime()) / DAY_MS));
  }

  if (input.paymentDueDay && input.paymentDueDay >= 1 && input.paymentDueDay <= 31) {
    const at = nextDayOfMonth(input.paymentDueDay, input.timezone, now);
    out.nextPaymentDueDate = at;
    out.daysUntilPayment = Math.max(0, Math.round((at.getTime() - now.getTime()) / DAY_MS));
  }

  return out;
}
