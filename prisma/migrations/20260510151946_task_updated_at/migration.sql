/*
  Warnings:

  - Added the required column `updatedAt` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueAt" DATETIME,
    "priority" TEXT NOT NULL DEFAULT 'med',
    "status" TEXT NOT NULL DEFAULT 'todo',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "externalId" TEXT,
    "tinyFirstStep" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("completedAt", "createdAt", "description", "dueAt", "externalId", "id", "priority", "source", "status", "tinyFirstStep", "title", "userId") SELECT "completedAt", "createdAt", "description", "dueAt", "externalId", "id", "priority", "source", "status", "tinyFirstStep", "title", "userId" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_userId_status_idx" ON "Task"("userId", "status");
CREATE INDEX "Task_userId_dueAt_idx" ON "Task"("userId", "dueAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
