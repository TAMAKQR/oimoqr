# 🚀 Production Configuration - OimoQR

## 📋 Текущая конфигурация

### ✅ Развернутые сервисы

| Сервис       | URL                        | Статус        |
| ------------ | -------------------------- | ----------------- |
| **Frontend** | https://oimoqr.com         | ✅ Vercel     |
| **Backend**  | https://backend.oimoqr.com | ✅ Render     |
| **Database** | Render (Frankfurt)         | ✅ PostgreSQL |
| **Storage**  | Cloudinary                 | ✅ Активен    |
| **Email**    | Gmail SMTP                 | ✅ Настроен   |

---

## 🔧 Backend Environment Variables (Render)

Текущие переменные окружения на Render:

```env
# Database (Render PostgreSQL)
DATABASE_URL=postgresql://user:password@host.render.com/db_name
# DIRECT_URL не требуется для Render, используется только DATABASE_URL

# JWT Authentication
JWT_SECRET=8cfcac3503c20bf5bb27281429925626b41d50fd95c13a40f67ffb3274a4a1e1d26f70325a11e2843e79e1364b5a25ffb6ecb65dfe62c5dd80eb8f04b83af93e
JWT_EXPIRES_IN=7d

# Server Configuration
NODE_ENV=production
PORT=10000
FRONTEND_URL=https://oimoqr.com

# File Upload (Cloudinary)
USE_CLOUDINARY=true
CLOUDINARY_CLOUD_NAME=dhtbg34kt
CLOUDINARY_API_KEY=REMOVED_CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET=REMOVED_CLOUDINARY_API_SECRET
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880

# Email (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=<YOUR_GMAIL_APP_PASSWORD>
SMTP_FROM="OimoQR <noreply@oimoqr.com>"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Trial Period
TRIAL_PERIOD_DAYS=7
```

---

## 🎨 Frontend Environment Variables (Vercel)

Переменные окружения на Vercel:

```env
VITE_API_URL=https://backend.oimoqr.com/api
```

**⚠️ Важно:** URL должен заканчиваться на `/api`!

---

## 🌐 DNS Configuration (Custom Domains)

### Настройки домена oimoqr.com

| Тип   | Имя     | Значение             | Сервис      |
| ----- | ------- | -------------------- | ----------- |
| A     | @       | Vercel IP            | Frontend    |
| CNAME | www     | cname.vercel-dns.com | Frontend    |
| CNAME | backend | oimoqr.onrender.com  | Backend API |

**Проверка DNS:**

```powershell
# Frontend
nslookup oimoqr.com

# Backend
nslookup backend.oimoqr.com
```

---

## 🔍 Health Checks

### Backend Health Check

```bash
curl https://backend.oimoqr.com/health
```

**Ожидаемый ответ:**

```json
{
  "status": "ok",
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

### Frontend Check

```bash
curl -I https://oimoqr.com
```

**Ожидаемый ответ:**

```
HTTP/2 200
```

---

## ⚠️ Важные особенности Render Free Tier

### Backend "засыпает" после 15 минут неактивности

**Симптомы:**

- Первый запрос возвращает 404 или таймаут
- Последующие запросы работают нормально
- Backend "просыпается" за ~30-60 секунд

**Решение - UptimeRobot (рекомендуется):**

1. Зарегистрируйтесь на https://uptimerobot.com (бесплатно)
2. Создайте новый монитор:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** OimoQR Backend
   - **URL:** `https://backend.oimoqr.com/health`
   - **Monitoring Interval:** 5 minutes
3. Сохраните

Теперь backend будет получать запрос каждые 5 минут и не будет засыпать!

**Альтернатива - Upgrade на Render:**

- $7/месяц - сервис не спит
- 512 MB RAM (вместо 512 MB shared)
- Быстрее отвечает

---

## 📊 Мониторинг и логи

### Render Logs

```
https://dashboard.render.com/web/[your-service-id]/logs
```

**Полезные команды для поиска:**

- Ошибки: фильтр "error"
- CORS: фильтр "cors"
- Database: фильтр "prisma"

### Vercel Logs

```
https://vercel.com/[your-username]/[project-name]/logs
```

### Supabase Logs

```
https://supabase.com/dashboard/project/[project-id]/logs/explorer
```

---

## 🔐 Security Checklist

- [x] JWT_SECRET - случайная строка 64+ символов
- [x] DATABASE_URL - не в публичном репозитории
- [x] CORS настроен только для oimoqr.com
- [x] Rate limiting активен (100 req/15 min)
- [x] HTTPS включен на всех сервисах
- [x] Email credentials в переменных окружения
- [x] Cloudinary credentials защищены

---

## 🚨 Troubleshooting

### 1. Backend возвращает 404

**Проверьте:**

```powershell
# Проверьте health endpoint
curl https://backend.oimoqr.com/health

# Если не отвечает - подождите 30-60 секунд (backend просыпается)
# Попробуйте снова
curl https://backend.oimoqr.com/health
```

### 2. CORS ошибки в браузере

**Проверьте в Render:**

- `FRONTEND_URL=https://oimoqr.com` (без `/` в конце!)

**Проверьте в Vercel:**

- `VITE_API_URL=https://backend.oimoqr.com/api` (с `/api` в конце!)

**Проверьте в консоли браузера (F12):**

```javascript
// Должно быть
fetch('https://backend.oimoqr.com/api/auth/login', ...)

// НЕ должно быть
fetch('https://oimoqr.onrender.com/api/auth/login', ...)
```

### 3. Изображения не загружаются

**Проверьте Cloudinary:**

```powershell
# Проверьте, что USE_CLOUDINARY=true в Render
# Проверьте credentials в Cloudinary Dashboard
```

**Проверьте логи Render:**

- Ищите "cloudinary" или "upload"
- Проверьте ошибки аутентификации

### 4. Email не отправляется

**Проверьте Gmail App Password:**

1. Перейдите на https://myaccount.google.com/apppasswords
2. Создайте новый App Password
3. Обновите `EMAIL_PASSWORD` в Render
4. Перезапустите сервис

**Проверьте логи:**

```
Ищите "email" или "smtp" в Render logs
```

### 5. База данных не подключается

**Проверьте на Render:**

1. Откройте https://dashboard.render.com
2. Перейдите к вашей базе данных PostgreSQL.
3. Убедитесь, что статус **"Available"**.
4. В разделе "Connections" скопируйте **"Internal Database URL"**.

**Проверьте переменные:**

Убедитесь, что в `DATABASE_URL` вашего backend-сервиса на Render вставлена именно **Internal Database URL**. External URL предназначен для подключения с вашего локального компьютера, а не для связи между сервисами внутри Render.

---

## 📈 Performance Optimization

### Текущие метрики

- **Backend Cold Start:** ~30-60 секунд (Render Free Tier)
- **Backend Warm Response:** ~200-500ms
- **Frontend Load Time:** ~1-2 секунды
- **Database Query:** ~50-200ms

### Рекомендации для улучшения

1. **UptimeRobot** - предотвращает cold starts (бесплатно)
2. **Render Paid Plan** ($7/мес) - нет cold starts
3. **Redis Caching** - кэширование меню (требует платный план)
4. **CDN** - Cloudflare для статики (бесплатно)
5. **Database Indexes** - оптимизация запросов

---

## 💰 Текущие расходы

| Сервис     | План | Стоимость    |
| ---------- | ---- | ------------ |
| Vercel     | Free | $0/месяц     |
| Render (Web Service) | Free | $0/месяц     |
| Render (PostgreSQL)  | Free | $0/месяц     |
| Cloudinary | Free | $0/месяц     |
| Gmail SMTP | Free | $0/месяц     |
| **Итого**  |      | **$0/месяц** |

### Лимиты бесплатных планов

**Vercel (Frontend):**

- ✅ 100 GB bandwidth/месяц
- ✅ Неограниченные деплои
- ✅ Автоматический SSL

**Render (Backend):**

- ✅ 750 часов/месяц (достаточно для 1 сервиса 24/7)
- ⚠️ Засыпает после 15 минут неактивности
- ⚠️ 512 MB RAM (shared)

**Render (Database):**

- ✅ 1 GB хранилища
- ⚠️ **База данных удаляется через 90 дней**, если не обновляться.
- ✅ Не засыпает.

**Cloudinary:**

- ✅ 25 GB хранилища
- ✅ 25 GB bandwidth/месяц
- ✅ Неограниченные трансформации

---

## 🔄 Deployment Workflow

### Обновление кода

```powershell
# 1. Внесите изменения в код
# 2. Закоммитьте
git add .
git commit -m "Update: описание изменений"

# 3. Отправьте на GitHub
git push origin main

# 4. Автоматический деплой
# - Vercel автоматически задеплоит frontend
# - Render автоматически задеплоит backend
```

### Откат изменений

**Vercel:**

1. Откройте https://vercel.com/dashboard
2. Deployments → найдите предыдущий деплой
3. Нажмите "..." → "Promote to Production"

**Render:**

1. Откройте https://dashboard.render.com
2. Events → найдите предыдущий деплой
3. Нажмите "Rollback"

---

## 📞 Support Contacts

**Render Support:**

- Dashboard: https://dashboard.render.com
- Docs: https://render.com/docs
- Status: https://status.render.com

---

## ✅ Quick Reference

### Важные URL

```
Frontend:       https://oimoqr.com
Backend:        https://backend.oimoqr.com
Health Check:   https://backend.oimoqr.com/health
API Endpoint:   https://backend.oimoqr.com/api

Render Dashboard:   https://dashboard.render.com
Vercel Dashboard:   https://vercel.com/dashboard
Cloudinary:         https://cloudinary.com/console
```

### Быстрые команды

```powershell
# Проверить backend
curl https://backend.oimoqr.com/health

# Проверить frontend
curl -I https://oimoqr.com

# Проверить DNS
nslookup backend.oimoqr.com

# Локальная разработка
npm run dev

# Деплой
git push origin main
```

---

**Последнее обновление:** 2025-01-15
**Статус:** ✅ Production Ready
