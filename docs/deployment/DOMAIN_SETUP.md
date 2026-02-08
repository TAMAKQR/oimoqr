# 🌐 Настройка домена oimoqr.com

Полное руководство по настройке домена для OimoQR с поддержкой поддоменов для ресторанов.

---

## 📋 Обзор архитектуры

### Структура доменов

```
oimoqr.com                    → Frontend (главная страница, регистрация, дашборд)
api.oimoqr.com                → Backend API
*.oimoqr.com                  → Wildcard для поддоменов ресторанов
  └─ restaurant1.oimoqr.com   → Меню ресторана 1
  └─ restaurant2.oimoqr.com   → Меню ресторана 2
  └─ ...
```

### Платформы для деплоя

- **Frontend**: Vercel (с поддержкой wildcard доменов)
- **Backend**: Render или Railway
- **Database**: Render PostgreSQL (PostgreSQL)

---

## 🔧 Шаг 1: Настройка DNS записей

### У вашего регистратора домена (где куплен oimoqr.com)

Добавьте следующие DNS записи:

#### 1. Основной домен (Frontend на Vercel)

```
Type: A
Name: @
Value: 76.76.21.21
TTL: 3600
```

```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 3600
```

#### 2. API поддомен (Backend на Render)

```
Type: CNAME
Name: api
Value: ваш-проект.onrender.com
TTL: 3600
```

_Замените `ваш-проект.onrender.com` на реальный URL после создания проекта на Render_

#### 3. Wildcard для ресторанов (Frontend на Vercel)

```
Type: CNAME
Name: *
Value: cname.vercel-dns.com
TTL: 3600
```

**Важно**: Wildcard запись `*` должна указывать на тот же Vercel проект, что и основной домен.

---

## 🚀 Шаг 2: Деплой Frontend на Vercel

### 2.1 Подготовка проекта

1. **Создайте Git репозиторий** (если еще не создан):

```powershell
Set-Location "d:\QR MENU"
git init
git add .
git commit -m "Initial commit - OimoQR v1.0"
```

2. **Загрузите на GitHub**:

```powershell
# Создайте репозиторий на GitHub, затем:
git remote add origin https://github.com/ваш-username/oimoqr.git
git branch -M main
git push -u origin main
```

### 2.2 Деплой на Vercel

1. Зайдите на [vercel.com](https://vercel.com) и войдите через GitHub
2. Нажмите **"Add New Project"**
3. Выберите репозиторий `oimoqr`
4. Настройте проект:

```
Framework Preset: Vite
Root Directory: frontend
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

5. **Environment Variables**:

```env
VITE_API_URL=https://api.oimoqr.com/api
```

6. Нажмите **"Deploy"**

### 2.3 Настройка домена в Vercel

1. После деплоя перейдите в **Settings → Domains**
2. Добавьте домены:

   - `oimoqr.com`
   - `www.oimoqr.com`
   - `*.oimoqr.com` (wildcard)

3. Vercel покажет инструкции по настройке DNS
4. Дождитесь проверки DNS (может занять до 48 часов, обычно 10-30 минут)
5. SSL сертификаты будут выпущены автоматически

### 2.4 Настройка Wildcard роутинга

Vercel автоматически поддерживает wildcard домены. Ваше React приложение будет обрабатывать поддомены через `window.location.hostname`.

**Проверка**: После настройки, все поддомены будут работать:

- `https://oimoqr.com` → главная страница
- `https://restaurant1.oimoqr.com` → меню ресторана
- `https://любой-поддомен.oimoqr.com` → обработается React Router

---

## 🔌 Шаг 3: Деплой Backend на Render

### 3.1 Создание проекта на Render

1. Зайдите на [render.com](https://render.com)
2. Нажмите **"New +"** → **"Web Service"**
3. Подключите GitHub репозиторий
4. Настройте:

```
Name: oimoqr-backend
Environment: Node
Region: Ohio (ближайший к вашим пользователям)
Branch: main
Root Directory: backend
Build Command: npm install && npx prisma generate
Start Command: npm start
```

### 3.2 Environment Variables на Render

Добавьте в **Environment**:

```env
NODE_ENV=production
PORT=5000

# Database (из Render PostgreSQL)
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres?pgbouncer=true&connection_limit=1

# JWT
JWT_SECRET=ваш-супер-секретный-ключ-минимум-32-символа-случайных
JWT_EXPIRES_IN=7d

# CORS
FRONTEND_URL=https://oimoqr.com

# Email (опционально)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

**Важно**:

- Используйте `pgbouncer=true` для Render PostgreSQL
- `connection_limit=1` для бесплатного плана Render

### 3.3 Настройка кастомного домена на Render

1. После деплоя перейдите в **Settings → Custom Domain**
2. Добавьте: `api.oimoqr.com`
3. Render покажет CNAME запись для DNS
4. Добавьте эту CNAME запись у вашего регистратора
5. SSL сертификат будет выпущен автоматически

---

## 🗄️ Шаг 4: Настройка базы данных Render PostgreSQL

### 4.1 Создание проекта

1. Зайдите на [Render PostgreSQL.com](https://Render PostgreSQL.com)
2. Создайте новый проект:
   - Name: `oimoqr`
   - Database Password: (сохраните надежно!)
   - Region: Ohio

### 4.2 Получение DATABASE_URL

1. Перейдите в **Settings → Database**
2. Найдите **Connection string** → **URI**
3. Скопируйте строку подключения:

```
postgresql://postgres:[YOUR-PASSWORD]@[HOST]:[PORT]/postgres
```

4. Добавьте параметры для Prisma:

```
postgresql://postgres:[YOUR-PASSWORD]@[HOST]:[PORT]/postgres?pgbouncer=true&connection_limit=1
```

### 4.3 Запуск миграций

**Локально** (перед деплоем):

```powershell
Set-Location "d:\QR MENU\backend"

# Установите DATABASE_URL из Render PostgreSQL
$env:DATABASE_URL="postgresql://postgres:..."

# Запустите миграции
npx prisma migrate deploy

# Создайте админа
npm run create-admin admin@oimoqr.com SecurePassword123 "Admin"
```

---

## ✅ Шаг 5: Проверка работы

### 5.1 Проверка DNS

```powershell
# Проверка основного домена
nslookup oimoqr.com

# Проверка API
nslookup api.oimoqr.com

# Проверка wildcard
nslookup test.oimoqr.com
```

### 5.2 Проверка SSL

Откройте в браузере:

- `https://oimoqr.com` - должен быть зеленый замок
- `https://api.oimoqr.com/health` - должен вернуть `{"status":"ok"}`
- `https://любой-поддомен.oimoqr.com` - должен открыться сайт

### 5.3 Проверка API

```powershell
# Health check
curl https://api.oimoqr.com/health

# Регистрация тестового ресторана
curl -X POST https://api.oimoqr.com/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{
    "email": "test@restaurant.com",
    "password": "test123",
    "name": "Test Owner",
    "phone": "+1234567890",
    "restaurantName": "Test Restaurant",
    "subdomain": "testrestaurant"
  }'
```

### 5.4 Проверка поддомена ресторана

1. Зарегистрируйте ресторан с субдоменом `myrestaurant`
2. Откройте `https://myrestaurant.oimoqr.com`
3. Должно открыться меню ресторана

---

## 🔒 Шаг 6: Безопасность

### 6.1 CORS настройки

В `backend/src/server.js` убедитесь:

```javascript
const corsOptions = {
  origin: [
    "https://oimoqr.com",
    "https://www.oimoqr.com",
    /\.oimoqr\.com$/, // Разрешить все поддомены
  ],
  credentials: true,
};
```

### 6.2 Environment Variables

**Никогда не коммитьте**:

- `.env` файлы
- `DATABASE_URL`
- `JWT_SECRET`
- Пароли и API ключи

Добавьте в `.gitignore`:

```
.env
.env.local
.env.production
```

### 6.3 JWT Secret

Сгенерируйте надежный секрет:

```powershell
# PowerShell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

---

## 📊 Шаг 7: Мониторинг

### 7.1 Vercel Analytics

1. В Vercel перейдите в **Analytics**
2. Включите **Web Analytics** (бесплатно)
3. Отслеживайте посещения и производительность

### 7.2 Render Logs

1. В Render перейдите в **Logs**
2. Мониторьте ошибки и запросы
3. Настройте алерты при ошибках

### 7.3 Render PostgreSQL Monitoring

1. В Render PostgreSQL перейдите в **Database → Usage**
2. Отслеживайте:
   - Размер БД (лимит 500MB на free tier)
   - Количество подключений
   - Bandwidth (лимит 2GB/месяц)

---

## 🚨 Troubleshooting

### Проблема: DNS не резолвится

**Решение**:

- Подождите 24-48 часов для полного распространения DNS
- Проверьте записи через [whatsmydns.net](https://www.whatsmydns.net)
- Очистите DNS кеш: `ipconfig /flushdns`

### Проблема: SSL сертификат не выпускается

**Решение**:

- Убедитесь, что DNS записи правильные
- Подождите 10-30 минут после настройки DNS
- Проверьте, что домен указывает на правильный IP/CNAME
- В Vercel: Settings → Domains → Refresh SSL

### Проблема: Wildcard поддомены не работают

**Решение**:

- Убедитесь, что добавлена DNS запись `* CNAME cname.vercel-dns.com`
- В Vercel добавьте домен `*.oimoqr.com`
- Проверьте, что React Router правильно обрабатывает поддомены

### Проблема: CORS ошибки

**Решение**:

- Проверьте `FRONTEND_URL` в backend environment variables
- Убедитесь, что в CORS разрешены wildcard домены: `/\.oimoqr\.com$/`
- Проверьте, что используется `https://` (не `http://`)

### Проблема: Backend засыпает (Render free tier)

**Решение**:

- Это нормально для бесплатного плана (засыпает через 15 минут)
- Первый запрос после сна займет ~30 секунд
- Для production рассмотрите платный план ($7/месяц)
- Или используйте cron-job для пинга каждые 10 минут

---

## 💰 Стоимость

### Бесплатный план (для старта)

- **Vercel**: Free tier

  - Unlimited deployments
  - 100GB bandwidth/месяц
  - Automatic SSL
  - **Стоимость**: $0

- **Render**: Free tier

  - 750 часов/месяц
  - 512MB RAM
  - Засыпает через 15 минут
  - **Стоимость**: $0

- **Render PostgreSQL**: Free tier
  - 500MB database
  - 2GB bandwidth/месяц
  - Unlimited API requests
  - **Стоимость**: $0

**Итого**: $0/месяц (подходит для 5-10 ресторанов)

### Платный план (для роста)

- **Vercel Pro**: $20/месяц

  - 1TB bandwidth
  - Advanced analytics
  - Team collaboration

- **Render Starter**: $7/месяц

  - Always-on (не засыпает)
  - 512MB RAM
  - Faster performance

- **Render PostgreSQL Pro**: $25/месяц
  - 8GB database
  - 50GB bandwidth
  - Daily backups

**Итого**: ~$52/месяц (для 50+ ресторанов)

---

## 📝 Чеклист настройки домена

```
□ DNS записи добавлены у регистратора
  □ A запись для @ → 76.76.21.21
  □ CNAME для www → cname.vercel-dns.com
  □ CNAME для api → ваш-проект.onrender.com
  □ CNAME для * → cname.vercel-dns.com

□ Frontend задеплоен на Vercel
  □ Проект создан и подключен к GitHub
  □ Environment variables настроены
  □ Домены добавлены (oimoqr.com, www, *.oimoqr.com)
  □ SSL сертификаты выпущены

□ Backend задеплоен на Render
  □ Web Service создан
  □ Environment variables настроены
  □ Кастомный домен api.oimoqr.com добавлен
  □ SSL сертификат выпущен

□ База данных настроена
  □ Render PostgreSQL проект создан
  □ DATABASE_URL получен
  □ Миграции запущены
  □ Админ создан

□ Тестирование
  □ https://oimoqr.com открывается
  □ https://api.oimoqr.com/health возвращает OK
  □ Регистрация работает
  □ Поддомены ресторанов работают
  □ SSL везде активен (зеленый замок)

□ Безопасность
  □ JWT_SECRET сгенерирован и установлен
  □ .env файлы в .gitignore
  □ CORS правильно настроен
  □ Пароли БД надежные

□ Мониторинг
  □ Vercel Analytics включен
  □ Render Logs проверяются
  □ Render PostgreSQL Usage отслеживается
```

---

## 🎯 Следующие шаги

После успешной настройки домена:

1. **Создайте первого ресторана** через регистрацию
2. **Настройте меню** и загрузите фотографии
3. **Сгенерируйте QR-код** для `ваш-ресторан.oimoqr.com`
4. **Протестируйте** заказ через WhatsApp
5. **Настройте мониторинг** и алерты
6. **Создайте backup** базы данных

---

## 📚 Дополнительные ресурсы

- [Vercel Domains Documentation](https://vercel.com/docs/concepts/projects/domains)
- [Render Custom Domains](https://render.com/docs/custom-domains)
- [Render PostgreSQL Connection Pooling](https://Render PostgreSQL.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Wildcard DNS Setup](https://vercel.com/docs/concepts/projects/domains/wildcard-domains)

---

**Готово!** 🎉 Ваш OimoQR теперь доступен на `oimoqr.com` с поддержкой поддоменов для каждого ресторана!
