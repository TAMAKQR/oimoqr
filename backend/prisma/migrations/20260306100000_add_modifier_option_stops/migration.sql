-- Per-restaurant stop list for modifier options
CREATE TABLE "ModifierOptionStop" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "modifierOptionId" TEXT NOT NULL,
  "isStopped" BOOLEAN NOT NULL DEFAULT true,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModifierOptionStop_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModifierOptionStop_restaurantId_modifierOptionId_key"
ON "ModifierOptionStop"("restaurantId", "modifierOptionId");

CREATE INDEX "ModifierOptionStop_restaurantId_isStopped_idx"
ON "ModifierOptionStop"("restaurantId", "isStopped");

ALTER TABLE "ModifierOptionStop"
ADD CONSTRAINT "ModifierOptionStop_restaurantId_fkey"
FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ModifierOptionStop"
ADD CONSTRAINT "ModifierOptionStop_modifierOptionId_fkey"
FOREIGN KEY ("modifierOptionId") REFERENCES "ModifierOption"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
