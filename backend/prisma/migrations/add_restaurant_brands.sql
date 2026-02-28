-- Migration: Add RestaurantBrand system (один бренд -> много ресторанов -> одна подписка)
-- Date: 2026-02-28

-- ===================================================================
-- Шаг 1: Создаем таблицу RestaurantBrand
-- ===================================================================

CREATE TABLE IF NOT EXISTS "RestaurantBrand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logo" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "RestaurantBrand_ownerId_fkey" 
        FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "RestaurantBrand_ownerId_idx" ON "RestaurantBrand"("ownerId");

-- ===================================================================
-- Шаг 2: Для каждого владельца создаем дефолтный бренд
-- ===================================================================

INSERT INTO "RestaurantBrand" ("id", "name", "description", "ownerId", "updatedAt")
SELECT 
    'brand-' || "id" as "id",
    "name" || '''s Restaurants' as "name",
    'Default restaurant brand' as "description",
    "id" as "ownerId",
    NOW() as "updatedAt"
FROM "User"
WHERE "id" IN (SELECT DISTINCT "ownerId" FROM "Restaurant")
ON CONFLICT DO NOTHING;

-- ===================================================================
-- Шаг 3: Добавляем brandId в Restaurant и связываем с брендом
-- ===================================================================

ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "brandId" TEXT;

-- Связываем все рестораны с дефолтным брендом их владельца
UPDATE "Restaurant"
SET "brandId" = 'brand-' || "ownerId"
WHERE "brandId" IS NULL;

-- Добавляем foreign key constraint
ALTER TABLE "Restaurant" 
ADD CONSTRAINT "Restaurant_brandId_fkey" 
FOREIGN KEY ("brandId") REFERENCES "RestaurantBrand"("id") 
ON DELETE SET NULL ON UPDATE CASCADE;

-- ===================================================================
-- Шаг 4: Создаем временную таблицу для новой структуры Subscription
-- ===================================================================

CREATE TABLE IF NOT EXISTS "SubscriptionNew" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brandId" TEXT NOT NULL UNIQUE,
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
    
    CONSTRAINT "SubscriptionNew_brandId_fkey" 
        FOREIGN KEY ("brandId") REFERENCES "RestaurantBrand"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubscriptionNew_pricingTierId_fkey"
        FOREIGN KEY ("pricingTierId") REFERENCES "PricingTier"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- ===================================================================
-- Шаг 5: Мигрируем данные из старой Subscription в новую
-- ===================================================================

-- Для каждого бренда берем первую (самую активную) подписку владельца
INSERT INTO "SubscriptionNew" (
    "id",
    "brandId",
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
SELECT DISTINCT ON (rb."id")
    s."id",
    rb."id" as "brandId",
    s."plan",
    s."status",
    s."trialEndsAt",
    s."currentPeriodStart",
    s."currentPeriodEnd",
    s."pricingTierId",
    s."addons",
    s."smsUsedThisMonth",
    s."smsResetDate",
    s."smsOverageCharges",
    s."createdAt",
    NOW() as "updatedAt"
FROM "RestaurantBrand" rb
LEFT JOIN "Restaurant" r ON r."brandId" = rb."id"
LEFT JOIN "Subscription" s ON s."restaurantId" = r."id"
WHERE s."id" IS NOT NULL
ORDER BY rb."id", 
         CASE s."status" 
             WHEN 'ACTIVE' THEN 1
             WHEN 'TRIAL' THEN 2
             WHEN 'PAST_DUE' THEN 3
             ELSE 4
         END,
         s."createdAt" DESC
ON CONFLICT DO NOTHING;

-- ===================================================================
-- Шаг 6: Удаляем старую Subscription и переименовываем новую
-- ===================================================================

DROP TABLE IF EXISTS "Subscription" CASCADE;
ALTER TABLE "SubscriptionNew" RENAME TO "Subscription";

-- ===================================================================
-- Шаг 7: Создаем индекс для brandId
-- ===================================================================

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_brandId_key" ON "Subscription"("brandId");

-- ===================================================================
-- КОММЕНТАРИИ для документации
-- ===================================================================

COMMENT ON TABLE "RestaurantBrand" IS 'Бренд/сеть ресторанов - объединяет несколько ресторанов под одной подпиской';
COMMENT ON COLUMN "RestaurantBrand"."name" IS 'Название бренда/сети (например: "Тануки", "Кофемания")';
COMMENT ON COLUMN "Restaurant"."brandId" IS 'Принадлежность ресторана к бренду/сети';
COMMENT ON COLUMN "Subscription"."brandId" IS 'Подписка привязана к бренду, а не к отдельному ресторану';
COMMENT ON COLUMN "Subscription"."smsUsedThisMonth" IS 'Счетчик SMS за месяц для ВСЕХ ресторанов бренда';

-- ===================================================================
-- ЗАВЕРШЕНО
-- ===================================================================

