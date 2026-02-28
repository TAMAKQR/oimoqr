-- Migration: Add delivery addon and SMS/customer limits
-- Date: 2026-02-28

-- Добавляем новые поля в PricingTier
ALTER TABLE "PricingTier" ADD COLUMN IF NOT EXISTS "includesDelivery" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PricingTier" ADD COLUMN IF NOT EXISTS "includedSmsCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PricingTier" ADD COLUMN IF NOT EXISTS "smsOveragePrice" DOUBLE PRECISION NOT NULL DEFAULT 0.10;
ALTER TABLE "PricingTier" ADD COLUMN IF NOT EXISTS "maxCustomers" INTEGER;
ALTER TABLE "PricingTier" ADD COLUMN IF NOT EXISTS "maxStaff" INTEGER;

-- Добавляем поля для tracking использования в Subscription
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "addons" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "smsUsedThisMonth" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "smsResetDate" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "smsOverageCharges" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Обновляем существующие тарифы
UPDATE "PricingTier"
SET 
  "includesDelivery" = false,
  "includedSmsCount" = 0,
  "maxCustomers" = 100
WHERE "name" = 'STARTER';

UPDATE "PricingTier"
SET 
  "includesDelivery" = false,
  "includedSmsCount" = 50,
  "maxCustomers" = 1000
WHERE "name" = 'PROFESSIONAL';

UPDATE "PricingTier"
SET 
  "includesDelivery" = true,
  "includedSmsCount" = -1,  -- -1 означает безлимит
  "maxCustomers" = NULL      -- NULL означает безлимит
WHERE "name" = 'BUSINESS';

-- Создаем новый тариф ENTERPRISE (если не существует)
INSERT INTO "PricingTier" (
  "id",
  "name",
  "price",
  "description",
  "maxRestaurants",
  "includesDelivery",
  "includedSmsCount",
  "maxCustomers",
  "businessType",
  "order",
  "isActive",
  "createdAt",
  "updatedAt"
)
VALUES (
  'enterprise-tier-001',
  'ENTERPRISE',
  299.99,
  'Безлимитная подписка для крупных сетей с персональной поддержкой',
  NULL,  -- Безлимит ресторанов
  true,
  -1,    -- Безлимит SMS
  NULL,  -- Безлимит клиентов
  'ALL',
  4,
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO NOTHING;

-- Комментарии для справки
COMMENT ON COLUMN "PricingTier"."includesDelivery" IS 'Включен ли модуль доставки в тариф';
COMMENT ON COLUMN "PricingTier"."includedSmsCount" IS 'Количество включенных SMS (-1 = безлимит)';
COMMENT ON COLUMN "PricingTier"."smsOveragePrice" IS 'Цена за SMS сверх лимита';
COMMENT ON COLUMN "PricingTier"."maxCustomers" IS 'Максимальное количество клиентов в базе (NULL = безлимит)';
COMMENT ON COLUMN "Subscription"."addons" IS 'Список подключенных add-ons (delivery, analytics, customers_pro)';
COMMENT ON COLUMN "Subscription"."smsUsedThisMonth" IS 'Количество использованных SMS в текущем месяце';
COMMENT ON COLUMN "Subscription"."smsResetDate" IS 'Дата сброса счетчика SMS (обычно 1 число месяца)';
COMMENT ON COLUMN "Subscription"."smsOverageCharges" IS 'Накопленные charges за SMS сверх лимита';
