# Инструкция по установке и запуску QR Menu SaaS

## Предварительные требования

- Node.js 18+ и npm
- PostgreSQL 14+
- Git (опционально)

## Шаг 1: Установка зависимостей

Откройте PowerShell в корневой директории проекта и выполните:

```powershell
# Установка зависимостей для всех workspace
npm install

# Установка зависимостей для frontend
Set-Location frontend; npm install; Set-Location ..

# Установка зависимостей для backend
Set-Location backend; npm install; Set-Location ..
```

## Шаг 2: Настройка базы данных PostgreSQL

### Создание базы данных

Откройте PostgreSQL и выполните:

```sql
CREATE DATABASE qr_menu_db;
CREATE USER qr_menu_user WITH PASSWORD 'your_password_here';
GRANT ALL PRIVILEGES ON DATABASE qr_menu_db TO qr_menu_user;
```

## Шаг 3: Настройка переменных окружения

### Backend (.env)

Создайте файл `backend/.env`:

```env
# Database
DATABASE_URL="postgresql://qr_menu_user:your_password_here@localhost:5432/qr_menu_db"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRES_IN="7d"

# Server
PORT=5000
NODE_ENV=development

# Email (SMTP) - Настройте для Gmail или другого провайдера
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="QR Menu <noreply@qrmenu.com>"

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# Trial Period (days)
TRIAL_PERIOD_DAYS=7
```

### Frontend (.env)

Создайте файл `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

## Шаг 4: Инициализация базы данных

```powershell
Set-Location backend
npx prisma generate
npx prisma migrate dev --name init
Set-Location ..
```

## Шаг 5: Создание первого администратора (опционально)

Вы можете создать администратора через регистрацию, а затем вручную изменить в базе данных:

```sql
UPDATE users SET "isAdmin" = true WHERE email = 'admin@example.com';
```

## Шаг 6: Запуск проекта

### Вариант 1: Запуск всего проекта одновременно

```powershell
npm run dev
```

### Вариант 2: Запуск по отдельности

**Терминал 1 - Backend:**

```powershell
npm run dev:backend
```

**Терминал 2 - Frontend:**

```powershell
npm run dev:frontend
```

## Доступ к приложению

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000/api
- **Health Check**: http://localhost:5000/health

## Структура URL

- Главная страница: http://localhost:5173/
- Регистрация: http://localhost:5173/register
- Вход: http://localhost:5173/login
- Панель управления: http://localhost:5173/dashboard
- Админ-панель: http://localhost:5173/admin
- Меню ресторана: http://localhost:5173/menu/{subdomain}

## Тестирование

### Создание тестового ресторана

1. Перейдите на http://localhost:5173/register
2. Заполните форму регистрации:
   - Имя: Test User
   - Email: test@example.com
   - Пароль: test123
   - Название ресторана: Test Restaurant
   - Субдомен: testrestaurant
3. После регистрации вы получите 7 дней пробного периода
4. Меню будет доступно по адресу: http://localhost:5173/menu/testrestaurant

## Prisma Studio (для просмотра базы данных)

```powershell
Set-Location backend
npx prisma studio
```

Откроется веб-интерфейс на http://localhost:5555

## Решение проблем

### Ошибка подключения к базе данных

Проверьте:

- PostgreSQL запущен
- DATABASE_URL в backend/.env правильный
- База данных создана
- Пользователь имеет права доступа

### Ошибка CORS

Убедитесь, что в backend/.env указан правильный FRONTEND_URL

### Ошибка загрузки файлов

Убедитесь, что директория backend/uploads существует и доступна для записи

### Ошибка отправки email

Для Gmail:

1. Включите двухфакторную аутентификацию
2. Создайте пароль приложения: https://myaccount.google.com/apppasswords
3. Используйте этот пароль в SMTP_PASS

## Следующие шаги

1. Добавьте категории и блюда через панель управления
2. Загрузите баннеры для слайдера
3. Настройте информацию о ресторане
4. Протестируйте заказ через WhatsApp
5. Настройте production окружение для деплоя

## Production деплой

### Backend (Render/Heroku/DigitalOcean)

1. Настройте PostgreSQL в облаке
2. Установите переменные окружения
3. Запустите миграции: `npx prisma migrate deploy`
4. Запустите: `npm start`

### Frontend (Vercel/Netlify)

1. Подключите GitHub репозиторий
2. Установите VITE_API_URL на production URL backend
3. Build command: `npm run build`
4. Output directory: `dist`

## Поддержка

При возникновении проблем проверьте:

- Логи backend в консоли
- Логи frontend в консоли браузера (F12)
- Логи базы данных PostgreSQL
