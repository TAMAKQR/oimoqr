# 🚀 Production Cheatsheet - OimoQR

> Быстрая шпаргалка для работы с production

---

## 🌐 URLs

```
Frontend:     https://oimoqr.com
Backend:      https://backend.oimoqr.com
API:          https://backend.oimoqr.com/api
Health:       https://backend.oimoqr.com/health
```

---

## 🔧 Dashboards

| Сервис      | URL                               | Логин  |
| ----------- | --------------------------------- | ------ |
| Render      | https://dashboard.render.com      | GitHub |
| Vercel      | https://vercel.com/dashboard      | GitHub |
| Supabase    | https://supabase.com/dashboard    | GitHub |
| Cloudinary  | https://cloudinary.com/console    | Email  |
| UptimeRobot | https://uptimerobot.com/dashboard | Email  |

---

## ⚡ Быстрые команды

### Проверка работоспособности

```powershell
# Backend health check
curl https://backend.oimoqr.com/health

# Frontend check
curl -I https://oimoqr.com

# DNS check
nslookup backend.oimoqr.com
```

### Деплой

```powershell
# Автоматический деплой
git add .
git commit -m "Update: описание"
git push origin main

# Vercel: ~2 минуты
# Render: ~3-5 минут
```

### Локальная разработка

```powershell
# Frontend
Set-Location "d:\QR MENU\frontend"
npm run dev

# Backend
Set-Location "d:\QR MENU\backend"
npm run dev

# Оба сразу (из корня)
Set-Location "d:\QR MENU"
npm run dev
```

---

## 🔐 Environment Variables

### Render (Backend)

```env
DATABASE_URL=postgresql://postgres.xxx:password@xxx.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.xxx:password@xxx.pooler.supabase.com:5432/postgres
JWT_SECRET=8cfcac3503c20bf5bb27281429925626b41d50fd95c13a40f67ffb3274a4a1e1d26f70325a11e2843e79e1364b5a25ffb6ecb65dfe62c5dd80eb8f04b83af93e
FRONTEND_URL=https://oimoqr.com
USE_CLOUDINARY=true
CLOUDINARY_CLOUD_NAME=dhtbg34kt
CLOUDINARY_API_KEY=REMOVED_CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET=REMOVED_CLOUDINARY_API_SECRET
EMAIL_USER=yadjekvorobei@gmail.com
EMAIL_PASSWORD=tflgfblrgijvfutc
NODE_ENV=production
```

### Vercel (Frontend)

```env
VITE_API_URL=https://backend.oimoqr.com/api
```

---

## 🚨 Troubleshooting

### Backend не отвечает

```powershell
# 1. Проверьте health
curl https://backend.oimoqr.com/health

# 2. Подождите 30-60 сек (просыпается)

# 3. Проверьте логи
# Render Dashboard → Logs

# 4. Проверьте статус
# https://status.render.com
```

### CORS ошибки

```
Render:  FRONTEND_URL=https://oimoqr.com (без /)
Vercel:  VITE_API_URL=https://backend.oimoqr.com/api (с /api)
```

### Изображения не загружаются

```
Проверьте в Render:
USE_CLOUDINARY=true
CLOUDINARY_CLOUD_NAME=dhtbg34kt
CLOUDINARY_API_KEY=REMOVED_CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET=REMOVED_CLOUDINARY_API_SECRET
```

### Email не отправляется

```
Проверьте в Render:
EMAIL_USER=yadjekvorobei@gmail.com
EMAIL_PASSWORD=tflgfblrgijvfutc

Создайте новый App Password:
https://myaccount.google.com/apppasswords
```

---

## 📊 Мониторинг

### UptimeRobot (обязательно!)

```
URL: https://uptimerobot.com
Monitor: https://backend.oimoqr.com/health
Interval: Every 5 minutes
```

**Зачем:** Backend не будет засыпать

### Логи

```
Render:    https://dashboard.render.com → Logs
Vercel:    https://vercel.com/dashboard → Logs
Supabase:  https://supabase.com/dashboard → Logs
```

---

## 💰 Лимиты Free Tier

| Сервис     | Лимит            | Текущее |
| ---------- | ---------------- | ------- |
| Render     | 750 часов/мес    | ✅ OK   |
| Vercel     | 100 GB bandwidth | ✅ OK   |
| Supabase   | 500 MB storage   | ✅ OK   |
| Cloudinary | 25 GB storage    | ✅ OK   |

---

## 🔄 Откат изменений

### Vercel

```
1. Dashboard → Deployments
2. Найти предыдущий деплой
3. ... → Promote to Production
```

### Render

```
1. Dashboard → Events
2. Найти предыдущий деплой
3. Rollback
```

---

## 📞 Support

| Сервис   | Status Page                   |
| -------- | ----------------------------- |
| Render   | https://status.render.com     |
| Vercel   | https://www.vercel-status.com |
| Supabase | https://status.supabase.com   |

---

## 📚 Документация

- **[NEXT_STEPS.md](./NEXT_STEPS.md)** - Что делать дальше
- **[QUICK_START_PRODUCTION.md](./docs/deployment/QUICK_START_PRODUCTION.md)** - Быстрый старт
- **[PRODUCTION_CONFIG.md](./docs/deployment/PRODUCTION_CONFIG.md)** - Полная конфигурация
- **[UPTIMEROBOT_SETUP.md](./docs/deployment/UPTIMEROBOT_SETUP.md)** - Настройка мониторинга

---

## ✅ Daily Checklist

- [ ] https://oimoqr.com - работает?
- [ ] https://backend.oimoqr.com/health - отвечает?
- [ ] UptimeRobot - статус "Up"?
- [ ] Email - нет уведомлений о проблемах?

---

**Последнее обновление:** 2025-01-15  
**Версия:** 1.0.0
