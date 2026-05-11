-- CreateTable
CREATE TABLE "DailyBriefing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "forDate" DATETIME NOT NULL,
    "body" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "modelUsed" TEXT,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyBriefing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeeklyReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "forWeekStart" DATETIME NOT NULL,
    "body" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "modelUsed" TEXT,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "topPriorities" TEXT,
    CONSTRAINT "WeeklyReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiCall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "estimatedCostCents" INTEGER NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiCall_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "aiMonthlyCapCents" INTEGER NOT NULL DEFAULT 500
);
INSERT INTO "new_User" ("briefingTime", "cashFlowDiscretionaryDailyCents", "cashFlowHorizonDays", "cashFlowIncludeDiscretionary", "cashFlowTightThresholdCents", "createdAt", "email", "emailVerified", "googleNeedsReauth", "id", "image", "lastCalendarSyncAt", "lastWindDownDismissedOn", "name", "sleepTargetHours", "targetBedtime", "timezone", "weeklyExerciseTargetMinutes", "windDownEnabled", "windDownMinutesBefore") SELECT "briefingTime", "cashFlowDiscretionaryDailyCents", "cashFlowHorizonDays", "cashFlowIncludeDiscretionary", "cashFlowTightThresholdCents", "createdAt", "email", "emailVerified", "googleNeedsReauth", "id", "image", "lastCalendarSyncAt", "lastWindDownDismissedOn", "name", "sleepTargetHours", "targetBedtime", "timezone", "weeklyExerciseTargetMinutes", "windDownEnabled", "windDownMinutesBefore" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "DailyBriefing_userId_forDate_key" ON "DailyBriefing"("userId", "forDate");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReview_userId_forWeekStart_key" ON "WeeklyReview"("userId", "forWeekStart");

-- CreateIndex
CREATE INDEX "AiCall_userId_occurredAt_idx" ON "AiCall"("userId", "occurredAt");
