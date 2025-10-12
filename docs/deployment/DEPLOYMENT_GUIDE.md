# 🚀 Руководство по деплою QR Menu на Vercel

> Полное пошаговое руководство по развертыванию QR Menu SaaS Platform в production

---

## 📋 Содержание

1. [Предварительные требования](#предварительные-требования)
2. [Подготовка проекта](#подготовка-проекта)
3. [Настройка базы данных PostgreSQL](#настройка-базы-данных-postgresql)
4. [Деплой на Vercel](#деплой-на-vercel)
5. [Настройка домена](#настройка-домена)
6. [Проверка работоспособности](#проверка-работоспособности)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 Предварительные требования

### Необходимые аккаунты:

- ✅ **GitHub** - для хранения кода
- ✅ **Vercel** - для деплоя (https://vercel.com)
- ✅ **Supabase** или **Railway** - для PostgreSQL БД (бесплатный tier)
- ✅ **Cloudinary** (опционально) - для хранения изображений

### Установленное ПО:

- ✅ Node.js 18+
- ✅ Git
- ✅ npm или yarn

---

## 📦 Подготовка проекта

### Шаг 1: Инициализация Git репозитория

```powershell
# Перейти в директорию проекта
Set-Location "d:\QR MENU"

# Добавить все файлы
git add .

# Создать первый коммит
git commit -m "Initial commit: QR Menu v1.0"

# Создать репозиторий на GitHub и добавить remote
git remote add origin https://github.com/YOUR_USERNAME/qr-menu.git

# Отправить код на GitHub
git push -u origin master
```

### Шаг 2: Обновление .gitignore

Убедитесь, что `.gitignore` содержит:

```
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/

# Production
build/
dist/
.vercel

# Environment
.env
.env.local
.env.production

# Database
*.db
*.db-journal
prisma/migrations/

# Uploads
uploads/
!uploads/.gitkeep

# Logs
logs/
*.log
npm-debug.log*

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
```

### Шаг 3: Создание production конфигурации

Файл `vercel.json` уже создан в корне проекта.

---

## 🗄️ Настройка базы данных PostgreSQL

### Вариант 1: Supabase (Рекомендуется)

1. **Создать проект:**

   - Перейти на https://supabase.com
   - Нажать "New Project"
   - Выбрать организацию
   - Заполнить:
     - Name: `qr-menu-production`
     - Database Password: (сохраните!)
     - Region: Ближайший к вашим пользователям
   - Нажать "Create new project"

2. **Получить connection string:**

   - Перейти в Settings → Database
   - Скопировать "Connection string" (URI)
   - Формат: `postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres`

3. **Настроить Prisma:**

   ```powershell
   # Скопировать production схему
   Copy-Item "backend\prisma\schema.production.prisma" "backend\prisma\schema.prisma" -Force

   # Установить PostgreSQL драйвер
   Set-Location "backend"
   npm install pg
   ```

4. **Создать миграцию:**

   ```powershell
   # Установить DATABASE_URL
   $env:DATABASE_URL="postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres"

   # Создать миграцию
   npx prisma migrate dev --name init

   # Применить миграцию
   npx prisma migrate deploy
   ```

### Вариант 2: Railway

1. **Создать проект:**

   - Перейти на https://railway.app
   - Нажать "New Project"
   - Выбрать "Provision PostgreSQL"

2. **Получить credentials:**

   - Открыть PostgreSQL сервис
   - Перейти в "Connect"
   - Скопировать "Postgres Connection URL"

3. **Применить миграции** (аналогично Supabase)

---

## 🚀 Деплой на Vercel

### Шаг 1: Подключение GitHub репозитория

1. Перейти на https://vercel.com
2. Нажать "Add New..." → "Project"
3. Выбрать GitHub репозиторий `qr-menu`
4. Нажать "Import"

### Шаг 2: Настройка проекта

**Framework Preset:** Other

**Root Directory:** `./` (корень проекта)

**Build Command:**

```bash
cd backend && npm install && npm run build && cd ../frontend && npm install && npm run build
```

**Output Directory:** `frontend/dist`

**Install Command:**

```bash
npm install
```

### Шаг 3: Настройка переменных окружения

В разделе "Environment Variables" добавить:

#### Backend переменные:

```env
# Database
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres

# JWT
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long-production
JWT_EXPIRES_IN=7d

# Server
NODE_ENV=production
PORT=5000

# SMTP (Email)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=QR Menu <noreply@yourdomain.com>

# Frontend URL
FRONTEND_URL=https://yourdomain.com

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880

# Trial Period
TRIAL_PERIOD_DAYS=7
```

#### Frontend переменные:

```env
VITE_API_URL=https://yourdomain.com/api
```

### Шаг 4: Деплой

1. Нажать "Deploy"
2. Дождаться завершения сборки (3-5 минут)
3. Проверить логи на наличие ошибок

---

## 🌐 Настройка домена

### Шаг 1: Добавление домена в Vercel

1. Открыть проект в Vercel
2. Перейти в Settings → Domains
3. Нажать "Add"
4. Ввести домен: `yourdomain.com`
5. Нажать "Add"

### Шаг 2: Настройка DNS

Vercel покажет DNS записи, которые нужно добавить:

**Вариант A: A Record (рекомендуется)**

```
Type: A
Name: @
Value: 76.76.21.21
TTL: 3600
```

**Вариант B: CNAME Record**

```
Type: CNAME
Name: @
Value: cname.vercel-dns.com
TTL: 3600
```

**Для поддоменов (www, api):**

```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 3600
```

### Шаг 3: Настройка поддоменов ресторанов

Для работы поддоменов (например, `restaurant1.yourdomain.com`):

1. **Добавить wildcard DNS запись:**

   ```
   Type: CNAME
   Name: *
   Value: cname.vercel-dns.com
   TTL: 3600
   ```

2. **Добавить wildcard домен в Vercel:**
   - Settings → Domains
   - Add: `*.yourdomain.com`

### Шаг 4: SSL сертификат

Vercel автоматически выпустит SSL сертификат (Let's Encrypt).
Обычно это занимает 1-5 минут после настройки DNS.

---

## ✅ Проверка работоспособности

### 1. Проверка frontend

```
https://yourdomain.com
```

Должна открыться главная страница.

### 2. Проверка API

```
https://yourdomain.com/api/health
```

Должен вернуть:

```json
{
  "status": "ok",
  "timestamp": "2025-01-10T12:00:00.000Z"
}
```

### 3. Проверка базы данных

```powershell
# Подключиться к production БД
$env:DATABASE_URL="postgresql://..."
npx prisma studio
```

### 4. Создание первого администратора

```powershell
# Локально с production БД
$env:DATABASE_URL="postgresql://..."
Set-Location "backend"
npm run create-admin
```

Или через Vercel CLI:

```bash
vercel env pull
cd backend
npm run create-admin
```

### 5. Тестирование регистрации

1. Открыть `https://yourdomain.com/register`
2. Зарегистрировать тестовый ресторан
3. Проверить:
   - ✅ Редирект на dashboard
   - ✅ Email уведомление получено
   - ✅ Ресторан создан в БД
   - ✅ Trial подписка активна

### 6. Тестирование поддоменов

1. Создать ресторан с subdomain: `testrestaurant`
2. Открыть `https://testrestaurant.yourdomain.com`
3. Должно открыться меню ресторана

---

## 🐛 Troubleshooting

### Проблема: Build failed

**Решение:**

1. Проверить логи сборки в Vercel
2. Убедиться, что все зависимости установлены
3. Проверить `package.json` scripts

### Проблема: Database connection failed

**Решение:**

1. Проверить `DATABASE_URL` в Environment Variables
2. Убедиться, что IP Vercel разрешен в Supabase/Railway
3. Проверить, что миграции применены:
   ```bash
   npx prisma migrate deploy
   ```

### Проблема: Images not uploading

**Решение:**

Vercel имеет ограничения на запись файлов. Нужно использовать Cloudinary:

1. **Создать аккаунт Cloudinary:**

   - https://cloudinary.com
   - Получить credentials

2. **Добавить переменные окружения:**

   ```env
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   USE_CLOUDINARY=true
   ```

3. **Обновить код загрузки:**
   - Использовать Cloudinary SDK вместо локального хранения

### Проблема: Subdomain not working

**Решение:**

1. Проверить wildcard DNS запись: `*.yourdomain.com`
2. Добавить wildcard домен в Vercel
3. Проверить, что DNS propagation завершена (до 48 часов)

### Проблема: CORS errors

**Решение:**

1. Проверить `FRONTEND_URL` в backend `.env`
2. Обновить CORS настройки в `backend/src/server.js`:
   ```javascript
   app.use(
     cors({
       origin: ["https://yourdomain.com", "https://*.yourdomain.com"],
       credentials: true,
     })
   );
   ```

### Проблема: Email not sending

**Решение:**

1. Проверить SMTP credentials
2. Для Gmail: включить "App Passwords"
3. Проверить, что SMTP_HOST и SMTP_PORT правильные
4. Проверить логи в Vercel

---

## 📊 Мониторинг и логи

### Vercel Dashboard

- **Deployments:** История деплоев
- **Analytics:** Статистика посещений
- **Logs:** Логи приложения в реальном времени

### Supabase Dashboard

- **Database:** Просмотр таблиц
- **Logs:** Логи запросов к БД
- **Monitoring:** Использование ресурсов

---

## 🔄 Обновление production

### Автоматический деплой

Vercel автоматически деплоит при push в `master`:

```powershell
git add .
git commit -m "Update: feature description"
git push origin master
```

### Ручной деплой

```powershell
# Установить Vercel CLI
npm install -g vercel

# Деплой
vercel --prod
```

---

## 🔐 Безопасность

### Checklist:

- ✅ Все `.env` файлы в `.gitignore`
- ✅ JWT_SECRET - случайная строка 32+ символов
- ✅ HTTPS включен (автоматически в Vercel)
- ✅ CORS настроен правильно
- ✅ Rate limiting включен
- ✅ Helmet middleware включен
- ✅ SQL injection защита (Prisma)
- ✅ XSS защита (React)

---

## 📈 Оптимизация

### Performance:

1. **Включить кэширование:**

   - Vercel автоматически кэширует статику
   - Настроить Cache-Control headers

2. **Оптимизация изображений:**

   - Использовать Cloudinary transformations
   - Lazy loading для изображений

3. **Database indexing:**

   ```prisma
   @@index([subdomain])
   @@index([email])
   ```

4. **CDN:**
   - Vercel Edge Network (автоматически)

---

## 📞 Поддержка

### Полезные ссылки:

- **Vercel Docs:** https://vercel.com/docs
- **Prisma Docs:** https://www.prisma.io/docs
- **Supabase Docs:** https://supabase.com/docs

### Контакты:

- GitHub Issues: https://github.com/YOUR_USERNAME/qr-menu/issues
- Email: support@yourdomain.com

---

## ✅ Checklist перед запуском

- [ ] Код загружен на GitHub
- [ ] PostgreSQL БД создана и настроена
- [ ] Миграции применены
- [ ] Vercel проект создан
- [ ] Environment variables настроены
- [ ] Домен добавлен и DNS настроен
- [ ] SSL сертификат выпущен
- [ ] Wildcard поддомены работают
- [ ] Администратор создан
- [ ] Email отправка работает
- [ ] Тестовый ресторан создан
- [ ] Загрузка изображений работает
- [ ] Мониторинг настроен

---

**Дата создания:** 2025-01-10  
**Версия:** 1.0  
**Автор:** QR Menu Team
