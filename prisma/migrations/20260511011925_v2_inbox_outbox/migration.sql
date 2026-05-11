-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "sourceMessageId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "sourceMessageSnippet" TEXT;

-- CreateTable
CREATE TABLE "ReceiptDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "parsedAmountCents" INTEGER,
    "parsedCurrency" TEXT,
    "parsedDate" DATETIME,
    "parsedMerchant" TEXT,
    "suggestedCategory" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReceiptDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "cashFlowDiscretionaryDailyCents" INTEGER,
    "weeklyExerciseTargetMinutes" INTEGER NOT NULL DEFAULT 90,
    "sleepTargetHours" REAL,
    "targetBedtime" TEXT,
    "windDownEnabled" BOOLEAN NOT NULL DEFAULT false,
    "windDownMinutesBefore" INTEGER NOT NULL DEFAULT 30,
    "lastWindDownDismissedOn" DATETIME,
    "aiMonthlyCapCents" INTEGER NOT NULL DEFAULT 500,
    "emailBriefingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailReviewEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailDeliveryHour" INTEGER NOT NULL DEFAULT 7,
    "emailReviewWeekday" INTEGER NOT NULL DEFAULT 0,
    "lastBriefingEmailSentOn" DATETIME,
    "lastReviewEmailSentOn" DATETIME
);
INSERT INTO "new_User" ("aiMonthlyCapCents", "briefingTime", "cashFlowDiscretionaryDailyCents", "cashFlowHorizonDays", "cashFlowIncludeDiscretionary", "cashFlowTightThresholdCents", "createdAt", "email", "emailVerified", "googleNeedsReauth", "id", "image", "lastCalendarSyncAt", "lastWindDownDismissedOn", "name", "sleepTargetHours", "targetBedtime", "timezone", "weeklyExerciseTargetMinutes", "windDownEnabled", "windDownMinutesBefore") SELECT "aiMonthlyCapCents", "briefingTime", "cashFlowDiscretionaryDailyCents", "cashFlowHorizonDays", "cashFlowIncludeDiscretionary", "cashFlowTightThresholdCents", "createdAt", "email", "emailVerified", "googleNeedsReauth", "id", "image", "lastCalendarSyncAt", "lastWindDownDismissedOn", "name", "sleepTargetHours", "targetBedtime", "timezone", "weeklyExerciseTargetMinutes", "windDownEnabled", "windDownMinutesBefore" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ReceiptDraft_userId_status_idx" ON "ReceiptDraft"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptDraft_userId_gmailMessageId_key" ON "ReceiptDraft"("userId", "gmailMessageId");

-- CreateIndex
CREATE INDEX "Transaction_userId_sourceMessageId_idx" ON "Transaction"("userId", "sourceMessageId");
