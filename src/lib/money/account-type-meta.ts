import {
  Bitcoin,
  Box,
  CreditCard,
  Landmark,
  LineChart,
  PiggyBank,
  Wallet,
  type LucideIcon
} from "lucide-react";

export type AccountType =
  | "cash"
  | "savings"
  | "investment"
  | "crypto"
  | "credit"
  | "loan"
  | "other";

export const ACCOUNT_TYPES: AccountType[] = [
  "cash",
  "savings",
  "investment",
  "crypto",
  "credit",
  "loan",
  "other"
];

export const ACCOUNT_TYPE_META: Record<
  AccountType,
  { label: string; icon: LucideIcon; defaultLiability: boolean; color: string }
> = {
  cash: { label: "Cash", icon: Wallet, defaultLiability: false, color: "#10b981" },
  savings: { label: "Savings", icon: PiggyBank, defaultLiability: false, color: "#3b82f6" },
  investment: { label: "Investment", icon: LineChart, defaultLiability: false, color: "#8b5cf6" },
  crypto: { label: "Crypto", icon: Bitcoin, defaultLiability: false, color: "#f59e0b" },
  credit: { label: "Credit", icon: CreditCard, defaultLiability: true, color: "#ef4444" },
  loan: { label: "Loan", icon: Landmark, defaultLiability: true, color: "#dc2626" },
  other: { label: "Other", icon: Box, defaultLiability: false, color: "#a8a29e" }
};

export function isKnownAccountType(value: string): value is AccountType {
  return (ACCOUNT_TYPES as string[]).includes(value);
}
