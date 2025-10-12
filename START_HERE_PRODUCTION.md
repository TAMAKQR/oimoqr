# 🚀 START HERE - Production Guide

> **Ваше приложение OimoQR успешно развернуто!**  
> Начните с этого документа для быстрого старта.

---

## ✅ Текущий статус

**Ваше приложение LIVE и работает:**

- ✅ **Frontend:** https://oimoqr.com
- ✅ **Backend:** https://backend.oimoqr.com
- ✅ **Стоимость:** $0/месяц

**Все сервисы настроены:**

- ✅ Vercel (Frontend)
- ✅ Render (Backend)
- ✅ Supabase (Database)
- ✅ Cloudinary (Images)
- ✅ Gmail SMTP (Email)

---

## 🚨 ВАЖНО: Сделайте это СЕЙЧАС! (5 минут)

### Настройте UptimeRobot

**Зачем:** Ваш backend "засыпает" после 15 минут неактивности (это особенность бесплатного плана Render). UptimeRobot будет "будить" его каждые 5 минут.

**Как:**

1. Откройте https://uptimerobot.com
2. Нажмите **"Sign Up Free"**
3. Зарегистрируйтесь (через email или Google)
4. Нажмите **"+ Add New Monitor"**
5. Заполните:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** OimoQR Backend
   - **URL:** `https://backend.oimoqr.com/health`
   - **Monitoring Interval:** Every 5 minutes
6. Нажмите **"Create Monitor"**

✅ **Готово!** Теперь ваш backend будет всегда быстро отвечать.

📖 **Подробная инструкция:** [docs/deployment/UPTIMEROBOT_SETUP.md](./docs/deployment/UPTIMEROBOT_SETUP.md)

---

## 📋 Что делать дальше?

### 1. Проверьте работу сайта (5 минут)

Откройте https://oimoqr.com и проверьте:

- [ ] Сайт загружается
- [ ] Можно зарегистрироваться
- [ ] Можно войти
- [ ] Можно создать ресторан
- [ ] Можно добавить блюдо
- [ ] Можно загрузить изображение

**Если что-то не работает:**

- Откройте консоль браузера (F12)
- Проверьте ошибки
- См. [Troubleshooting](#troubleshooting) ниже

### 2. Создайте администратора (5 минут)

**Локально:**

```powershell
# Установите DATABASE_URL
$env:DATABASE_URL="postgresql://postgres.ewdctxszewboasgikpce:qrmenu123@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Перейдите в backend
Set-Location "d:\QR MENU\backend"

# Создайте админа
npm run create-admin admin@oimoqr.com YourSecurePassword123 "Admin Name"
```

### 3. Изучите документацию (10 минут)

**Быстрый старт:**

- ⚡ [PRODUCTION_CHEATSHEET.md](./PRODUCTION_CHEATSHEET.md) - Шпаргалка (2 минуты)
- 🎯 [NEXT_STEPS.md](./NEXT_STEPS.md) - Подробный план действий (5 минут)

**Подробная информация:**

- 🚀 [QUICK_START_PRODUCTION.md](./docs/deployment/QUICK_START_PRODUCTION.md) - Работа с production
- 🔧 [PRODUCTION_CONFIG.md](./docs/deployment/PRODUCTION_CONFIG.md) - Полная конфигурация
- 📊 [PRODUCTION_SUMMARY.md](./PRODUCTION_SUMMARY.md) - Полная сводка
- 🏗️ [ARCHITECTURE.md](./docs/deployment/ARCHITECTURE.md) - Архитектура системы

---

## 🔍 Быстрая проверка

### Проверьте Backend

```powershell
curl https://backend.oimoqr.com/health
```

**Ожидаемый ответ:**

```json
{ "status": "ok", "timestamp": "2025-01-15T12:00:00.000Z" }
```

**Если не отвечает:**

- Подождите 30-60 секунд (backend просыпается)
- Попробуйте снова
- Настройте UptimeRobot (см. выше)

### Проверьте Frontend

Откройте в браузере:

```
https://oimoqr.com
```

Должна загрузиться главная страница.

---

## 🔧 Dashboards

Сохраните эти ссылки в закладки:

| Сервис          | URL                               | Для чего                           |
| --------------- | --------------------------------- | ---------------------------------- |
| **Render**      | https://dashboard.render.com      | Логи backend, переменные окружения |
| **Vercel**      | https://vercel.com/dashboard      | Логи frontend, деплои              |
| **Supabase**    | https://supabase.com/dashboard    | База данных, SQL editor            |
| **Cloudinary**  | https://cloudinary.com/console    | Загруженные изображения            |
| **UptimeRobot** | https://uptimerobot.com/dashboard | Мониторинг uptime                  |

---

## 🚨 Troubleshooting

### Backend не отвечает (404 или таймаут)

**Причина:** Backend спит (Render Free Tier)

**Решение:**

1. Подождите 30-60 секунд
2. Попробуйте снова
3. Настройте UptimeRobot (см. выше)

### CORS ошибки в консоли браузера

**Проверьте переменные окружения:**

**В Render:**

```env
FRONTEND_URL=https://oimoqr.com
```

(без `/` в конце!)

**В Vercel:**

```env
VITE_API_URL=https://backend.oimoqr.com/api
```

(с `/api` в конце!)

**Как изменить:**

1. Render: Dashboard → Environment → Edit
2. Vercel: Settings → Environment Variables → Edit
3. Сохраните и перезапустите/redeploy

### Изображения не загружаются

**Проверьте Cloudinary credentials в Render:**

```env
USE_CLOUDINARY=true
CLOUDINARY_CLOUD_NAME=dhtbg34kt
CLOUDINARY_API_KEY=REMOVED_CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET=REMOVED_CLOUDINARY_API_SECRET
```

**Проверьте логи:**

1. Render Dashboard → Logs
2. Ищите "cloudinary" или "upload"

### Email не отправляется

**Проверьте Gmail credentials в Render:**

```env
EMAIL_USER=yadjekvorobei@gmail.com
EMAIL_PASSWORD=tflgfblrgijvfutc
```

**Создайте новый App Password:**

1. https://myaccount.google.com/apppasswords
2. Создайте новый
3. Обновите `EMAIL_PASSWORD` в Render

---

## 📝 Обновление кода

### Автоматический деплой

```powershell
# 1. Внесите изменения в код
# 2. Закоммитьте
git add .
git commit -m "Update: описание изменений"

# 3. Отправьте на GitHub
git push origin main

# 4. Автоматический деплой
# ✅ Vercel задеплоит frontend (~2 минуты)
# ✅ Render задеплоит backend (~3-5 минут)
```

### Проверка деплоя

**Vercel:**

1. https://vercel.com/dashboard
2. Deployments → смотрите статус
3. Когда "Ready" - готово

**Render:**

1. https://dashboard.render.com
2. Events → смотрите статус
3. Когда "Live" - готово

---

## 💰 Текущие расходы

```
Vercel:      $0/месяц (Free)
Render:      $0/месяц (Free)
Supabase:    $0/месяц (Free)
Cloudinary:  $0/месяц (Free)
UptimeRobot: $0/месяц (Free)
────────────────────────────
Итого:       $0/месяц
```

**Лимиты Free tier:**

- Vercel: 100 GB bandwidth/месяц
- Render: Backend спит после 15 минут
- Supabase: 500 MB storage
- Cloudinary: 25 GB storage

**Когда нужен upgrade:**

- Render ($7/мес): Если backend часто спит даже с UptimeRobot
- Vercel ($20/мес): Если bandwidth >100 GB/месяц
- Supabase ($25/мес): Если storage >500 MB

---

## 📚 Полезные документы

### Быстрый старт (читайте в первую очередь)

1. **[PRODUCTION_CHEATSHEET.md](./PRODUCTION_CHEATSHEET.md)** (2 минуты)

   - Быстрая шпаргалка с командами и URL

2. **[NEXT_STEPS.md](./NEXT_STEPS.md)** (5 минут)

   - Подробный план действий

3. **[UPTIMEROBOT_SETUP.md](./docs/deployment/UPTIMEROBOT_SETUP.md)** (5 минут)
   - Настройка мониторинга (КРИТИЧНО!)

### Подробная информация (читайте по необходимости)

4. **[QUICK_START_PRODUCTION.md](./docs/deployment/QUICK_START_PRODUCTION.md)**

   - Работа с production окружением

5. **[PRODUCTION_CONFIG.md](./docs/deployment/PRODUCTION_CONFIG.md)**

   - Полная конфигурация всех сервисов

6. **[PRODUCTION_SUMMARY.md](./PRODUCTION_SUMMARY.md)**

   - Полная сводка по deployment

7. **[ARCHITECTURE.md](./docs/deployment/ARCHITECTURE.md)**
   - Архитектура системы

### Deployment (для справки)

8. **[DEPLOYMENT_GUIDE.md](./docs/deployment/DEPLOYMENT_GUIDE.md)**

   - Полное руководство по деплою

9. **[DEPLOYMENT_SUMMARY.md](./docs/deployment/DEPLOYMENT_SUMMARY.md)**
   - Сводка по деплою

---

## ✅ Checklist для сегодня

### Критично (сделайте сейчас!)

- [ ] Настроить UptimeRobot (5 минут)
- [ ] Проверить работу сайта (5 минут)
- [ ] Создать администратора (5 минут)

### Важно (на этой неделе)

- [ ] Прочитать [NEXT_STEPS.md](./NEXT_STEPS.md) (5 минут)
- [ ] Настроить backup базы данных (10 минут)
- [ ] Добавить Sentry для мониторинга ошибок (15 минут)
- [ ] Включить 2FA на всех аккаунтах (10 минут)

### Опционально (в ближайший месяц)

- [ ] Настроить Google Analytics (10 минут)
- [ ] Добавить Cloudflare CDN (15 минут)
- [ ] Оптимизировать изображения (10 минут)

---

## 🎉 Поздравляем!

**Ваше приложение OimoQR успешно развернуто в production!**

**Текущий статус:**

- ✅ Frontend: https://oimoqr.com
- ✅ Backend: https://backend.oimoqr.com
- ✅ Стоимость: $0/месяц
- ⏳ Требуется: UptimeRobot (5 минут)

**Следующий шаг:**

1. Настройте UptimeRobot (см. выше)
2. Прочитайте [NEXT_STEPS.md](./NEXT_STEPS.md)
3. Начните использовать приложение!

---

## 📞 Нужна помощь?

**Проверьте документацию:**

- [PRODUCTION_CHEATSHEET.md](./PRODUCTION_CHEATSHEET.md) - Быстрые команды
- [QUICK_START_PRODUCTION.md](./docs/deployment/QUICK_START_PRODUCTION.md) - Troubleshooting

**Проверьте логи:**

- Render: https://dashboard.render.com → Logs
- Vercel: https://vercel.com/dashboard → Logs
- Консоль браузера: F12

**Проверьте статус сервисов:**

- https://status.render.com
- https://www.vercel-status.com
- https://status.supabase.com

---

**Последнее обновление:** 2025-01-15  
**Версия:** 1.0.0  
**Статус:** 🚀 Live in Production

**Начните здесь:** Настройте UptimeRobot (5 минут) → [UPTIMEROBOT_SETUP.md](./docs/deployment/UPTIMEROBOT_SETUP.md)
