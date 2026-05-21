-- Fix dish deletion by allowing OrderItem.dishId to be set to NULL when dish is deleted
-- This migration adds onDelete: SetNull behavior to the foreign key constraint

-- Drop the existing foreign key constraint
ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_dishId_fkey";

-- Re-add the foreign key constraint with ON DELETE SET NULL
ALTER TABLE "OrderItem" 
  ADD CONSTRAINT "OrderItem_dishId_fkey" 
  FOREIGN KEY ("dishId") 
  REFERENCES "Dish"("id") 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

