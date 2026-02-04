#!/bin/bash
# Quick fix script for Render PostgreSQL
# Run this in Render Shell (psql)

echo "Fixing dish deletion constraints..."

psql << 'EOF'
-- Drop existing constraints
ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_dishId_fkey";
ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_productId_fkey";

-- Add new constraints with ON DELETE SET NULL
ALTER TABLE "OrderItem" 
  ADD CONSTRAINT "OrderItem_dishId_fkey" 
  FOREIGN KEY ("dishId") 
  REFERENCES "Dish"("id") 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

ALTER TABLE "OrderItem" 
  ADD CONSTRAINT "OrderItem_productId_fkey" 
  FOREIGN KEY ("productId") 
  REFERENCES "Product"("id") 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

\echo 'Migration completed successfully!'
EOF

echo "Done! You can now delete dishes from the admin panel."
