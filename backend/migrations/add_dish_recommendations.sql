-- Add recommendations field to Dish table
-- Stores array of dish IDs for manual recommendations

ALTER TABLE "Dish" 
ADD COLUMN IF NOT EXISTS "recommendationIds" TEXT[];

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS "Dish_recommendationIds_idx" 
ON "Dish" USING GIN ("recommendationIds");

COMMENT ON COLUMN "Dish"."recommendationIds" IS 'Array of dish IDs to recommend with this dish (manual cross-selling)';
