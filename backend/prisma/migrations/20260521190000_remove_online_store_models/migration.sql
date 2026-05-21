DELETE FROM "Restaurant"
WHERE "businessType" = 'ONLINE_STORE';

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

ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_productId_fkey";
ALTER TABLE "OrderItem" DROP COLUMN IF EXISTS "productId";

DROP TABLE IF EXISTS "ProductVariant";
DROP TABLE IF EXISTS "Product";
DROP TABLE IF EXISTS "ProductCategory";
