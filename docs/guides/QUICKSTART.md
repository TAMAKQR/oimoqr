# 🚀 Быстрый старт QR Menu SaaS

## Минимальная установка (5 минут)

### 1. Установка зависимостей

```powershell
# В корневой директории проекта
npm install
```

### 2. Настройка базы данных

Создайте PostgreSQL базу данных:

```sql
CREATE DATABASE qr_menu_db;
```

### 3. Настройка переменных окружения

**backend/.env:**

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/qr_menu_db"
JWT_SECRET="my-secret-key-123"
PORT=5000
FRONTEND_URL=http://localhost:5173
TRIAL_PERIOD_DAYS=7

# Email (можно оставить пустым для тестирования)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="QR Menu <noreply@qrmenu.com>"
```

**frontend/.env:**

```env
VITE_API_URL=http://localhost:5000/api
```

### 4. Инициализация базы данных

```powershell
Set-Location backend
npx prisma generate
npx prisma migrate dev --name init
npm run seed
Set-Location ..
```

### 5. Запуск проекта

```powershell
npm run dev
```

## 🎉 Готово!

Откройте браузер:

- **Главная**: http://localhost:5173
- **Тестовое меню**: http://localhost:5173/menu/testrestaurant

### Тестовые аккаунты

**Администратор:**

- Email: admin@qrmenu.com
- Пароль: admin123

**Владелец ресторана:**

- Email: test@restaurant.com
- Пароль: test123

## Что дальше?

1. Войдите как владелец ресторана
2. Перейдите в панель управления
3. Добавьте свои категории и блюда
4. Загрузите фотографии
5. Настройте баннеры
6. Протестируйте заказ через WhatsApp

## Полезные команды

```powershell
# Просмотр базы данных
Set-Location backend; npx prisma studio

# Создать нового администратора
Set-Location backend; npm run create-admin email@example.com password123 "Admin Name"

# Пересоздать базу данных
Set-Location backend; npx prisma migrate reset

# Заполнить тестовыми данными
Set-Location backend; npm run seed
```

## Проблемы?

Смотрите полную инструкцию в [SETUP.md](./SETUP.md)
