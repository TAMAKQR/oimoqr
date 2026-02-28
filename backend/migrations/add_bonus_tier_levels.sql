-- Configurable customer bonus tier labels and thresholds on pricing tiers
ALTER TABLE "PricingTier"
  ADD COLUMN IF NOT EXISTS "bonusBronzeLabel" TEXT NOT NULL DEFAULT 'Bronze',
  ADD COLUMN IF NOT EXISTS "bonusSilverLabel" TEXT NOT NULL DEFAULT 'Silver',
  ADD COLUMN IF NOT EXISTS "bonusGoldLabel" TEXT NOT NULL DEFAULT 'Gold',
  ADD COLUMN IF NOT EXISTS "bonusSilverFromOrders" INTEGER NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS "bonusGoldFromOrders" INTEGER NOT NULL DEFAULT 20;
