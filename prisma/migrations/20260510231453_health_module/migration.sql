-- CreateTable
CREATE TABLE "ExerciseSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "activity" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExerciseSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "lastWindDownDismissedOn" DATETIME
);
INSERT INTO "new_User" ("briefingTime", "cashFlowDiscretionaryDailyCents", "cashFlowHorizonDays", "cashFlowIncludeDiscretionary", "cashFlowTightThresholdCents", "createdAt", "email", "emailVerified", "googleNeedsReauth", "id", "image", "lastCalendarSyncAt", "name", "timezone") SELECT "briefingTime", "cashFlowDiscretionaryDailyCents", "cashFlowHorizonDays", "cashFlowIncludeDiscretionary", "cashFlowTightThresholdCents", "createdAt", "email", "emailVerified", "googleNeedsReauth", "id", "image", "lastCalendarSyncAt", "name", "timezone" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ExerciseSession_userId_occurredAt_idx" ON "ExerciseSession"("userId", "occurredAt");
