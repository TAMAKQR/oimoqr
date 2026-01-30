-- Add image field to ModifierOption table (if not exists)
ALTER TABLE "ModifierOption" ADD COLUMN IF NOT EXISTS "image" TEXT;
