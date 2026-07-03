ALTER TABLE "OrderItem" ADD COLUMN "dishName" TEXT;

ALTER TABLE "OrderItem" ALTER COLUMN "dishId" DROP NOT NULL;

ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_dishId_fkey";

ALTER TABLE "OrderItem"
ADD CONSTRAINT "OrderItem_dishId_fkey"
FOREIGN KEY ("dishId") REFERENCES "Dish"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "OrderItem" AS oi
SET "dishName" = d."name"
FROM "Dish" AS d
WHERE oi."dishId" = d."id"
  AND oi."dishName" IS NULL;
