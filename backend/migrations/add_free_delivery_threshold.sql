-- Add freeDeliveryThreshold column to Restaurant table
-- Free delivery when order total >= this amount
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "freeDeliveryThreshold" DOUBLE PRECISION;
