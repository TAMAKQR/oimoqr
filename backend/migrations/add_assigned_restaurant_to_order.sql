-- Добавляем поле assignedRestaurantId в таблицу Order
ALTER TABLE "Order" ADD COLUMN "assignedRestaurantId" TEXT;

-- Создаем индекс для быстрого поиска по assignedRestaurantId
CREATE INDEX IF NOT EXISTS "Order_assignedRestaurantId_idx" ON "Order" ("assignedRestaurantId");
