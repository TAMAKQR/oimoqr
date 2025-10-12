# 📊 OimoQR - Сводка проекта

Полная информация о проекте OimoQR для быстрого ознакомления.

---

## 🎯 О проекте

**OimoQR** - это SaaS платформа для создания цифровых QR-меню для ресторанов. Каждый ресторан получает уникальный поддомен и может управлять меню в реальном времени.

### Ключевые особенности

- 🌐 **Уникальные поддомены**: `ваш-ресторан.oimoqr.com`
- 📱 **QR-меню**: Гости сканируют код и видят меню
- 🛒 **Заказ в WhatsApp**: Прямо из меню
- ⚡ **Реал-тайм обновления**: Меняйте цены мгновенно
- 💱 **12 валют**: Поддержка разных стран
- 🎨 **Баннер-слайдер**: Акции и предложения
- 📸 **Фотографии блюд**: Красивое оформление

---

## 🏗️ Архитектура

### Технологии

```
Frontend:  React 18 + TailwindCSS + Vite
Backend:   Node.js + Express + Prisma
Database:  PostgreSQL (Supabase)
Hosting:   Vercel (Frontend) + Render (Backend)
```

### Структура доменов

```
oimoqr.com              → Главная, регистрация, дашборд
api.oimoqr.com          → Backend API
*.oimoqr.com            → Меню ресторанов (wildcard)
  ├─ demo.oimoqr.com    → Демо ресторан
  ├─ pizza.oimoqr.com   → Пиццерия
  └─ ...
```

---

## 📁 Структура проекта

```
oimoqr/
├── frontend/                    # React приложение
│   ├── src/
│   │   ├── components/         # UI компоненты
│   │   │   ├── Cart.jsx        # Корзина
│   │   │   ├── DishCard.jsx    # Карточка блюда
│   │   │   ├── DishModal.jsx   # Модальное окно блюда
│   │   │   └── ...
│   │   ├── pages/              # Страницы
│   │   │   ├── HomePage.jsx    # Главная
│   │   │   ├── LoginPage.jsx   # Вход
│   │   │   ├── RegisterPage.jsx # Регистрация
│   │   │   ├── DashboardPage.jsx # Дашборд
│   │   │   ├── MenuManagementPage.jsx # Управление меню
│   │   │   ├── RestaurantSettingsPage.jsx # Настройки
│   │   │   ├── MenuPage.jsx     # Публичное меню
│   │   │   └── AdminPage.jsx    # Админ-панель
│   │   ├── services/           # API сервисы
│   │   │   ├── authService.js
│   │   │   ├── restaurantService.js
│   │   │   └── menuService.js
│   │   ├── store/              # Zustand stores
│   │   │   ├── authStore.js
│   │   │   └── cartStore.js
│   │   └── main.jsx            # Точка входа
│   ├── public/
│   └── package.json
│
├── backend/                     # Express API
│   ├── src/
│   │   ├── controllers/        # Бизнес-логика
│   │   │   ├── authController.js
│   │   │   ├── restaurantController.js
│   │   │   ├── categoryController.js
│   │   │   ├── dishController.js
│   │   │   └── adminController.js
│   │   ├── routes/             # API маршруты
│   │   │   ├── auth.routes.js
│   │   │   ├── restaurant.routes.js
│   │   │   ├── category.routes.js
│   │   │   ├── dish.routes.js
│   │   │   └── admin.routes.js
│   │   ├── middleware/         # Middleware
│   │   │   ├── auth.js         # JWT аутентификация
│   │   │   ├── upload.js       # Multer загрузка файлов
│   │   │   ├── errorHandler.js
│   │   │   └── rateLimiter.js
│   │   ├── utils/              # Утилиты
│   │   ├── scripts/            # Скрипты
│   │   │   ├── seedDatabase.js
│   │   │   └── createAdmin.js
│   │   └── server.js           # Точка входа
│   ├── prisma/
│   │   ├── schema.prisma       # Схема БД
│   │   └── migrations/         # Миграции
│   ├── uploads/                # Загруженные файлы
│   └── package.json
│
├── docs/                        # Документация
│   ├── README.md               # Обзор проекта
│   ├── START_HERE.md           # Начало работы
│   ├── QUICKSTART.md           # Быстрый старт
│   ├── CHEATSHEET.md           # Шпаргалка
│   ├── API.md                  # API документация
│   ├── COMMANDS.md             # Команды
│   ├── DEPLOY_GUIDE_V1.md      # Руководство по деплою
│   ├── DOMAIN_SETUP.md         # Настройка домена
│   ├── QUICK_DEPLOY.md         # Быстрый деплой
│   ├── PRE_DEPLOY_CHECKLIST.md # Чеклист
│   ├── POST_DEPLOY.md          # После деплоя
│   ├── BRANDING.md             # Брендинг
│   ├── CHANGELOG.md            # История изменений
│   └── PROJECT_SUMMARY.md      # Этот файл
│
├── .gitignore
├── package.json                # Root package.json (workspaces)
└── README.md
```

---

## 🗄️ База данных

### Модели Prisma

```prisma
User {
  id, email, password, name, phone, isAdmin
  restaurant → Restaurant
}

Restaurant {
  id, name, subdomain, currency, whatsapp, instagram, facebook, telegram
  deliveryInfo, contactInfo
  owner → User
  subscription → Subscription
  categories → Category[]
  banners → Banner[]
}

Subscription {
  id, status (TRIAL/ACTIVE/EXPIRED), trialEndsAt, currentPeriodEnd
  restaurant → Restaurant
}

Category {
  id, name, description, imageUrl, order
  restaurant → Restaurant
  dishes → Dish[]
}

Dish {
  id, name, description, price, imageUrl, order
  category → Category
  modifiers → Modifier[]
}

Modifier {
  id, name, price
  dish → Dish
}

Banner {
  id, imageUrl, order
  restaurant → Restaurant
}
```

### Связи

- User 1:1 Restaurant (владелец)
- Restaurant 1:1 Subscription
- Restaurant 1:N Category
- Restaurant 1:N Banner
- Category 1:N Dish
- Dish 1:N Modifier

---

## 🔐 Аутентификация и авторизация

### JWT токены

```javascript
// Payload
{
  userId: number,
  email: string,
  isAdmin: boolean
}

// Expires: 7 дней (настраивается)
```

### Роли

- **Owner** - Владелец ресторана (может управлять своим рестораном)
- **Admin** - Администратор платформы (может управлять всеми ресторанами)

### Защищенные маршруты

```javascript
// Frontend
<PrivateRoute>     // Требует аутентификации
<AdminRoute>       // Требует isAdmin = true

// Backend
authMiddleware     // Проверяет JWT токен
```

---

## 📡 API Endpoints

### Публичные

```
GET  /health                           # Health check
GET  /api/restaurants/:subdomain       # Получить ресторан по субдомену
GET  /api/restaurants/:id/categories   # Получить категории ресторана
GET  /api/categories/:id/dishes        # Получить блюда категории
```

### Аутентификация

```
POST /api/auth/register   # Регистрация
POST /api/auth/login      # Вход
GET  /api/auth/me         # Текущий пользователь
```

### Рестораны (требует auth)

```
PUT  /api/restaurants/:id                # Обновить ресторан
POST /api/restaurants/:id/upload-banner  # Загрузить баннер
```

### Меню (требует auth)

```
POST   /api/categories              # Создать категорию
PUT    /api/categories/:id          # Обновить категорию
DELETE /api/categories/:id          # Удалить категорию
POST   /api/dishes                  # Создать блюдо
PUT    /api/dishes/:id              # Обновить блюдо
DELETE /api/dishes/:id              # Удалить блюдо
POST   /api/dishes/:id/upload-image # Загрузить фото блюда
```

### Админ (требует isAdmin)

```
GET /api/admin/restaurants         # Все рестораны
PUT /api/admin/subscriptions/:id   # Обновить подписку
```

---

## 🎨 UI/UX компоненты

### Основные компоненты

- **DishCard** - Карточка блюда в меню
- **DishModal** - Модальное окно с деталями блюда
- **Cart** - Корзина для заказа
- **BannerSlider** - Слайдер баннеров (Swiper)

### Стили

- **TailwindCSS** - utility-first CSS
- **Цветовая схема**: Primary (blue-600), Gray
- **Responsive**: Mobile-first подход
- **Анимации**: Transitions, hover эффекты

### Страницы

1. **HomePage** - Лендинг с описанием сервиса
2. **LoginPage** - Вход в систему
3. **RegisterPage** - Регистрация ресторана
4. **DashboardPage** - Панель управления владельца
5. **MenuManagementPage** - Управление меню
6. **RestaurantSettingsPage** - Настройки ресторана
7. **MenuPage** - Публичное меню (для гостей)
8. **AdminPage** - Админ-панель

---

## 💰 Бизнес-модель

### Подписка

- **Trial**: 7 дней бесплатно (автоматически при регистрации)
- **Active**: Платная подписка (управляется админом)
- **Expired**: Истекшая подписка (ресторан неактивен)

### Ценообразование (планируется)

- **Базовый**: $10/месяц - 1 ресторан, базовые функции
- **Стандарт**: $25/месяц - 1 ресторан, все функции
- **Премиум**: $50/месяц - до 3 ресторанов, приоритетная поддержка

---

## 🚀 Деплой

### Платформы

- **Frontend**: Vercel (Free tier)
  - Automatic deployments from GitHub
  - SSL certificates
  - Wildcard domains support
- **Backend**: Render (Free tier)
  - Auto-sleep after 15 min inactivity
  - 512MB RAM
  - Custom domain support
- **Database**: Supabase (Free tier)
  - 500MB storage
  - 2GB bandwidth/month
  - Automatic backups

### Environment Variables

**Backend (Render)**:

```env
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://...?pgbouncer=true&connection_limit=1
JWT_SECRET=random-32-chars-string
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://oimoqr.com
```

**Frontend (Vercel)**:

```env
VITE_API_URL=https://api.oimoqr.com/api
```

### DNS настройки

```
@ (root)     A      76.76.21.21
www          CNAME  cname.vercel-dns.com
api          CNAME  ваш-проект.onrender.com
* (wildcard) CNAME  cname.vercel-dns.com
```

---

## 📊 Метрики и мониторинг

### Технические метрики

- **Uptime**: Цель > 99.5%
- **Response time**: Цель < 500ms
- **Error rate**: Цель < 1%
- **Database size**: Лимит 500MB (free tier)

### Бизнес метрики

- **Регистрации**: Новые рестораны
- **Конверсия**: Trial → Paid
- **Churn rate**: Отток клиентов
- **MRR**: Monthly Recurring Revenue
- **Просмотры меню**: Количество просмотров
- **Заказы**: Количество заказов через WhatsApp

### Инструменты

- **Vercel Analytics** - Web analytics
- **Render Logs** - Backend логи
- **Supabase Dashboard** - Database metrics
- **UptimeRobot** - Uptime мониторинг

---

## 🔒 Безопасность

### Реализовано

- ✅ JWT аутентификация
- ✅ Bcrypt хеширование паролей (10 rounds)
- ✅ CORS с whitelist доменов + wildcard
- ✅ Rate limiting (100 req/15min)
- ✅ Helmet.js для HTTP заголовков
- ✅ Input валидация (express-validator)
- ✅ SQL injection защита (Prisma ORM)
- ✅ XSS защита
- ✅ File upload валидация (размер, тип)

### Best practices

- Секреты в environment variables
- .env файлы в .gitignore
- HTTPS везде (SSL certificates)
- Регулярные обновления зависимостей
- Минимальные права доступа

---

## 📚 Документация

### Для разработчиков

- [START_HERE.md](./START_HERE.md) - Начните здесь
- [QUICKSTART.md](./QUICKSTART.md) - Быстрый старт
- [CHEATSHEET.md](./CHEATSHEET.md) - Шпаргалка
- [API.md](./API.md) - API документация
- [COMMANDS.md](./COMMANDS.md) - Команды

### Для деплоя

- [DEPLOY_GUIDE_V1.md](./DEPLOY_GUIDE_V1.md) - Полное руководство
- [DOMAIN_SETUP.md](./DOMAIN_SETUP.md) - Настройка домена
- [QUICK_DEPLOY.md](./QUICK_DEPLOY.md) - Быстрый деплой
- [PRE_DEPLOY_CHECKLIST.md](./PRE_DEPLOY_CHECKLIST.md) - Чеклист
- [POST_DEPLOY.md](./POST_DEPLOY.md) - После деплоя

### Для бизнеса

- [BRANDING.md](./BRANDING.md) - Брендинг и стиль
- [CHANGELOG.md](./CHANGELOG.md) - История изменений
- [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) - Этот файл

---

## 🎯 Roadmap

### v1.0 (Текущая) ✅

- Регистрация и аутентификация
- Управление меню
- Публичное меню с заказом в WhatsApp
- Админ-панель
- Мультивалютность

### v1.1 (Планируется)

- Статистика и аналитика
- Темы оформления
- Мультиязычность
- Email уведомления
- Интеграция с платежными системами

### v2.0 (Будущее)

- Мобильное приложение
- Telegram бот
- Интеграция с доставкой
- Программа лояльности
- Расширенная аналитика

---

## 👥 Команда

**OimoQR Team**

- Website: https://oimoqr.com
- Email: support@oimoqr.com
- GitHub: https://github.com/ваш-username/oimoqr

---

## 📄 Лицензия

MIT License - см. [LICENSE](LICENSE)

---

## 🙏 Благодарности

Проект использует следующие open-source библиотеки:

- React, Express, Prisma, TailwindCSS
- И многие другие (см. package.json)

Спасибо всем контрибьюторам! ❤️

---

**Последнее обновление**: Январь 2024  
**Версия**: 1.0.0  
**Статус**: Production Ready 🚀
