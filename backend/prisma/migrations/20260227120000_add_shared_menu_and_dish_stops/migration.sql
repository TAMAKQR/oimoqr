-- Shared menu source (a restaurant can reuse menu from another restaurant in same network)
ALTER TABLE "Restaurant"
ADD COLUMN "sharedMenuSourceRestaurantId" TEXT;

ALTER TABLE "Restaurant"
ADD CONSTRAINT "Restaurant_sharedMenuSourceRestaurantId_fkey"
FOREIGN KEY ("sharedMenuSourceRestaurantId") REFERENCES "Restaurant"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Restaurant_sharedMenuSourceRestaurantId_idx"
ON "Restaurant"("sharedMenuSourceRestaurantId");

-- Per-restaurant dish stop list
CREATE TABLE "DishStop" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "dishId" TEXT NOT NULL,
  "isStopped" BOOLEAN NOT NULL DEFAULT true,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DishStop_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DishStop_restaurantId_dishId_key" ON "DishStop"("restaurantId", "dishId");
CREATE INDEX "DishStop_restaurantId_isStopped_idx" ON "DishStop"("restaurantId", "isStopped");

ALTER TABLE "DishStop"
ADD CONSTRAINT "DishStop_restaurantId_fkey"
FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DishStop"
ADD CONSTRAINT "DishStop_dishId_fkey"
FOREIGN KEY ("dishId") REFERENCES "Dish"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
