-- Persist spent bonuses per order to make redemption stateful
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "bonusSpent" INTEGER NOT NULL DEFAULT 0;
