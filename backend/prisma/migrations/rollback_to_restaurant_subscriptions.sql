-- ROLLBACK Migration: Restore old Subscription structure
-- Date: 2026-02-28
-- CRITICAL: This rollback restores the restaurant-level subscription system

-- ===================================================================
-- Шаг 1: Сохраняем данные из текущей Subscription (brand-level)
-- ===================================================================

CREATE TABLE IF NOT EXISTS "SubscriptionBackup" AS 
SELECT * FROM "Subscription";

-- ===================================================================
-- Шаг 2: Удаляем новую Subscription и пересоздаём старую структуру
-- ===================================================================

DROP TABLE IF EXISTS "Subscription" CASCADE;

CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'TRIAL',
    "status" TEXT NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "pricingTierId" TEXT,
    "addons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "smsUsedThisMonth" INTEGER NOT NULL DEFAULT 0,
    "smsResetDate" TIMESTAMP(3),
    "smsOverageCharges" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "Subscription_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Subscription_restaurantId_fkey" 
        FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Subscription_pricingTierId_fkey"
        FOREIGN KEY ("pricingTierId") REFERENCES "PricingTier"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Subscription_userId_restaurantId_key" ON "Subscription"("userId", "restaurantId");

-- ===================================================================
-- Шаг 3: Восстанавливаем подписки для каждого ресторана
-- ===================================================================

INSERT INTO "Subscription" (
    "id",
    "userId",
    "restaurantId", 
    "plan",
    "status",
    "trialEndsAt",
    "currentPeriodStart",
    "currentPeriodEnd",
    "pricingTierId",
    "addons",
    "smsUsedThisMonth",
    "smsResetDate",
    "smsOverageCharges",
    "createdAt",
    "updatedAt"
)
SELECT 
    r."id" || '-sub' as "id",  -- Новый ID для каждого ресторана
    r."ownerId" as "userId",
    r."id" as "restaurantId",
    sb."plan",
    sb."status",
    sb."trialEndsAt",
    sb."currentPeriodStart",
    sb."currentPeriodEnd",
    sb."pricingTierId",
    sb."addons",
    sb."smsUsedThisMonth",
    sb."smsResetDate",
    sb."smsOverageCharges",
    sb."createdAt",
    NOW() as "updatedAt"
FROM "Restaurant" r
INNER JOIN "RestaurantBrand" rb ON r."brandId" = rb."id"
INNER JOIN "SubscriptionBackup" sb ON sb."brandId" = rb."id";

-- ===================================================================
-- Шаг 4: ОПЦИОНАЛЬНО - Удаляем RestaurantBrand если не нужен
-- ===================================================================

-- Убираем brandId из Restaurant (делаем optional)
ALTER TABLE "Restaurant" DROP CONSTRAINT IF EXISTS "Restaurant_brandId_fkey";
UPDATE "Restaurant" SET "brandId" = NULL;

-- НЕ УДАЛЯЕМ таблицу RestaurantBrand - она может пригодиться позже
-- DROP TABLE IF EXISTS "RestaurantBrand" CASCADE;

-- ===================================================================
-- ЗАВЕРШЕНО - старая система восстановлена
-- ===================================================================

COMMENT ON TABLE "Subscription" IS 'Restaurant-level subscriptions (old system restored)';
