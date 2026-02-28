# 🎯 КРАТКОЕ РЕЗЮМЕ: Монетизация доставки

## Проблема
- SMS через Twilio стоят вам **$0.05-0.10**
- База клиентов - ценный актив, отдается **бесплатно**
- Нет разделения по функционалу

## Решение
**Модуль доставки = платный add-on за $19.99/мес**

### Тарифы (предложение):

| Тариф | Цена | Доставка | SMS | База |
|-------|------|----------|-----|------|
| STARTER | $9.99 | ❌ | - | - |
| + Delivery | +$19.99 | ✅ | 50 | 1,000 |
| PROFESSIONAL | $29.99 | ❌ | - | - |
| + Delivery | +$19.99 | ✅ | 50 | 3,000 |
| BUSINESS | $79.99 | ✅ ВКЛ | ♾️ | ♾️ |

### SMS Биллинг (главная прибыль):
- 50 SMS включено
- Далее **$0.10 за SMS**
- Ваша маржа: **100%**

## 📋 Что уже сделано (только что):

✅ **Обновлена Prisma schema:**
```prisma
model PricingTier {
  includesDelivery  Boolean
  includedSmsCount  Int      // 50, -1 (безлимит)
  smsOveragePrice   Float    // $0.10
  maxCustomers      Int?     // 1000, NULL
}

model Subscription {
  addons            String[]  // ["delivery"]
  smsUsedThisMonth  Int
  smsOverageCharges Float
}
```

✅ **Создан middleware** (`backend/src/middleware/subscriptionLimits.js`):
- `checkDeliveryAccess` - проверка доступа к доставке
- `checkSmsLimit` - проверка лимита SMS + расчет overage
- `checkCustomerLimit` - проверка лимита базы клиентов
- `getSubscriptionUsage` - дашборд использования

✅ **SQL миграция готова** (`backend/prisma/migrations/add_delivery_addon_and_limits.sql`)

---

## 🚀 Что нужно сделать (3 дня работы):

### День 1: База данных и middleware
- [ ] Запустить миграцию SQL
- [ ] Сгенерировать Prisma Client: `npx prisma generate`
- [ ] Обновить существующие тарифы в БД

### День 2: Интеграция в код
- [ ] Добавить middleware в `/customers/whatsapp/send-code`:
```javascript
// В backend/src/routes/customer.routes.js
import { checkSmsLimit } from '../middleware/subscriptionLimits.js';

router.post('/whatsapp/send-code', 
  checkSmsLimit,  // <- ДОБАВИТЬ
  sendWhatsAppCode
);
```

- [ ] Обновить `sendWhatsAppCode` для учета SMS:
```javascript
// После успешной отправки SMS
if (req.shouldIncrementSmsCounter) {
  await incrementSmsCounter(req.subscription.id, req.smsCharge);
}
```

- [ ] Добавить проверку доставки в настройках ресторана
- [ ] Создать endpoint `/api/subscriptions/:restaurantId/usage` (уже есть в middleware)

### День 3: Frontend и тестирование
- [ ] Страница Add-ons (покупка модуля доставки)
- [ ] Dashboard использования SMS (график, лимиты)
- [ ] Предупреждения при приближении к лимиту
- [ ] Тестирование на dev-окружении

---

## 💰 Экономика (пример с 1 рестораном):

**Доходы:**
- Тариф PROFESSIONAL: $29.99
- Add-on Delivery: $19.99
- SMS overage (100 SMS сверх лимита): $10.00
- **Итого: $59.98/мес**

**Расходы:**
- Hosting: $7
- Database: $25
- SMS (150 SMS × $0.05): $7.50
- **Итого: $39.50/мес**

**Прибыль: $20.48/мес с ОДНОГО ресторана**

При 50 ресторанах = **$1,024/мес = $12,288/год** 🎯

---

## 🎁 Дополнительные идеи (быстрые wins):

### 1. Программа рефералов
```javascript
// Ресторан приглашает друга
// → Оба получают месяц бесплатно
// → Виральный рост
```

### 2. Годовая подписка со скидкой
```
$29.99 × 12 = $359.88
Годовая цена: $299/год (скидка 17%)
→ Предоплата, меньше churn
```

### 3. Add-on "Analytics PRO" - $14.99/мес
- A/B тесты баннеров
- Пиковые часы
- Популярные блюда
- ROI по категориям

### 4. Add-on "Customer Marketing" - $19.99/мес
- Email рассылки (безлимит)
- SMS рассылки (100/мес)
- Программа лояльности
- Персональные промокоды

---

## ⚡ Приоритет #1 (начать СЕГОДНЯ):

**Запустить SMS биллинг:**

1. Применить миграцию:
```bash
cd backend
npx prisma db push
npx prisma generate
```

2. Обновить routes (`backend/src/routes/customer.routes.js`):
```javascript
import { checkSmsLimit } from '../middleware/subscriptionLimits.js';

router.post('/whatsapp/send-code', checkSmsLimit, sendWhatsAppCode);
router.post('/customers/register', checkCustomerLimit, registerCustomer);
```

3. Обновить `customerAuth.controller.js`:
```javascript
// В sendWhatsAppCode после успешной отправки:
import { incrementSmsCounter } from '../middleware/subscriptionLimits.js';

// После whatsappService.sendVerificationCode()
if (req.subscription && req.shouldIncrementSms Counter) {
  await incrementSmsCounter(req.subscription.id, req.smsCharge);
  
  // Логируем для аналитики
  console.log(`📊 SMS sent. Charge: $${req.smsCharge}`);
}
```

4. Создать API endpoint для dashboard:
```javascript
// backend/src/routes/subscription.routes.js
import { getSubscriptionUsage } from '../middleware/subscriptionLimits.js';

router.get('/:restaurantId/usage', authenticate, getSubscriptionUsage);
```

---

## 📊 Метрики для отслеживания:

1. **SMS Usage:**
   - Средний use per restaurant/месяц
   - % ресторанов с overage
   - Revenue from overage

2. **Conversion:**
   - Trial → STARTER
   - STARTER → STARTER + Delivery
   - STARTER → PROFESSIONAL

3. **Churn:**
   - Monthly churn rate
   - Причины отмены

---

## 🎬 Next Steps (выбери сам):

**Вариант A: Быстрый старт (рекомендую)**
1. Запусти миграцию прямо сейчас
2. Добавь middleware в routes
3. Протестируй на 1  ресторане
4. Если работает - масштабируй

**Вариант B: Полный запуск**
1. Сначала создай все тарифы
2. Добавь страницу add-ons во frontend
3. Интегрируй Stripe для платежей
4. Запусти для всех

**Вариант C: MVP тест**
1. Включи SMS биллинг для 5 ресторанов вручную
2. Собери фидбек
3. Посчитай реальную экономику
4. Оптимизируй цены

---

## ❓ Мои рекомендации:

**Начни с варианта A (быстрый старт):**
- ✅ Минимальный риск
- ✅ Быстрая валидация
- ✅ Реальные данные за неделю

**Сейчас главное:**
1. **Остановить утечку денег** на SMS
2. **Начать монетизировать** базу клиентов
3. **Собрать данные** для оптимизации цен

Вопросы? Готов помочь с реализацией! 🚀

---

**Документация:**
- Подробное предложение: `docs/MONETIZATION_PROPOSAL.md`
- SQL миграция: `backend/prisma/migrations/add_delivery_addon_and_limits.sql`
- Middleware: `backend/src/middleware/subscriptionLimits.js`
