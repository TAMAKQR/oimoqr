-- Add businessType column to PricingTier
ALTER TABLE "PricingTier" ADD COLUMN IF NOT EXISTS "businessType" TEXT NOT NULL DEFAULT 'RESTAURANT';

-- Update existing online store tiers (those with ONLINE_STORE in features JSON)
UPDATE "PricingTier" 
SET "businessType" = 'ONLINE_STORE' 
WHERE "features" LIKE '%ONLINE_STORE%';
