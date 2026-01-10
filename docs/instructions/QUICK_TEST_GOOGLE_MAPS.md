# ⚡ Быстрый тест - Google Maps ссылка

## Самый простой способ

Просто отправьте Google Maps ссылку в POST запросе:

```bash
curl -X POST https://oimoqr.onrender.com/api/orders/cmi708asf0001pp2aijjqlgzf/auto-reassign \
  -H "Content-Type: application/json" \
  -d '{
    "location": "https://maps.google.com/?q=10.767750740051,106.69813537598"
  }'
```

## PowerShell

```powershell
$orderId = "cmi708asf0001pp2aijjqlgzf"
$location = "https://maps.google.com/?q=10.767750740051,106.69813537598"

$body = @{
  location = $location
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://oimoqr.onrender.com/api/orders/$orderId/auto-reassign" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

## SendPulse настройка

**URL:**

```
https://oimoqr.onrender.com/api/orders/{{orderId}}/auto-reassign
```

**Method:** `POST`

**Body:**

```json
{
  "location": "{{location}}"
}
```

Где `{{location}}` - это переменная, в которую SendPulse сохранил Google Maps ссылку от клиента.

---

## Что происходит?

1. 🔗 Сервер получает ссылку `https://maps.google.com/?q=10.767750740051,106.69813537598`
2. 🔍 Автоматически извлекает координаты: `lat: 10.767750740051, lng: 106.69813537598`
3. 📍 Находит ближайший ресторан из той же сети
4. ✅ Переназначает заказ на этот ресторан
5. 📤 Возвращает информацию о назначенном филиале

---

## Поддерживаемые форматы

✅ `https://maps.google.com/?q=10.767,106.698`  
✅ `https://www.google.com/maps?q=10.767,106.698`  
✅ `https://maps.google.com/@10.767,106.698,15z`  
✅ `https://www.google.com/maps/place/@10.767,106.698`

❌ Короткие ссылки `https://goo.gl/...` **НЕ** поддерживаются

---

## Ответ сервера

```json
{
  "message": "Order auto-assigned to nearest restaurant",
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

---

**Готово!** 🎉 Теперь не нужно извлекать координаты вручную - просто передайте ссылку!
