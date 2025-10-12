# 🚀 Руководство по деплою QR Menu SaaS

## Обзор

Это руководство поможет вам развернуть QR Menu SaaS в production окружении.

## Рекомендуемая архитектура

```
┌─────────────────┐
│   Cloudflare    │  ← DNS + CDN + SSL
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│Vercel │ │Render │  ← Frontend + Backend
└───┬───┘ └──┬────┘
    │        │
    │    ┌───▼────────┐
    │    │ Supabase   │  ← PostgreSQL
    │    └────────────┘
    │
    │    ┌────────────┐
    └────►Cloudinary  │  ← Image Storage
         └────────────┘
```

## 1. Подготовка к деплою

### Checklist перед деплоем:

- [ ] Все тесты проходят
- [ ] Нет console.log в production коде
- [ ] Все секреты вынесены в переменные окружения
- [ ] Настроен .gitignore
- [ ] Создан production branch
- [ ] Документация обновлена

## 2. База данных (Supabase)

### Шаг 1: Создание проекта

1. Зарегистрируйтесь на https://supabase.com
2. Создайте новый проект
3. Выберите регион (ближайший к вашим пользователям)
4. Сохраните Database Password

### Шаг 2: Получение Connection String

1. Перейдите в Settings → Database
2. Скопируйте Connection String (URI)
3. Замените `[YOUR-PASSWORD]` на ваш пароль

Пример:

```
postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
```

### Шаг 3: Миграция базы данных

```powershell
# Установите DATABASE_URL
$env:DATABASE_URL="postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres"

# Запустите миграции
Set-Location backend
npx prisma migrate deploy
npx prisma generate
```

### Шаг 4: Создание администратора

```powershell
npm run create-admin admin@yourdomain.com SecurePassword123 "Admin Name"
```

## 3. Хранилище изображений (Cloudinary)

### Шаг 1: Регистрация

1. Зарегистрируйтесь на https://cloudinary.com
2. Получите бесплатный план (25GB storage, 25GB bandwidth)

### Шаг 2: Получение credentials

1. Перейдите в Dashboard
2. Скопируйте:
   - Cloud Name
   - API Key
   - API Secret

### Шаг 3: Интеграция (опционально)

Для интеграции Cloudinary нужно обновить код загрузки файлов:

```javascript
// backend/src/middleware/upload.js
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "qr-menu",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
  },
});
```

## 4. Backend (Render)

### Шаг 1: Создание Web Service

1. Зарегистрируйтесь на https://render.com
2. Нажмите "New +" → "Web Service"
3. Подключите GitHub репозиторий
4. Настройте:
   - **Name:** qr-menu-backend
   - **Region:** Frankfurt (EU) или ближайший
   - **Branch:** main
   - **Root Directory:** backend
   - **Runtime:** Node
   - **Build Command:** `npm install && npx prisma generate`
   - **Start Command:** `npm start`
   - **Plan:** Free (для начала)

### Шаг 2: Переменные окружения

Добавьте в Environment Variables:

```env
DATABASE_URL=postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long
JWT_EXPIRES_IN=7d
PORT=5000
NODE_ENV=production

# SMTP (Gmail example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=QR Menu <noreply@yourdomain.com>

# Frontend URL
FRONTEND_URL=https://your-frontend.vercel.app

# File Upload (если не используете Cloudinary)
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880

# Trial Period
TRIAL_PERIOD_DAYS=7

# Cloudinary (опционально)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### Шаг 3: Деплой

1. Нажмите "Create Web Service"
2. Дождитесь завершения деплоя
3. Скопируйте URL (например: https://qr-menu-backend.onrender.com)

### Шаг 4: Проверка

```bash
curl https://qr-menu-backend.onrender.com/health
```

Должен вернуть:

```json
{ "status": "ok", "timestamp": "2024-01-01T00:00:00.000Z" }
```

## 5. Frontend (Vercel)

### Шаг 1: Создание проекта

1. Зарегистрируйтесь на https://vercel.com
2. Нажмите "Add New..." → "Project"
3. Import GitHub репозиторий
4. Настройте:
   - **Framework Preset:** Vite
   - **Root Directory:** frontend
   - **Build Command:** `npm run build`
   - **Output Directory:** dist

### Шаг 2: Переменные окружения

Добавьте в Environment Variables:

```env
VITE_API_URL=https://qr-menu-backend.onrender.com/api
```

### Шаг 3: Деплой

1. Нажмите "Deploy"
2. Дождитесь завершения
3. Получите URL (например: https://qr-menu.vercel.app)

### Шаг 4: Обновление CORS

Обновите `FRONTEND_URL` в Render:

```env
FRONTEND_URL=https://qr-menu.vercel.app
```

## 6. Настройка домена

### Для Frontend (Vercel):

1. Перейдите в Settings → Domains
2. Добавьте свой домен (например: app.yourdomain.com)
3. Настройте DNS записи у вашего регистратора:
   ```
   Type: CNAME
   Name: app
   Value: cname.vercel-dns.com
   ```

### Для Backend (Render):

1. Перейдите в Settings → Custom Domain
2. Добавьте домен (например: api.yourdomain.com)
3. Настройте DNS записи:
   ```
   Type: CNAME
   Name: api
   Value: your-service.onrender.com
   ```

### SSL сертификаты

Vercel и Render автоматически выпускают SSL сертификаты через Let's Encrypt.

## 7. Email настройка (Gmail)

### Шаг 1: Включить 2FA

1. Перейдите в Google Account → Security
2. Включите 2-Step Verification

### Шаг 2: Создать App Password

1. Перейдите в https://myaccount.google.com/apppasswords
2. Выберите "Mail" и "Other"
3. Введите "QR Menu"
4. Скопируйте сгенерированный пароль

### Шаг 3: Обновить переменные

```env
SMTP_USER=your-email@gmail.com
SMTP_PASS=generated-app-password
```

## 8. Мониторинг и логи

### Render Logs

1. Перейдите в Dashboard → Logs
2. Настройте Log Streams для отправки в внешние сервисы

### Sentry (Error Tracking)

1. Зарегистрируйтесь на https://sentry.io
2. Создайте проект для Node.js
3. Установите SDK:

```powershell
npm install @sentry/node --workspace=backend
```

4. Добавьте в server.js:

```javascript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

### Uptime Monitoring

Используйте:

- UptimeRobot (бесплатно)
- Pingdom
- StatusCake

## 9. Backup базы данных

### Автоматический backup (Supabase)

Supabase автоматически создает backup каждый день.

### Ручной backup

```powershell
# Экспорт
pg_dump $DATABASE_URL > backup.sql

# Импорт
psql $DATABASE_URL < backup.sql
```

## 10. CI/CD (GitHub Actions)

Создайте `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "18"
      - name: Deploy to Render
        run: |
          curl -X POST ${{ secrets.RENDER_DEPLOY_HOOK }}

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Vercel
        run: |
          npm install -g vercel
          vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
```

## 11. Безопасность

### Checklist:

- [ ] Все секреты в переменных окружения
- [ ] JWT_SECRET минимум 32 символа
- [ ] HTTPS включен везде
- [ ] CORS настроен правильно
- [ ] Rate limiting включен
- [ ] Helmet middleware включен
- [ ] SQL injection защита (Prisma)
- [ ] XSS защита
- [ ] CSRF защита

### Дополнительные меры:

1. **Cloudflare** - добавьте сайт в Cloudflare для:

   - DDoS защиты
   - WAF (Web Application Firewall)
   - CDN
   - SSL

2. **Environment Variables** - никогда не коммитьте:
   - .env файлы
   - Пароли
   - API ключи
   - JWT секреты

## 12. Производительность

### Backend оптимизация:

1. **Кэширование** - добавьте Redis:

```javascript
import Redis from "ioredis";
const redis = new Redis(process.env.REDIS_URL);
```

2. **Compression** - сжатие ответов:

```javascript
import compression from "compression";
app.use(compression());
```

3. **Database indexes** - добавьте в schema.prisma:

```prisma
model Restaurant {
  subdomain String @unique @db.VarChar(50)
  @@index([subdomain])
}
```

### Frontend оптимизация:

1. **Code splitting** - уже настроено в Vite
2. **Image optimization** - используйте Cloudinary
3. **Lazy loading** - для изображений и компонентов

## 13. Стоимость (примерная)

### Бесплатный tier:

- Vercel: Free (Hobby)
- Render: Free (750 часов/месяц)
- Supabase: Free (500MB DB, 1GB bandwidth)
- Cloudinary: Free (25GB storage, 25GB bandwidth)

**Итого: $0/месяц** (для начала)

### Платный tier (при росте):

- Vercel Pro: $20/месяц
- Render Starter: $7/месяц
- Supabase Pro: $25/месяц
- Cloudinary Advanced: $99/месяц

**Итого: ~$150/месяц**

## 14. Troubleshooting

### Backend не запускается

1. Проверьте логи в Render
2. Проверьте DATABASE_URL
3. Проверьте, что миграции применены

### Frontend не подключается к Backend

1. Проверьте VITE_API_URL
2. Проверьте CORS настройки
3. Проверьте, что backend доступен

### Email не отправляются

1. Проверьте SMTP настройки
2. Проверьте App Password для Gmail
3. Проверьте логи backend

### Изображения не загружаются

1. Проверьте права на директорию uploads
2. Проверьте MAX_FILE_SIZE
3. Рассмотрите использование Cloudinary

## 15. Пост-деплой checklist

- [ ] Все endpoints работают
- [ ] Регистрация работает
- [ ] Login работает
- [ ] Загрузка изображений работает
- [ ] Email отправляются
- [ ] WhatsApp интеграция работает
- [ ] Админ-панель доступна
- [ ] SSL сертификаты активны
- [ ] Мониторинг настроен
- [ ] Backup настроен
- [ ] Документация обновлена

## 🎉 Готово!

Ваше приложение развернуто и готово к использованию!

### Полезные ссылки:

- Frontend: https://your-app.vercel.app
- Backend: https://your-api.onrender.com
- Database: https://app.supabase.com
- Images: https://cloudinary.com/console

---

**Удачи в production! 🚀**
