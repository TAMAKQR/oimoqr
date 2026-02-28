# 🏢 Система брендов для управления сетями ресторанов

## 📋 Проблема (было)

**Старая система:**
- Каждый ресторан = отдельная подписка
- Сеть из 5 ресторанов = 5 подписок = 5 платежей
- Усложненный биллинг для владельцев сетей
- Дублирование меню для каждого ресторана

## ✅ Решение (стало)

**Новая система брендов:**
- **1 бренд → много ресторанов → 1 подписка**
- Одна оплата для всей сети
- Общие лимиты SMS и клиентов
- Упрощенное управление

---

## 🎯 Как это работает

### Структура

```
RestaurantBrand (Бренд/Сеть)
  ├── name: "Тануки"
  ├── logo: "logo.png"
  ├── Subscription (одна на весь бренд)
  │   ├── plan: "PROFESSIONAL"
  │   ├── smsUsedThisMonth: 45 (общий счетчик)
  │   └── addons: ["delivery"]
  └── Restaurants (несколько ресторанов)
      ├── Restaurant #1 (Москва, Арбат)
      ├── Restaurant #2 (Москва, Тверская)  
      └── Restaurant #3 (Санкт-Петербург)
```

### Преимущества

✅ **Один платеж** - оплатил раз, управляй всеми ресторанами  
✅ **Общие лимиты** - SMS и клиенты суммируются по всему бренду  
✅ **Shared menu** - легко делиться меню между ресторанами сети  
✅ **Единый биллинг** - одна подписка, один dashboard

---

## 🔧 API Endpoints

### Получить все бренды текущего пользователя
```http
GET /api/brands
Authorization: Bearer {token}
```

**Response:**
```json
[
  {
    "id": "brand-123",
    "name": "Тануки",
    "description": "Сеть японских ресторанов",
    "logo": "https://...",
    "restaurants": [
      {
        "id": "rest-1",
        "name": "Тануки - Арбат",
        "subdomain": "tanuki-arbat"
      }
    ],
    "subscription": {
      "plan": "PROFESSIONAL",
      "status": "ACTIVE"
    }
  }
]
```

### Создать новый бренд
```http
POST /api/brands
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Моя сеть ресторанов",
  "description": "Описание бренда",
  "logo": "https://..."
}
```

### Добавить ресторан в бренд
```http
PUT /api/brands/{brandId}/restaurants/{restaurantId}
Authorization: Bearer {token}
```

**Проверяется:**
- Лимит maxRestaurants по подписке
- Принадлежность ресторана пользователю

### Убрать ресторан из бренда
```http
DELETE /api/brands/{brandId}/restaurants/{restaurantId}
Authorization: Bearer {token}
```

---

## 📊 Лимиты работают на уровне бренда

### SMS лимиты
```javascript
// Было: каждый ресторан считал SMS отдельно
Restaurant #1: 10 SMS
Restaurant #2: 15 SMS
Restaurant #3: 20 SMS
Итого: 45 SMS, но каждый платил отдельно

// Стало: общий счетчик для бренда
Brand "Тануки": 45 SMS (все рестораны суммируются)
```

### Лимиты клиентов
```javascript
// Middleware checkCustomerLimit теперь считает клиентов 
// по ВСЕМ ресторанам бренда
const brandRestaurantIds = brand.restaurants.map(r => r.id);
const customerCount = await prisma.customer.count({
  where: { registeredRestaurantId: { in: brandRestaurantIds } }
});
```

### Лимит ресторанов
```javascript
// PricingTier.maxRestaurants - максимум ресторанов в бренде
STARTER:      1 ресторан
PROFESSIONAL: 5 ресторанов
BUSINESS:     15 ресторанов
ENTERPRISE:   Безлимит
```

---

## 🔄 Миграция существующих данных

### Что произошло при миграции:

1. **Создана таблица RestaurantBrand**
2. **Для каждого владельца** создан дефолтный бренд:
   ```sql
   Brand name: "{User.name}'s Restaurants"
   ```
3. **Все рестораны** автоматически привязаны к бренду владельца
4. **Подписки** перенесены на уровень бренда

### После миграции:
- Все существующие владельцы получили 1 бренд
- Все их рестораны объединены в этот бренд
- Старые подписки сохранены (берется первая активная)

---

## 💡 Примеры использования

### Сценарий 1: Создание сети ресторанов

```javascript
// 1. Создать бренд
POST /api/brands
{
  "name": "Кофемания",
  "description": "Федеральная сеть кофеен"
}

// 2. Привязать существующие рестораны к бренду
PUT /api/brands/brand-123/restaurants/rest-1
PUT /api/brands/brand-123/restaurants/rest-2
PUT /api/brands/brand-123/restaurants/rest-3

// 3. Оформить подписку на бренд (не на каждый ресторан)
POST /api/subscriptions
{
  "brandId": "brand-123",
  "pricingTierId": "professional-tier"
}
```

### Сценарий 2: Просмотр статистики по бренду

```javascript
GET /api/subscriptions/{restaurantId}/usage

Response:
{
  "brand": {
    "id": "brand-123",
    "name": "Кофемания",
    "restaurantCount": 5
  },
  "sms": {
    "used": 120,           // Суммарно по всем 5 ресторанам
    "included": 200,
    "overage": 0
  },
  "customers": {
    "used": 450,           // Всего клиентов по всему бренду
    "limit": 1000,
    "percentage": 45
  },
  "restaurants": {
    "used": 5,             // Количество ресторанов
    "limit": 5,
    "percentage": 100
  }
}
```

---

## ⚠️ Breaking Changes

### Для существующих владельцев:
- ✅ Автоматическая миграция - всё работает как раньше
- ✅ Созданы дефолтные бренды
- ✅ Подписки сохранены

### Для новых владельцев:
- При создании первого ресторана автоматически создается бренд
- Можно создать несколько брендов для разных концепций

---

## 🎨 UI компоненты (для frontend)

### Dashboard владельца должен показывать:

```
┌─────────────────────────────────────┐
│ Мои бренды                          │
├─────────────────────────────────────┤
│ 📍 Тануки                           │
│    → 3 ресторана                    │
│    → План: Professional ($99/мес)   │
│    → SMS: 45/200                    │
│                                     │
│ 📍 Кофемания                        │
│    → 5 ресторанов                   │
│    → План: Business ($299/мес)      │
│    → SMS: безлимит                  │
└─────────────────────────────────────┘
```

---

## 🚀 Следующие шаги

1. ✅ Backend готов и задеплоен
2. ⏳ Frontend: создать страницу управления брендами
3. ⏳ Frontend: UI для добавления ресторанов в бренд
4. ⏳ Frontend: Dashboard с brand-level статистикой

---

## 📝 Файлы

- **Schema:** `backend/prisma/schema.prisma`
- **Migration:** `backend/prisma/migrations/add_restaurant_brands.sql`
- **Controller:** `backend/src/controllers/brand.controller.js`
- **Routes:** `backend/src/routes/brand.routes.js`
- **Middleware:** `backend/src/middleware/subscriptionLimits.js`

---

## ✨ Результат

**Было:** Сложно, дорого, много подписок  
**Стало:** Просто, удобно, одна подписка на всю сеть! 🎉
