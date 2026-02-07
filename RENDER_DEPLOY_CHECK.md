# 🚀 Проверка деплоя на Render

## Шаги:

### 1. Зайдите в Render Dashboard
https://dashboard.render.com

### 2. Найдите ваш backend сервис
Обычно называется `oimoqr-backend` или `oimoqr`

### 3. Проверьте статус деплоя

Вы должны увидеть:
- 🟢 **Deploy in Progress** (идет деплой)
- или 🟢 **Live** (уже задеплоено)
- или ⏸️ **Sleeping** (спит - нужно разбудить)

### 4. Если деплой еще не начался:

**Вариант A: Включить Auto-Deploy**
1. Settings → Build & Deploy
2. Включите **Auto-Deploy: Yes**
3. Сохраните

**Вариант B: Manual Deploy**
1. Нажмите **Manual Deploy** (вверху справа)
2. Выберите **Deploy latest commit**
3. Или **Clear build cache & deploy** (если были проблемы)

### 5. Подождите 2-3 минуты

Render покажет логи деплоя:
```
==> Cloning from https://github.com/TAMAKQR/oimoqr...
==> Building...
==> Running 'npm install'...
==> Running 'npm start'...
==> Your service is live! 🎉
```

### 6. Проверьте health endpoint

Откройте: https://oimoqr.onrender.com/health

Должно быть:
```json
{"status":"ok","timestamp":"2026-02-07T..."}
```

### 7. Обновите frontend

Откройте: https://www.oimoqr.com/dashboard

Нажмите **Ctrl+Shift+R** (hard refresh)

✅ **Ошибки CORS должны исчезнуть!**

---

## ⚠️ Если все еще не работает:

### Проверьте переменные окружения на Render:

В Render Dashboard → ваш сервис → Environment:

```
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=...
FRONTEND_URL=https://oimoqr.com
```

**Важно:** `FRONTEND_URL` должен быть БЕЗ `www`!

---

## 🐛 Free Tier засыпает

Если используете **Free tier Render**:
- Сервис засыпает через **15 минут** неактивности
- Первый запрос после сна занимает **30-60 секунд** (cold start)
- Решение: upgradeнуться на **Paid plan** ($7/мес) или использовать **UptimeRobot** для пинга

### UptimeRobot (бесплатный keepalive):
1. Зарегистрируйтесь на https://uptimerobot.com
2. Add New Monitor:
   - Type: HTTP(s)
   - URL: https://oimoqr.onrender.com/health
   - Interval: 5 minutes
3. Сохраните

Теперь бэкенд не будет засыпать! 🎉
