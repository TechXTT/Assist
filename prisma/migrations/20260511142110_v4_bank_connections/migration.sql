-- CreateTable
CREATE TABLE "BankConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "agreementId" TEXT,
    "institutionId" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "accountsJson" TEXT,
    "expiresAt" DATETIME,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "description" TEXT NOT NULL,
    "category" TEXT,
    "occurredAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "externalId" TEXT,
    "sourceMessageId" TEXT,
    "sourceMessageSnippet" TEXT,
    "bankConnectionId" TEXT,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Transaction_bankConnectionId_fkey" FOREIGN KEY ("bankConnectionId") REFERENCES "BankConnection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("amountCents", "category", "currency", "description", "externalId", "id", "occurredAt", "source", "sourceMessageId", "sourceMessageSnippet", "userId") SELECT "amountCents", "category", "currency", "description", "externalId", "id", "occurredAt", "source", "sourceMessageId", "sourceMessageSnippet", "userId" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE INDEX "Transaction_userId_occurredAt_idx" ON "Transaction"("userId", "occurredAt");
CREATE INDEX "Transaction_userId_sourceMessageId_idx" ON "Transaction"("userId", "sourceMessageId");
CREATE INDEX "Transaction_userId_source_externalId_idx" ON "Transaction"("userId", "source", "externalId");
CREATE INDEX "Transaction_bankConnectionId_idx" ON "Transaction"("bankConnectionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "BankConnection_requisitionId_key" ON "BankConnection"("requisitionId");

-- CreateIndex
CREATE INDEX "BankConnection_userId_status_idx" ON "BankConnection"("userId", "status");
