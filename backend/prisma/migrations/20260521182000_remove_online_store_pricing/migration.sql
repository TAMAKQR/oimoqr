UPDATE "Subscription"
SET "pricingTierId" = NULL
WHERE "pricingTierId" IN (
  SELECT "id"
  FROM "PricingTier"
  WHERE "businessType" = 'ONLINE_STORE'
);

DELETE FROM "PricingTier"
WHERE "businessType" = 'ONLINE_STORE';

DELETE FROM "TrialConfig"
WHERE "businessType" = 'ONLINE_STORE';
