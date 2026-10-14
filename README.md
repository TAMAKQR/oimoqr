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
- 💳 **Оплата тарифов через Finik** - разовая предоплата в KGS на месяц или год

Новый комит

## 🏗️ Технологический стек

**Frontend:**

- React 18, React Router 6, TailwindCSS
- Zustand (state), Axios, Swiper
- i18next (многоязычность)

**Backend:**

- Node.js + Express, Prisma ORM
- PostgreSQL (Render - Ohio)
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

- Node.js >= 20.0.0
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

# Только для одноразовой локальной dev-БД синхронизируйте схему.
# Для staging/production сначала прочитайте migration gate Finik ниже.
cd backend
npx prisma generate
npx prisma db push
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

Проект использует **PostgreSQL** через Prisma. Исторически production синхронизировался через `prisma db push`, а старый versioned migration chain требует отдельного baseline/reconcile. Не запускайте `migrate deploy` на существующей production-БД вслепую и не используйте `db push --accept-data-loss`: переход Stripe → Finik содержит явные SQL-переименования для сохранения данных. Порядок действий описан в [инструкции Finik](docs/FINIK_BILLING_SETUP.md#5-обновите-схему-бд-без-потери-данных).

Для работы с БД:

```bash
cd backend

# Просмотр БД в Prisma Studio
npx prisma studio

# Только для одноразовой локальной dev-БД, без --accept-data-loss.
# Для новой staging/production нужен проверенный consolidated baseline.
npx prisma db push

# Создайте новую миграцию (если меняли schema)
npx prisma migrate dev --name migration_name
```

## 📝 Переменные окружения

**Backend** (`backend/.env`):

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
DIRECT_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
JWT_SECRET=your-secret-key
PORT=5000
NODE_ENV=development
FINIK_MODE=beta
FINIK_API_KEY=replace-with-beta-api-key
FINIK_ACCOUNT_ID=replace-with-beta-account-id
FINIK_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
FINIK_WEBHOOK_URL=https://your-public-backend.example/api/billing/finik/webhook
```

`FINIK_PRIVATE_KEY` остаётся только на backend. Для локальной проверки webhook также нужен публичный HTTPS URL (например, через доверенный tunnel). Полный список переменных и переход в production описаны в инструкции Finik.

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
- [FINIK_BILLING_SETUP.md](docs/FINIK_BILLING_SETUP.md) - настройка оплаты тарифов через Finik

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
