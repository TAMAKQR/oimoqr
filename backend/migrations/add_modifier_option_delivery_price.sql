-- Add separate delivery price for modifier options
ALTER TABLE "ModifierOption"
ADD COLUMN IF NOT EXISTS "deliveryPrice" DOUBLE PRECISION;