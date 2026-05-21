ALTER TABLE "TrialConfig" ADD COLUMN IF NOT EXISTS "businessType" TEXT;

UPDATE "TrialConfig"
SET "businessType" = CASE
  WHEN "id" = (
    SELECT "id"
    FROM "TrialConfig"
    ORDER BY "updatedAt" DESC
    LIMIT 1
  ) THEN 'ALL'
  ELSE 'ALL-' || "id"
END
WHERE "businessType" IS NULL;

ALTER TABLE "TrialConfig" ALTER COLUMN "businessType" SET DEFAULT 'ALL';
ALTER TABLE "TrialConfig" ALTER COLUMN "businessType" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "TrialConfig_businessType_key" ON "TrialConfig"("businessType");
