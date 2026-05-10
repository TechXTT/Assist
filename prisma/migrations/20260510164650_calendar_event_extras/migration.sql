-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CalendarEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "googleEventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "htmlLink" TEXT,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "timeZone" TEXT,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CalendarEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CalendarEvent" ("description", "endsAt", "googleEventId", "id", "lastSyncedAt", "location", "startsAt", "title", "userId") SELECT "description", "endsAt", "googleEventId", "id", "lastSyncedAt", "location", "startsAt", "title", "userId" FROM "CalendarEvent";
DROP TABLE "CalendarEvent";
ALTER TABLE "new_CalendarEvent" RENAME TO "CalendarEvent";
CREATE UNIQUE INDEX "CalendarEvent_googleEventId_key" ON "CalendarEvent"("googleEventId");
CREATE INDEX "CalendarEvent_userId_startsAt_idx" ON "CalendarEvent"("userId", "startsAt");
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
    "googleNeedsReauth" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_User" ("briefingTime", "createdAt", "email", "emailVerified", "id", "image", "name", "timezone") SELECT "briefingTime", "createdAt", "email", "emailVerified", "id", "image", "name", "timezone" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
