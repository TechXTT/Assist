/*
  CalendarEvent rows are pure cache from Phase 3 — drop them so the new
  NOT NULL calendarId FK can be applied. Next sync repopulates from Google.
*/
DELETE FROM "CalendarEvent";

-- CreateTable
CREATE TABLE "Calendar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "googleCalendarId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT,
    "backgroundColor" TEXT,
    "foregroundColor" TEXT,
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "accessRole" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Calendar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CalendarEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
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
    CONSTRAINT "CalendarEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CalendarEvent_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "Calendar" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CalendarEvent" ("allDay", "description", "endsAt", "googleEventId", "htmlLink", "id", "lastSyncedAt", "location", "startsAt", "status", "timeZone", "title", "userId") SELECT "allDay", "description", "endsAt", "googleEventId", "htmlLink", "id", "lastSyncedAt", "location", "startsAt", "status", "timeZone", "title", "userId" FROM "CalendarEvent";
DROP TABLE "CalendarEvent";
ALTER TABLE "new_CalendarEvent" RENAME TO "CalendarEvent";
CREATE INDEX "CalendarEvent_userId_startsAt_idx" ON "CalendarEvent"("userId", "startsAt");
CREATE UNIQUE INDEX "CalendarEvent_calendarId_googleEventId_key" ON "CalendarEvent"("calendarId", "googleEventId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Calendar_userId_googleCalendarId_key" ON "Calendar"("userId", "googleCalendarId");
