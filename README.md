# 🍽️ OimoQR - Цифровое меню для ресторанов

**OimoQR** - это SaaS платформа для создания цифровых QR-меню для ресторанов, кафе и баров.

## 🎯 Основные возможности

- 📱 **QR-меню** - гости сканируют код и видят меню на телефонах
- 🛒 **Заказ в WhatsApp** - интеграция с мессенджером
- ⚡ **Быстрое обновление** - изменяйте меню в реальном времени
- 🎨 **Баннер-слайдер** - акции и спецпредложения
- 💱 **Мультивалютность** - 12 поддерживаемых валют
- 📸 **Фото блюд** - загрузка изображений
- 🔧 **Модификаторы** - размеры, добавки, соусы
- 🌐 **Уникальные поддомены** - `ваш-ресторан.oimoqr.com`

Новый комит

## 🏗️ Технологический стек

**Frontend:**

- React 18, React Router 6, TailwindCSS
- Zustand (state), Axios, Swiper
- i18next (многоязычность)

**Backend:**

- Node.js + Express, Prisma ORM
- SQLite (локальная разработка)
- JWT аутентификация, Bcrypt

## 📁 Структура проекта

```
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── server.js
│   └── prisma/
│       ├── schema.prisma
│       └── migrations/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── store/
│   └── vite.config.js
│
└── docs/
```

## 🚀 Быстрый старт

### Требования

- Node.js >= 18.0.0
- npm или yarn

### Установка и запуск

```bash
# Клонируйте репозиторий
git clone <repository-url>
cd oimoqr

# Установите зависимости
npm run install:all

# Создайте .env файлы из примеров
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Запустите миграции БД (опционально, БД создастся автоматически)
cd backend
npx prisma migrate deploy
cd ..

# Запустите приложение (frontend + backend одновременно)
npm run dev
```

Приложение будет доступна:

- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:5000

### Отдельный запуск

```bash
# Только frontend
npm run dev:frontend

# Только backend
npm run dev:backend
```

## 🗄️ База данных

Проект использует **SQLite** для локальной разработки:

- БД файл: `backend/prisma/dev.db`
- Миграции: `backend/prisma/migrations/`

Для работы с БД:

```bash
cd backend

# Просмотр БД в Prisma Studio
npx prisma studio

# Примените миграции
npx prisma migrate deploy

# Создайте новую миграцию (если меняли schema)
npx prisma migrate dev --name migration_name
```

## 📝 Переменные окружения

**Backend** (`backend/.env`):

```
DATABASE_URL=file:./prisma/dev.db
JWT_SECRET=your-secret-key
PORT=5000
NODE_ENV=development
```

**Frontend** (`frontend/.env`):

```
VITE_API_URL=http://localhost:5000/api
```

## 🧪 Тестовые данные

Используйте миграции и seed скрипты:

```bash
cd backend
npm run seed
```

## 📚 Документация

- [TODO.md](docs/TODO.md) - планы на развитие
- [DOCUMENTATION_INDEX.md](docs/DOCUMENTATION_INDEX.md) - полный индекс

## 🤝 Вклад в проект

1. Форкните репозиторий
2. Создайте ветку для вашей функции
3. Закоммитьте изменения
4. Откройте Pull Request

## 📝 Лицензия

MIT License - см. [LICENSE](LICENSE)

## 👨‍💻 Команда

**OimoQR Team**

- Website: https://oimoqr.com
- Email: support@oimoqr.com
