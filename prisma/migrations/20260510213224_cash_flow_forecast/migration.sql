-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FinancialAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isLiability" BOOLEAN NOT NULL DEFAULT false,
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "includeInNetWorth" BOOLEAN NOT NULL DEFAULT true,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "includeInCashFlow" BOOLEAN NOT NULL DEFAULT true,
    "rateBps" INTEGER,
    "originalPrincipalCents" INTEGER,
    "monthlyPaymentCents" INTEGER,
    "loanTermMonths" INTEGER,
    "loanStartedAt" DATETIME,
    "creditLimitCents" INTEGER,
    "statementDay" INTEGER,
    "paymentDueDay" INTEGER,
    "institution" TEXT,
    "trackHoldings" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinancialAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FinancialAccount" ("archived", "balanceCents", "createdAt", "creditLimitCents", "currency", "id", "includeInNetWorth", "institution", "isLiability", "loanStartedAt", "loanTermMonths", "monthlyPaymentCents", "name", "notes", "originalPrincipalCents", "paymentDueDay", "rateBps", "statementDay", "trackHoldings", "type", "updatedAt", "userId") SELECT "archived", "balanceCents", "createdAt", "creditLimitCents", "currency", "id", "includeInNetWorth", "institution", "isLiability", "loanStartedAt", "loanTermMonths", "monthlyPaymentCents", "name", "notes", "originalPrincipalCents", "paymentDueDay", "rateBps", "statementDay", "trackHoldings", "type", "updatedAt", "userId" FROM "FinancialAccount";
DROP TABLE "FinancialAccount";
ALTER TABLE "new_FinancialAccount" RENAME TO "FinancialAccount";
CREATE INDEX "FinancialAccount_userId_archived_includeInNetWorth_idx" ON "FinancialAccount"("userId", "archived", "includeInNetWorth");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Amsterdam',
    "briefingTime" TEXT NOT NULL DEFAULT '11:00',
    "emailVerified" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCalendarSyncAt" DATETIME,
    "googleNeedsReauth" BOOLEAN NOT NULL DEFAULT false,
    "cashFlowHorizonDays" INTEGER NOT NULL DEFAULT 30,
    "cashFlowTightThresholdCents" INTEGER NOT NULL DEFAULT 10000,
    "cashFlowIncludeDiscretionary" BOOLEAN NOT NULL DEFAULT true,
    "cashFlowDiscretionaryDailyCents" INTEGER
);
INSERT INTO "new_User" ("briefingTime", "createdAt", "email", "emailVerified", "googleNeedsReauth", "id", "image", "lastCalendarSyncAt", "name", "timezone") SELECT "briefingTime", "createdAt", "email", "emailVerified", "googleNeedsReauth", "id", "image", "lastCalendarSyncAt", "name", "timezone" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Seed type-aware defaults for includeInCashFlow on existing rows.
-- cash/savings stay true; everything else flips to false. New rows get
-- the same treatment in the createFinancialAccount action.
UPDATE "FinancialAccount"
SET "includeInCashFlow" = 0
WHERE "type" IN ('investment', 'crypto', 'credit', 'loan', 'other');
