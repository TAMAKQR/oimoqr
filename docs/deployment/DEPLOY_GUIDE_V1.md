# 🚀 Пошаговое руководство по деплою OimoQR v1.0

## 📋 Что мы будем делать

1. ✅ Подготовим код к деплою
2. 🗄️ Развернем базу данных на Render PostgreSQL (бесплатно)
3. 🔧 Развернем Backend на Render (бесплатно)
4. 🎨 Развернем Frontend на Vercel (бесплатно)
5. 🌐 Настроим домен oimoqr.com с поддоменами
6. 🔗 Свяжем всё вместе

**Время: ~40-60 минут**

> **Важно**: У вас есть домен **oimoqr.com**. Для полной настройки с поддоменами см. [DOMAIN_SETUP.md](./DOMAIN_SETUP.md)

---

## 🎯 Шаг 1: Подготовка кода (5 минут)

### 1.1 Проверьте, что всё работает локально

```powershell
# Запустите приложение
npm run dev

# Откройте http://localhost:5173
# Проверьте, что всё работает
```

### 1.2 Создайте Git репозиторий (если еще не создан)

```powershell
# Инициализируйте Git
git init

# Добавьте все файлы
git add .

# Сделайте первый коммит
git commit -m "Initial commit - QR Menu v1.0"
```

### 1.3 Создайте репозиторий на GitHub

1. Перейдите на https://github.com
2. Нажмите "New repository"
3. Название: `oimoqr`
4. Сделайте репозиторий **Private** (для безопасности)
5. НЕ добавляйте README, .gitignore (у нас уже есть)
6. Нажмите "Create repository"

### 1.4 Загрузите код на GitHub

```powershell
# Добавьте remote
git remote add origin https://github.com/ваш-username/oimoqr.git

# Загрузите код
git branch -M main
git push -u origin main
```

---

## 🗄️ Шаг 2: База данных на Render (10 минут)

### 2.1 Создайте аккаунт

1. Перейдите на https://render.com
2. Нажмите "Get Started"
3. Войдите через GitHub (рекомендуется)

### 2.2 Создайте базу данных

1. Нажмите "New +" → "PostgreSQL"
2. Заполните:
   - **Name:** `oimoqr-db`
   - **Database:** `oimoqr_db` (или оставьте по умолчанию)
   - **User:** `oimoqr_user` (или оставьте по умолчанию)
   - **Region:** Frankfurt (EU Central) - ближайший к СНГ
   - **Plan:** Free
3. Нажмите "Create Database"
4. Подождите 2-3 минуты, пока база данных создается.

### 2.3 Получите Connection String

1. На странице вашей новой базы данных найдите раздел **Connections**.
2. Скопируйте строку **"Internal Database URL"**. Это ваш `DATABASE_URL`.

Пример:
`postgresql://oimoqr_user:ВАШ_ПАРОЛЬ@dpg-xxxx.frankfurt-postgres.render.com/oimoqr_db`

### 2.4 Примените миграции

**Важно:** Для production базы данных используется команда `migrate deploy`, а не `db push`. Это гарантирует применение версионированных миграций и предотвращает потерю данных.

```powershell
# Установите временную переменную окружения
$env:DATABASE_URL="СКОПИРОВАННАЯ_СТРОКА_ИЗ_RENDER"

# Перейдите в backend
Set-Location "d:\QR MENU\backend"

# Примените миграции
npx prisma migrate deploy

# Сгенерируйте Prisma Client
npx prisma generate
```

### 2.5 Создайте администратора

```powershell
# Создайте первого админа
npm run create-admin admin@yourdomain.com SecurePassword123 "Admin Name"
```

✅ **База данных готова!**

---

## 🔧 Шаг 3: Backend на Render (10 минут)

### 3.1 Создайте аккаунт

1. Перейдите на https://render.com
2. Нажмите "Get Started"
3. Войдите через GitHub (рекомендуется)

### 3.2 Создайте Web Service

1. Нажмите "New +" → "Web Service"
2. Нажмите "Connect account" для GitHub (если нужно)
3. Найдите репозиторий `qr-menu-saas`
4. Нажмите "Connect"

### 3.3 Настройте сервис

Заполните форму:

- **Name:** `oimoqr-backend` (для консистентности)
- **Region:** Frankfurt (EU Central)
- **Branch:** `main`
- **Root Directory:** `backend`
- **Runtime:** Node
- **Build Command:**
  ```
  npm install && npx prisma generate
  ```
- **Start Command:**
  ```
  npm start
  ```
- **Instance Type:** Free

### 3.4 Добавьте переменные окружения

Прокрутите вниз до **Environment Variables** и добавьте:

```env
DATABASE_URL=postgresql://postgres.xxxxx:ВАШ_ПАРОЛЬ@aws-0-eu-central-1.pooler.Render PostgreSQL.com:5432/postgres

JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long-please

JWT_EXPIRES_IN=7d

PORT=5000

NODE_ENV=production

FRONTEND_URL=https://temporary-url.vercel.app

TRIAL_PERIOD_DAYS=7

UPLOAD_DIR=./uploads

MAX_FILE_SIZE=5242880
```

**⚠️ Важно:**

- `JWT_SECRET` - придумайте случайную строку минимум 32 символа
- `DATABASE_URL` - вставьте вашу строку из Render PostgreSQL
- `FRONTEND_URL` - пока оставьте временный, обновим позже

### 3.5 Деплой

1. Нажмите "Create Web Service"
2. Подождите 3-5 минут (идет деплой)
3. Когда статус станет "Live", скопируйте URL
   - Пример: `https://qr-menu-backend.onrender.com`

### 3.6 Проверьте работу

Откройте в браузере:

```
https://ваш-backend.onrender.com/health
```

Должно вернуть:

```json
{ "status": "ok", "timestamp": "2024-01-15T12:00:00.000Z" }
```

✅ **Backend работает!**

---

## 🎨 Шаг 4: Frontend на Vercel (10 минут)

### 4.1 Создайте аккаунт

1. Перейдите на https://vercel.com
2. Нажмите "Sign Up"
3. Войдите через GitHub (рекомендуется)

### 4.2 Создайте проект

1. Нажмите "Add New..." → "Project"
2. Найдите репозиторий `qr-menu-saas`
3. Нажмите "Import"

### 4.3 Настройте проект

Заполните форму:

- **Framework Preset:** Vite (должно определиться автоматически)
- **Root Directory:** Нажмите "Edit" → выберите `frontend`
- **Build Command:** `npm run build` (по умолчанию)
- **Output Directory:** `dist` (по умолчанию)
- **Install Command:** `npm install` (по умолчанию)

### 4.4 Добавьте переменные окружения

В разделе **Environment Variables** добавьте:

```env
VITE_API_URL=https://ваш-backend.onrender.com/api
```

**⚠️ Замените** `ваш-backend.onrender.com` на ваш реальный URL из Render!

### 4.5 Деплой

1. Нажмите "Deploy"
2. Подождите 2-3 минуты
3. Когда появится "Congratulations!", нажмите "Continue to Dashboard"
4. Скопируйте URL вашего сайта
   - Пример: `https://qr-menu-saas.vercel.app`

✅ **Frontend работает!**

---

## 🔗 Шаг 5: Связываем всё вместе (5 минут)

### 5.1 Обновите FRONTEND_URL в Render

1. Вернитесь на https://dashboard.render.com
2. Откройте ваш Backend сервис
3. Перейдите в **Environment**
4. Найдите `FRONTEND_URL`
5. Измените на ваш реальный URL Vercel:
   ```
   https://qr-menu-saas.vercel.app
   ```
6. Нажмите "Save Changes"
7. Сервис автоматически перезапустится (1-2 минуты)

### 5.2 Проверьте CORS

Откройте консоль браузера (F12) на вашем сайте и проверьте, что нет ошибок CORS.

---

## 🎉 Шаг 6: Тестирование (5 минут)

### 6.1 Откройте ваш сайт

```
https://ваш-сайт.vercel.app
```

### 6.2 Проверьте функционал

- [ ] Главная страница загружается
- [ ] Можно зарегистрироваться
- [ ] Можно войти
- [ ] Можно создать ресторан
- [ ] Можно добавить категорию
- [ ] Можно добавить блюдо
- [ ] Публичное меню работает (`/menu/ваш-subdomain`)
- [ ] Можно изменить валюту в настройках

---

## 📝 Важные URL для сохранения

Сохраните эти URL в безопасном месте:

```
Frontend:  https://ваш-сайт.vercel.app
Backend:   https://ваш-backend.onrender.com
Database:  Render PostgreSQL Dashboard
GitHub:    https://github.com/ваш-username/qr-menu-saas

Admin Email:    admin@yourdomain.com
Admin Password: SecurePassword123
```

---

## 🐛 Возможные проблемы и решения

### Backend не запускается

1. Проверьте логи в Render Dashboard → Logs
2. Убедитесь, что `DATABASE_URL` правильный
3. Проверьте, что `JWT_SECRET` минимум 32 символа

### Frontend не подключается к Backend

1. Проверьте `VITE_API_URL` в Vercel
2. Убедитесь, что URL заканчивается на `/api`
3. Проверьте CORS в логах Render

### База данных не подключается

1. Проверьте пароль в `DATABASE_URL`
2. Убедитесь, что используете URI (не Session mode)
3. Попробуйте пересоздать строку подключения в Render PostgreSQL

### Загрузка изображений не работает

На бесплатном плане Render файловая система эфемерная. Для production нужно:

1. Использовать Cloudinary (бесплатно до 25GB)
2. Или AWS S3
3. Или другое облачное хранилище

---

## 🚀 Следующие шаги

После успешного деплоя:

1. **Купите домен** (опционально)

   - Namecheap, GoDaddy, или reg.ru
   - Настройте в Vercel и Render

2. **Настройте Email**

   - Создайте App Password в Gmail
   - Добавьте SMTP переменные в Render

3. **Добавьте мониторинг**

   - UptimeRobot для проверки доступности
   - Sentry для отслеживания ошибок

4. **Настройте backup**

   - Render PostgreSQL делает автоматический backup
   - Можно настроить дополнительный через pg_dump

5. **Оптимизируйте производительность**
   - Добавьте Redis для кэширования
   - Настройте CDN через Cloudflare

---

## 💰 Лимиты бесплатных планов

### Render (Backend)

- 750 часов/месяц (достаточно для 1 сервиса 24/7)
- Засыпает после 15 минут неактивности
- Просыпается за ~30 секунд при запросе

### Vercel (Frontend)

- 100 GB bandwidth/месяц
- Неограниченные деплои
- Автоматический SSL

### Render PostgreSQL (Database)

- 500 MB хранилища
- 2 GB bandwidth/месяц
- Неограниченные API запросы

---

## 📞 Поддержка

Если что-то не работает:

1. Проверьте логи в Render и Vercel
2. Откройте консоль браузера (F12)
3. Проверьте переменные окружения
4. Убедитесь, что все URL правильные

---

**Готово! Ваше приложение в production! 🎉**
