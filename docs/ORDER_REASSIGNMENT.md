# 📍 Order Reassignment - Переназначение заказов

## Описание

Функционал переназначения заказов позволяет распределять заказы между несколькими локациями одной сети ресторанов. Это полезно для:

- 🏪 Сетей ресторанов с несколькими филиалами
- 📍 Распределения заказов по геолокации клиента
- 🚚 Оптимизации доставки (ближайший филиал)
- 📊 Учета статистики по конкретным локациям

---

## 🔧 Как это работает

### Поля в базе данных

Каждый заказ имеет два поля:

- **`restaurantId`** - ресторан, через чье меню был создан заказ (НЕ изменяется)
- **`assignedRestaurantId`** - ресторан, которому назначен заказ для выполнения (может быть переназначен)

### Логика приоритета

```
IF assignedRestaurantId IS NOT NULL
  → Заказ обрабатывается филиалом assignedRestaurantId
ELSE
  → Заказ обрабатывается филиалом restaurantId (по умолчанию)
```

---

## 📝 Миграция базы данных

### 1. Добавьте поле в таблицу Order

```sql
-- Добавляем поле assignedRestaurantId в таблицу Order
ALTER TABLE "Order" ADD COLUMN "assignedRestaurantId" TEXT;

-- Создаем индекс для быстрого поиска по assignedRestaurantId
CREATE INDEX IF NOT EXISTS "Order_assignedRestaurantId_idx" ON "Order" ("assignedRestaurantId");
```

### 2. Выполните миграцию в Supabase

1. Откройте Supabase Dashboard → SQL Editor
2. Скопируйте SQL выше
3. Нажмите **RUN** ✅

---

## 🚀 API

### Переназначить заказ вручную

**Endpoint:**

```http
PUT /api/orders/:orderId/reassign
Content-Type: application/json
```

**Request Body:**

```json
{
  "assignedRestaurantId": "cm123xyz456..."
}
```

**Response:**

```json
{
  "message": "Order reassigned successfully",
  "order": {
    "id": "cmi708asf0001pp2aijjqlgzf",
    "orderNumber": "#3426213969",
    "restaurantId": "cmhwxo85m0001fw2biuazbiun",
    "assignedRestaurantId": "cmhwxo85m0002fw2biuazxxxx",
    "totalAmount": 785,
    "status": "new",
    ...
  },
  "assignedTo": {
    "id": "cmhwxo85m0002fw2biuazxxxx",
    "name": "Buffet №2",
    "phone": "+77078958828",
    "whatsapp": "77078958828"
  }
}
```

---

### 🤖 Автоматическое переназначение по геолокации (для SendPulse)

**Endpoint:**

```http
POST /api/orders/:orderId/auto-reassign
Content-Type: application/json
```

**Request Body (Вариант 1 - Google Maps ссылка):**

```json
{
  "location": "https://maps.google.com/?q=10.767750740051,106.69813537598"
}
```

**Request Body (Вариант 2 - Координаты напрямую):**

```json
{
  "latitude": 10.767750740051,
  "longitude": 106.69813537598
}
```

**Response:**

```json
{
  "message": "Order auto-assigned to nearest restaurant",
  "order": {
    "id": "cmi708asf0001pp2aijjqlgzf",
    "orderNumber": "#3426213969",
    "assignedRestaurantId": "cmhwxo85m0002fw2biuazxxxx",
    "deliveryLatitude": 10.767750740051,
    "deliveryLongitude": 106.69813537598,
    ...
  },
  "assignedTo": {
    "id": "cmhwxo85m0002fw2biuazxxxx",
    "name": "Buffet №2",
    "address": "Проспект Абая, 123",
    "phone": "+77078958828",
    "whatsapp": "77078958828",
    "distance": "0.85 км"
  },
  "customerLocation": {
    "latitude": 10.767750740051,
    "longitude": 106.69813537598
  },
  "inDeliveryZone": true,
  "allNearbyRestaurants": [
    {
      "id": "cmhwxo85m0002fw2biuazxxxx",
      "name": "Buffet №2",
      "distance": "0.85 км"
    },
    {
      "id": "cmhwxo85m0003fw2biuazxxxx",
      "name": "Buffet №3",
      "distance": "2.14 км"
    }
  ]
}
```

**Особенности:**

- 🎯 Автоматически находит ближайший ресторан из той же сети
- 📍 Сохраняет координаты клиента в заказе
- 📊 Проверяет зону доставки
- 📋 Возвращает список 3 ближайших ресторанов

---

## 📱 Интеграция с SendPulse

### Настройка автоматического переназначения

**ВАРИАНТ 1 (ПРОСТОЙ): Отправка Google Maps ссылки**

1. **В SendPulse чат-боте** при получении локации от клиента:

```
Когда пользователь отправляет локацию:
  Сохранить ссылку в переменную {{location}}
  Отправить HTTP POST запрос
```

2. **Настройка HTTP запроса в SendPulse:**

**URL:**

```
https://oimoqr.onrender.com/api/orders/{{orderId}}/auto-reassign
```

**Method:** `POST`

**Headers:**

```
Content-Type: application/json
```

**Body:**

```json
{
  "location": "{{location}}"
}
```

---

**ВАРИАНТ 2 (РАСШИРЕННЫЙ): Извлечение координат**

1. **В SendPulse чат-боте** при получении локации от клиента:

```
Когда пользователь отправляет локацию:
  Извлечь latitude и longitude
  Сохранить в переменные {{latitude}} и {{longitude}}
  Отправить HTTP POST запрос
```

2. **Настройка HTTP запроса в SendPulse:**

**URL:**

```
https://oimoqr.onrender.com/api/orders/{{orderId}}/auto-reassign
```

**Method:** `POST`

**Headers:**

```
Content-Type: application/json
```

**Body:**

```json
{
  "latitude": {{latitude}},
  "longitude": {{longitude}}
}
```

---

3. **Обработка ответа:**

SendPulse получит информацию о назначенном ресторане:

```
Ваш заказ №{{orderNumber}} назначен на филиал:
📍 {{assignedTo.name}}
📞 {{assignedTo.phone}}
📏 Расстояние: {{assignedTo.distance}}
```

### Пример сценария в SendPulse

[Клиент отправляет локацию]
↓
[Бот получает координаты]
↓
[POST /api/orders/{orderId}/auto-reassign]
↓
[Получаем ближайший филиал]
↓
[Отправляем клиенту:]
"✅ Ваш заказ принят!
📍 Готовить будет филиал: Buffet №2
📞 Телефон: +77078958828
📏 Расстояние: 0.85 км
⏱ Ожидаемое время доставки: 30-40 минут"

````

### Извлечение координат из Google Maps ссылки

Если клиент отправляет ссылку типа `https://maps.google.com/?q=10.767750740051,106.69813537598`:

В SendPulse используйте регулярное выражение для извлечения координат:

```regex
q=([0-9.]+),([0-9.]+)
````

Затем передайте эти значения в API.

---

## 📊 Статистика и аналитика

### ✅ Правильный учет заказов

После обновления контроллера аналитики, статистика **правильно учитывает** переназначенные заказы:

```javascript
// Заказ считается принадлежащим ресторану, если:
// 1. assignedRestaurantId === restaurantId (переназначен сюда)
// 2. assignedRestaurantId === null И restaurantId === restaurantId (не переназначен)

const orderFilter = {
  OR: [
    { assignedRestaurantId: restaurantId },
    {
      assignedRestaurantId: null,
      restaurantId: restaurantId,
    },
  ],
};
```

### Что учитывается

- ✅ Количество заказов (сегодня/неделя/месяц/всего)
- ✅ Выручка (сегодня/неделя/месяц/всего)
- ✅ Последние заказы
- ✅ Популярные блюда
- ✅ График заказов

---

## 💡 Примеры использования

### Пример 1: Переназначение по геолокации

Клиент заказал через меню **Buffet №1**, но находится ближе к **Buffet №2**:

```bash
curl -X PUT https://oimoqr.onrender.com/api/orders/cmi708asf0001pp2aijjqlgzf/reassign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "assignedRestaurantId": "cmhwxo85m0002fw2biuazxxxx"
  }'
```

**Результат:**

- Заказ создан через меню Buffet №1 (`restaurantId`)
- Заказ назначен для выполнения Buffet №2 (`assignedRestaurantId`)
- Статистика Buffet №2 учтет этот заказ ✅
- Статистика Buffet №1 НЕ учтет этот заказ ❌

### Пример 2: Автоматическое распределение

```javascript
// Псевдокод для автоматического распределения заказов
async function autoAssignOrder(orderId, customerLat, customerLng) {
  // 1. Получить все филиалы сети
  const restaurants = await getRestaurantsByNetwork(networkId);

  // 2. Найти ближайший филиал
  const nearest = findNearestRestaurant(restaurants, customerLat, customerLng);

  // 3. Переназначить заказ
  await reassignOrder(orderId, nearest.id);
}
```

---

## 🧪 Тестирование

### 1. Создайте тестовый заказ

```bash
curl -X POST https://oimoqr.onrender.com/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": "cmhwxo85m0001fw2biuazbiun",
    "items": [{"id": "dish1", "quantity": 1, "price": 150}],
    "total": 150,
    "customerName": "Тест"
  }'
```

### 2. Переназначьте заказ

```bash
curl -X PUT https://oimoqr.onrender.com/api/orders/ORDER_ID/reassign \
  -H "Content-Type: application/json" \
  -d '{
    "assignedRestaurantId": "cmhwxo85m0002fw2biuazxxxx"
  }'
```

### 3. Проверьте статистику

- Откройте Dashboard для **Buffet №1** → Заказ НЕ должен отображаться
- Откройте Dashboard для **Buffet №2** → Заказ ДОЛЖЕН отображаться ✅

---

## ⚠️ Важные замечания

1. **`restaurantId` НЕ изменяется** - это исторический факт (через чье меню заказали)
2. **`assignedRestaurantId` определяет выполнение** - кто реально готовит/доставляет
3. **Статистика привязана к `assignedRestaurantId`** - выручка идет тому, кто выполняет
4. **При `assignedRestaurantId = null`** - заказ принадлежит оригинальному ресторану

---

## 🔮 Будущие улучшения

- [ ] Автоматическое переназначение по геолокации клиента
- [ ] История переназначений (audit log)
- [ ] UI для ручного переназначения в админ-панели
- [ ] Уведомления филиалам о новых переназначенных заказах
- [ ] Отчеты по межфилиальным заказам

---

## 📚 Связанные файлы

- `backend/src/controllers/orders.controller.js` - reassignOrder()
- `backend/src/controllers/analytics.controller.js` - orderFilter с OR
- `backend/src/routes/orders.routes.js` - PUT /:orderId/reassign
- `backend/prisma/schema.prisma` - assignedRestaurantId field
- `backend/migrations/add_assigned_restaurant_to_order.sql` - миграция

---

**Статус:** ✅ Готово к использованию  
**Версия:** 1.0  
**Дата:** 20.11.2025
