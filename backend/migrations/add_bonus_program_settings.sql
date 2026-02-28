-- Bonus program configuration for tariffs and per-restaurant overrides
ALTER TABLE "PricingTier"
  ADD COLUMN IF NOT EXISTS "bonusProgramEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "bonusAccrualRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "bonusExpiryDays" INTEGER NOT NULL DEFAULT 90;

ALTER TABLE "Restaurant"
  ADD COLUMN IF NOT EXISTS "useTierBonusSettings" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "bonusProgramEnabled" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "bonusAccrualRate" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "bonusExpiryDays" INTEGER;
