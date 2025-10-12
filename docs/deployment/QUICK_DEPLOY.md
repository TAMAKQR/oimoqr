# ⚡ Быстрый деплой на Vercel

> Минимальные шаги для запуска QR Menu в production за 15 минут

---

## 🚀 Шаг 1: GitHub (2 минуты)

```powershell
# В директории проекта
Set-Location "d:\QR MENU"

# Добавить все файлы
git add .
git commit -m "Initial commit: QR Menu v1.0"

# Создать репозиторий на GitHub.com и выполнить:
git remote add origin https://github.com/YOUR_USERNAME/qr-menu.git
git push -u origin master
```

---

## 🗄️ Шаг 2: База данных Supabase (3 минуты)

1. Открыть https://supabase.com
2. New Project → `qr-menu-production`
3. Скопировать **Connection string** из Settings → Database
4. Сохранить в блокнот

**Формат:**

```
postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres
```

---

## 🔧 Шаг 3: Применить миграции (2 минуты)

```powershell
# Переключиться на PostgreSQL схему
Copy-Item "backend\prisma\schema.production.prisma" "backend\prisma\schema.prisma" -Force

# Установить зависимости
Set-Location "backend"
npm install pg

# Применить миграции
$env:DATABASE_URL="postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres"
npx prisma migrate dev --name init
npx prisma migrate deploy
```

---

## 🌐 Шаг 4: Vercel деплой (5 минут)

### 4.1. Создать проект

1. Открыть https://vercel.com
2. Add New → Project
3. Import Git Repository → Выбрать `qr-menu`

### 4.2. Настроить сборку

- **Framework Preset:** Other
- **Root Directory:** `./`
- **Build Command:**
  ```bash
  cd backend && npm install && npm run build && cd ../frontend && npm install && npm run build
  ```
- **Output Directory:** `frontend/dist`

### 4.3. Environment Variables

Добавить переменные (нажать "Add" для каждой):

```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long-production
JWT_EXPIRES_IN=7d
NODE_ENV=production
PORT=5000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
SMTP_FROM=QR Menu <noreply@yourdomain.com>
FRONTEND_URL=https://your-vercel-app.vercel.app
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880
TRIAL_PERIOD_DAYS=7
VITE_API_URL=https://your-vercel-app.vercel.app/api
```

### 4.4. Deploy

Нажать **Deploy** и дождаться завершения (3-5 минут)

---

## 🌍 Шаг 5: Настроить домен (3 минуты)

### 5.1. Добавить домен в Vercel

1. Settings → Domains
2. Add → `yourdomain.com`

### 5.2. Настроить DNS

В панели вашего регистратора доменов добавить:

**A Record:**

```
Type: A
Name: @
Value: 76.76.21.21
```

**Wildcard для поддоменов:**

```
Type: CNAME
Name: *
Value: cname.vercel-dns.com
```

### 5.3. Добавить wildcard в Vercel

Settings → Domains → Add → `*.yourdomain.com`

---

## ✅ Шаг 6: Проверка (2 минуты)

### 6.1. Проверить сайт

Открыть: `https://yourdomain.com`

### 6.2. Проверить API

Открыть: `https://yourdomain.com/api/health`

Должен вернуть:

```json
{ "status": "ok", "timestamp": "..." }
```

### 6.3. Создать администратора

```powershell
$env:DATABASE_URL="postgresql://..."
Set-Location "backend"
npm run create-admin
```

Ввести:

- Email: `admin@yourdomain.com`
- Password: `SecurePassword123!`
- Name: `Admin`

### 6.4. Тест регистрации

1. Открыть `https://yourdomain.com/register`
2. Зарегистрировать тестовый ресторан:
   - Email: `test@restaurant.com`
   - Password: `test123`
   - Restaurant: `Test Restaurant`
   - Subdomain: `testrestaurant`
3. Проверить, что открылся dashboard

### 6.5. Тест поддомена

Открыть: `https://testrestaurant.yourdomain.com`

Должно открыться меню ресторана.

---

## 🎉 Готово!

Ваш QR Menu работает в production!

### Что дальше?

1. **Настроить мониторинг:**

   - Vercel Analytics
   - Supabase Monitoring

2. **Настроить Cloudinary** (для загрузки изображений):

   - https://cloudinary.com
   - Добавить credentials в Environment Variables

3. **Настроить email:**

   - Gmail App Password
   - Или SendGrid / Mailgun

4. **Добавить контент:**
   - Создать реальные рестораны
   - Загрузить меню
   - Протестировать заказы

---

## 🐛 Если что-то не работает

### Build failed

```powershell
# Проверить логи в Vercel Dashboard
# Убедиться, что все зависимости установлены
```

### Database connection error

```powershell
# Проверить DATABASE_URL
# Убедиться, что миграции применены
npx prisma migrate deploy
```

### Subdomain not working

```
# Проверить DNS propagation (до 48 часов)
# Убедиться, что wildcard домен добавлен в Vercel
```

### Images not uploading

```
# Vercel не поддерживает запись файлов
# Нужно настроить Cloudinary (см. DEPLOYMENT_GUIDE.md)
```

---

## 📚 Полная документация

Для детальной информации см. `DEPLOYMENT_GUIDE.md`

---

**Время деплоя:** ~15 минут  
**Сложность:** Средняя  
**Стоимость:** $0 (бесплатные tier'ы)
