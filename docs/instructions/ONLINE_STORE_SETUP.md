# 🛍️ Онлайн Магазин - Расширение OimoQR

## ✅ Что добавлено

Проект **OimoQR** теперь поддерживает не только QR-меню для ресторанов, но и полноценные **онлайн-магазины**!

---

## 📊 Структура базы данных

### Новые модели

#### 1. **Restaurant** (расширен)
```prisma
businessType String @default("RESTAURANT") // RESTAURANT | ONLINE_STORE
```

#### 2. **ProductCategory**
```prisma
model ProductCategory {
  id           String
  name         String
  description  String?
  image        String?
  order        Int
  isActive     Boolean
  restaurantId String
  products     Product[]
}
```

#### 3. **Product**
```prisma
model Product {
  id                String
  name              String
  description       String?
  sku               String?     // Артикул
  price             Float
  compareAtPrice    Float?      // Цена "было"
  cost              Float?      // Себестоимость
  images            String?     // JSON массив
  available         Boolean
  featured          Boolean     // Рекомендуемый
  trackInventory    Boolean
  stockQuantity     Int
  weight            Float?
  dimensions        String?     // JSON
  categoryId        String
  restaurantId      String
  variants          ProductVariant[]
}
```

#### 4. **ProductVariant**
```prisma
model ProductVariant {
  id             String
  name           String   // "Размер: L, Цвет: Красный"
  sku            String?
  price          Float?
  stockQuantity  Int
  options        String   // JSON: {"size": "L", "color": "Red"}
  productId      String
}
```

---

## 🚀 API Endpoints

### Product Categories

| Method | Endpoint | Описание |
|--------|----------|----------|
| GET | `/api/products/categories/:restaurantId` | Получить все категории |
| POST | `/api/products/categories` | Создать категорию |
| PUT | `/api/products/categories/:id` | Обновить категорию |
| DELETE | `/api/products/categories/:id` | Удалить категорию |

### Products

| Method | Endpoint | Описание |
|--------|----------|----------|
| GET | `/api/products/category/:categoryId` | Товары по категории |
| GET | `/api/products/restaurant/:restaurantId` | Все товары магазина |
| POST | `/api/products` | Создать товар |
| PUT | `/api/products/:id` | Обновить товар |
| DELETE | `/api/products/:id` | Удалить товар |
| PATCH | `/api/products/:id/stock` | Обновить остатки |

---

## 💰 Тариф "Онлайн Магазин"

**Цена:** 2999 руб/мес

**Возможности:**
- ✅ Неограниченное количество товаров
- ✅ Вариации товаров (размеры, цвета)
- ✅ Управление складом и остатками
- ✅ Система заказов с уведомлениями
- ✅ Интеграция с WhatsApp
- ✅ Аналитика продаж
- ✅ SEO оптимизация
- ✅ Мультивалютность
- ✅ Персональный поддомен
- ✅ Техническая поддержка 24/7

---

## 🔧 Использование

### Создание магазина

```javascript
// При регистрации указать тип бизнеса
const restaurant = await prisma.restaurant.create({
  data: {
    name: "Мой Магазин",
    subdomain: "myshop",
    businessType: "ONLINE_STORE",  // ← Ключевое поле
    ownerId: userId
  }
});
```

### Создание категории товаров

```javascript
POST /api/products/categories
{
  "name": "Электроника",
  "description": "Смартфоны, планшеты, ноутбуки",
  "order": 1,
  "restaurantId": "..."
}
```

### Создание товара

```javascript
POST /api/products
{
  "name": "iPhone 15 Pro",
  "description": "Новейший флагман от Apple",
  "sku": "IPH15PRO",
  "price": 99999,
  "compareAtPrice": 119999,
  "cost": 75000,
  "categoryId": "...",
  "restaurantId": "...",
  "trackInventory": true,
  "stockQuantity": 50,
  "weight": 221
}
```

### Создание вариантов товара

```javascript
// Будет добавлено позже через отдельный endpoint
// Например: "128GB Черный", "256GB Синий" и т.д.
```

### Управление остатками

```javascript
PATCH /api/products/:id/stock
{
  "operation": "subtract",  // "add" | "subtract" | "set"
  "quantity": 5
}
```

---

## 📦 Отличия от ресторана

### Ресторан (RESTAURANT)
- Категории → `Category`
- Блюда → `Dish`
- Модификаторы → `Modifier`
- Заказы через WhatsApp

### Магазин (ONLINE_STORE)
- Категории → `ProductCategory`
- Товары → `Product`
- Варианты → `ProductVariant`
- Управление складом
- SEO поля
- Артикулы (SKU)

---

## 🎨 Frontend (TODO)

Потребуется создать:

1. **Страницы управления магазином:**
   - `/store-management` - Управление товарами
   - `/store-categories` - Категории товаров
   - `/store-inventory` - Остатки на складе
   - `/store-orders` - Заказы

2. **Публичный каталог:**
   - `/shop/:subdomain` - Витрина магазина
   - Фильтры по категориям
   - Поиск товаров
   - Корзина с вариантами

3. **Компоненты:**
   - `ProductCard` - Карточка товара
   - `ProductForm` - Форма создания/редактирования
   - `InventoryTable` - Таблица остатков
   - `VariantSelector` - Выбор вариантов

---

## 📝 Миграция

База данных уже обновлена командой:
```bash
cd backend
npx prisma db push
```

Тариф создан командой:
```bash
node src/scripts/seedOnlineStorePricing.js
```

---

## ✅ Следующие шаги

1. ✅ **Backend готов** - модели, контроллеры, роуты
2. ⏳ **Frontend** - создать интерфейс управления
3. ⏳ **Публичная витрина** - каталог для покупателей
4. ⏳ **Корзина** - адаптировать существующую под товары
5. ⏳ **Аналитика** - отчеты по продажам
6. ⏳ **SEO** - оптимизация страниц товаров

---

## 🔐 API Примеры

### Получить все товары магазина

```bash
GET /api/products/restaurant/clxxx123
```

**Ответ:**
```json
[
  {
    "id": "prod123",
    "name": "iPhone 15 Pro",
    "price": 99999,
    "stockQuantity": 50,
    "available": true,
    "category": {
      "id": "cat1",
      "name": "Электроника"
    },
    "variants": [
      {
        "id": "var1",
        "name": "128GB Черный",
        "price": 99999,
        "stockQuantity": 20
      }
    ]
  }
]
```

### Обновить остатки

```bash
PATCH /api/products/prod123/stock
Content-Type: application/json

{
  "operation": "subtract",
  "quantity": 5
}
```

**Ответ:**
```json
{
  "id": "prod123",
  "stockQuantity": 45
}
```

---

**Готово к разработке онлайн-магазинов!** 🛍️✨
