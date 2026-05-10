-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Bill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "dueDay" INTEGER,
    "dueDate" DATETIME,
    "recurring" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT,
    "lastPaidAt" DATETIME,
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "externalId" TEXT,
    CONSTRAINT "Bill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Bill" ("amountCents", "category", "currency", "dueDate", "dueDay", "externalId", "id", "lastPaidAt", "name", "recurring", "source", "userId") SELECT "amountCents", "category", "currency", "dueDate", "dueDay", "externalId", "id", "lastPaidAt", "name", "recurring", "source", "userId" FROM "Bill";
DROP TABLE "Bill";
ALTER TABLE "new_Bill" RENAME TO "Bill";
CREATE TABLE "new_BudgetCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyLimitCents" INTEGER NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#7c9885',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "BudgetCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BudgetCategory" ("color", "id", "monthlyLimitCents", "name", "userId") SELECT "color", "id", "monthlyLimitCents", "name", "userId" FROM "BudgetCategory";
DROP TABLE "BudgetCategory";
ALTER TABLE "new_BudgetCategory" RENAME TO "BudgetCategory";
CREATE UNIQUE INDEX "BudgetCategory_userId_name_key" ON "BudgetCategory"("userId", "name");
CREATE TABLE "new_SavingsGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetCents" INTEGER NOT NULL,
    "savedCents" INTEGER NOT NULL DEFAULT 0,
    "targetDate" DATETIME,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "SavingsGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SavingsGoal" ("id", "name", "notes", "savedCents", "targetCents", "targetDate", "userId") SELECT "id", "name", "notes", "savedCents", "targetCents", "targetDate", "userId" FROM "SavingsGoal";
DROP TABLE "SavingsGoal";
ALTER TABLE "new_SavingsGoal" RENAME TO "SavingsGoal";
CREATE TABLE "new_Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "billingCycle" TEXT NOT NULL,
    "nextChargeAt" DATETIME NOT NULL,
    "category" TEXT,
    "suspectedUnused" BOOLEAN NOT NULL DEFAULT false,
    "userMarkedUnused" BOOLEAN NOT NULL DEFAULT false,
    "lastReminderShownAt" DATETIME,
    "source" TEXT NOT NULL DEFAULT 'manual',
    CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Subscription" ("amountCents", "billingCycle", "category", "currency", "id", "name", "nextChargeAt", "source", "suspectedUnused", "userId") SELECT "amountCents", "billingCycle", "category", "currency", "id", "name", "nextChargeAt", "source", "suspectedUnused", "userId" FROM "Subscription";
DROP TABLE "Subscription";
ALTER TABLE "new_Subscription" RENAME TO "Subscription";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
