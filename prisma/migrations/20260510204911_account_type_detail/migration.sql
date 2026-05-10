-- CreateTable
CREATE TABLE "Holding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT,
    "shares" DECIMAL NOT NULL,
    "avgCostCents" INTEGER,
    "lastKnownPriceCents" INTEGER NOT NULL,
    "lastPriceUpdate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Holding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
INSERT INTO "new_FinancialAccount" ("archived", "balanceCents", "createdAt", "currency", "id", "includeInNetWorth", "isLiability", "name", "notes", "type", "updatedAt", "userId") SELECT "archived", "balanceCents", "createdAt", "currency", "id", "includeInNetWorth", "isLiability", "name", "notes", "type", "updatedAt", "userId" FROM "FinancialAccount";
DROP TABLE "FinancialAccount";
ALTER TABLE "new_FinancialAccount" RENAME TO "FinancialAccount";
CREATE INDEX "FinancialAccount_userId_archived_includeInNetWorth_idx" ON "FinancialAccount"("userId", "archived", "includeInNetWorth");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Holding_accountId_idx" ON "Holding"("accountId");
