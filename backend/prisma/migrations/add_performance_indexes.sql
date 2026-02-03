-- Добавление индексов для оптимизации производительности

-- Индексы для быстрого поиска ресторана по subdomain
CREATE INDEX IF NOT EXISTS "Restaurant_subdomain_idx" ON "Restaurant"("subdomain");

-- Индексы для категорий
CREATE INDEX IF NOT EXISTS "Category_restaurantId_order_idx" ON "Category"("restaurantId", "order");

-- Индексы для блюд
CREATE INDEX IF NOT EXISTS "Dish_categoryId_order_idx" ON "Dish"("categoryId", "order");
CREATE INDEX IF NOT EXISTS "Dish_restaurantId_available_idx" ON "Dish"("restaurantId", "available");

-- Индексы для модификаторов
CREATE INDEX IF NOT EXISTS "Modifier_dishId_order_idx" ON "Modifier"("dishId", "order");

-- Индексы для опций модификаторов
CREATE INDEX IF NOT EXISTS "ModifierOption_modifierId_idx" ON "ModifierOption"("modifierId");

-- Индексы для подписок
CREATE INDEX IF NOT EXISTS "Subscription_restaurantId_status_idx" ON "Subscription"("restaurantId", "status");
CREATE INDEX IF NOT EXISTS "Subscription_trialEndsAt_idx" ON "Subscription"("trialEndsAt");
CREATE INDEX IF NOT EXISTS "Subscription_currentPeriodEnd_idx" ON "Subscription"("currentPeriodEnd");

-- Индексы для переводов
CREATE INDEX IF NOT EXISTS "DishTranslation_dishId_languageCode_idx" ON "DishTranslation"("dishId", "languageCode");
CREATE INDEX IF NOT EXISTS "CategoryTranslation_categoryId_languageCode_idx" ON "CategoryTranslation"("categoryId", "languageCode");

-- Индексы для групп категорий
CREATE INDEX IF NOT EXISTS "CategoryGroup_restaurantId_order_idx" ON "CategoryGroup"("restaurantId", "order");
CREATE INDEX IF NOT EXISTS "Category_categoryGroupId_idx" ON "Category"("categoryGroupId");

-- Индексы для языков ресторана
CREATE INDEX IF NOT EXISTS "RestaurantLanguage_restaurantId_isEnabled_idx" ON "RestaurantLanguage"("restaurantId", "isEnabled");

-- Индексы для просмотров меню
CREATE INDEX IF NOT EXISTS "MenuView_restaurantId_viewedAt_idx" ON "MenuView"("restaurantId", "viewedAt");

-- Индексы для заказов
CREATE INDEX IF NOT EXISTS "Order_restaurantId_createdAt_idx" ON "Order"("restaurantId", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_customerId_idx" ON "Order"("customerId");

-- Индексы для избранного
CREATE INDEX IF NOT EXISTS "CustomerFavorite_customerId_idx" ON "CustomerFavorite"("customerId");
CREATE INDEX IF NOT EXISTS "CustomerFavorite_dishId_idx" ON "CustomerFavorite"("dishId");
