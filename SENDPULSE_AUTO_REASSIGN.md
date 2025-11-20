# 🤖 SendPulse - Автоматическое переназначение заказов

## ⚡ Самый простой способ (рекомендуется)

### 1️⃣ Когда клиент отправляет локацию

Клиент отправляет ссылку: `https://maps.google.com/?q=10.767750740051,106.69813537598`

### 2️⃣ Сохраните ссылку в переменную

В SendPulse сохраните полученную ссылку в переменную `{{location}}`

### 3️⃣ Настройте HTTP запрос

**Блок:** HTTP Request (POST)

**URL (используйте НОМЕР заказа - рекомендуется):**

```
https://oimoqr.onrender.com/api/orders/number/{{orderNumber}}/auto-reassign
```

Где `{{orderNumber}}` - это номер заказа БЕЗ решетки, например: `6036924859`

**Или URL (если у вас ID заказа):**

```
https://oimoqr.onrender.com/api/orders/{{orderId}}/auto-reassign
```

**Method:** `POST`

**Headers:**

```
Content-Type: application/json
```

**Body (ВАРИАНТ 1 - Просто отправьте ссылку):**

```json
{
  "location": "{{location}}"
}
```

**Body (ВАРИАНТ 2 - Если хотите извлечь координаты вручную):**

```json
{
  "latitude": {{latitude}},
  "longitude": {{longitude}}
}
```

### 4️⃣ Получите ответ

Система автоматически:

- ✅ Извлечёт координаты из ссылки
- ✅ Найдёт ближайший ресторан
- ✅ Переназначит заказ

Ответ:

```json
{
  "message": "Order auto-assigned to nearest restaurant",
  "assignedTo": {
    "name": "Buffet №2",
    "phone": "+77078958828",
    "distance": "0.85 км"
  },
  "inDeliveryZone": true
}
```

### 5️⃣ Отправьте подтверждение клиенту

```
✅ Ваш заказ принят!

📍 Готовить будет: {{assignedTo.name}}
📞 Телефон: {{assignedTo.phone}}
📏 Расстояние: {{assignedTo.distance}}
⏱ Время доставки: 30-40 минут
```

---

## 📋 Поддерживаемые форматы ссылок

Сервер автоматически распознаёт координаты в этих форматах:

✅ `https://maps.google.com/?q=10.767750740051,106.69813537598`  
✅ `https://www.google.com/maps?q=10.767750740051,106.69813537598`  
✅ `https://maps.google.com/@10.767750740051,106.69813537598,15z`  
✅ `https://www.google.com/maps/place/@10.767750740051,106.69813537598`

❌ Короткие ссылки `https://maps.app.goo.gl/...` НЕ поддерживаются

---

## 🔧 Пример сценария

```
┌─────────────────────────┐
│ Клиент создал заказ     │
│ Заказ ID: abc123        │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ Бот: "Отправьте вашу    │
│       локацию"          │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ Клиент отправляет       │
│ Google Maps ссылку      │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ Бот извлекает координаты│
│ lat: 10.767750740051    │
│ lng: 106.69813537598    │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ POST /auto-reassign     │
│ { lat, lng }            │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ Система находит         │
│ ближайший филиал        │
│ (Buffet №2, 0.85 км)    │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ Заказ переназначен!     │
│ assignedRestaurantId    │
│ = Buffet №2             │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ Бот отправляет          │
│ подтверждение клиенту   │
└─────────────────────────┘
```

---

## 📋 Требования

### В базе данных:

- [x] Поле `assignedRestaurantId` добавлено в таблицу `Order`
- [x] У всех ресторанов заполнены `latitude` и `longitude`
- [x] У всех ресторанов одинаковый `ownerId` (одна сеть)

### Проверьте миграцию:

```sql
-- Выполните в Supabase SQL Editor:
ALTER TABLE "Order" ADD COLUMN "assignedRestaurantId" TEXT;
CREATE INDEX IF NOT EXISTS "Order_assignedRestaurantId_idx" ON "Order" ("assignedRestaurantId");
```

---

## 🧪 Тестирование

### Тест 1: С Google Maps ссылкой (рекомендуется)

```bash
curl -X POST https://oimoqr.onrender.com/api/orders/cmi708asf0001pp2aijjqlgzf/auto-reassign \
  -H "Content-Type: application/json" \
  -d '{
    "location": "https://maps.google.com/?q=10.767750740051,106.69813537598"
  }'
```

### Тест 2: С координатами напрямую

```bash
curl -X POST https://oimoqr.onrender.com/api/orders/cmi708asf0001pp2aijjqlgzf/auto-reassign \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 10.767750740051,
    "longitude": 106.69813537598
  }'
```

### Тест 3: PowerShell (с ссылкой)

```powershell
$orderId = "cmi708asf0001pp2aijjqlgzf"
$body = @{
  location = "https://maps.google.com/?q=10.767750740051,106.69813537598"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://oimoqr.onrender.com/api/orders/$orderId/auto-reassign" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

### Тест 4: PowerShell (с координатами)

```powershell
$orderId = "cmi708asf0001pp2aijjqlgzf"
$body = @{
  latitude = 10.767750740051
  longitude = 106.69813537598
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://oimoqr.onrender.com/api/orders/$orderId/auto-reassign" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

### Ожидаемый результат:

```json
{
  "message": "Order auto-assigned to nearest restaurant",
  "assignedTo": {
    "name": "Buffet №2",
    "distance": "0.85 км"
  }
}
```

---

## ❓ FAQ

**Q: Что если у меня только один ресторан?**  
A: Заказ будет назначен на этот единственный ресторан.

**Q: Что если у ресторанов нет координат?**  
A: Вернется ошибка: `"No restaurants with geolocation found"`

**Q: Можно ли переназначить заказ на ресторан другой сети?**  
A: Нет, автоматически переназначаются только рестораны с тем же `ownerId`.

**Q: Сохраняются ли координаты клиента?**  
A: Да, в полях `deliveryLatitude` и `deliveryLongitude`.

**Q: Проверяется ли зона доставки?**  
A: Да, в ответе есть поле `inDeliveryZone: true/false`.

---

## 📞 Поддержка

Если возникли проблемы:

1. Проверьте, что миграция выполнена
2. Убедитесь, что у ресторанов заполнены координаты
3. Проверьте формат координат (должны быть числа)
4. Посмотрите логи сервера на Render

---

**Готово!** 🎉  
Теперь ваши заказы будут автоматически распределяться по ближайшим филиалам!
