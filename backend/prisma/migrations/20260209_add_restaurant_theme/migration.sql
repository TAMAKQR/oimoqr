-- Add menu color storage per restaurant
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "primaryColor" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "themePalette" JSONB;
