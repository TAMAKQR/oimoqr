/*
  Warnings:

  - You are about to drop the column `required` on the `Modifier` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Modifier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "price" REAL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "dishId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Modifier_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Modifier" ("createdAt", "dishId", "id", "name", "order", "type", "updatedAt") SELECT "createdAt", "dishId", "id", "name", "order", "type", "updatedAt" FROM "Modifier";
DROP TABLE "Modifier";
ALTER TABLE "new_Modifier" RENAME TO "Modifier";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
