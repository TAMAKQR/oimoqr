# Полный обзор проекта OimoQR

## 1) Что это за проект

**OimoQR** — SaaS-платформа для ресторанов/кафе/баров и онлайн-магазинов с цифровым меню по QR-коду, админ-панелью, поддержкой заказов и интеграциями (WhatsApp/Telegram). Проект построен как monorepo с отдельными frontend и backend пакетами.

## 2) Технологический стек

### Frontend
- React 18 + React Router 6
- Vite 5
- TailwindCSS
- Zustand для состояния
- Axios для API
- i18next для локализации
- Capacitor (Android/iOS), PWA-подход

### Backend
- Node.js + Express
- Prisma ORM
- PostgreSQL (prod), env-конфигурация через dotenv
- JWT + bcryptjs
- Дополнительно: Cloudinary, Twilio, Telegram Bot API, Nodemailer

## 3) Архитектура репозитория

- `frontend/` — клиентская часть (страницы, компоненты, store, сервисы)
- `backend/` — API, middleware, контроллеры, роуты, Prisma schema
- `docs/` — документация по функциональности, деплою, изменениям
- корневые scripts — бэкап, pre-deploy checks, миграционные утилиты

## 4) Frontend: ключевые наблюдения

1. **Центральная маршрутизация в `App.jsx`**:
   - публичные, customer-, private- и admin-маршруты;
   - кэш-баст логика (очистка Cache API + SW update + reload);
   - обработка mobile visual viewport для корректного `bottom-fixed` UI.

2. **Слой API (`services/api.js`)**:
   - axios instance с request/response interceptors;
   - разделение customer/admin токенов;
   - автоматический redirect на login при 401.

3. **Функциональные зоны UI**:
   - управление меню (`MenuManagementPage`), настройки ресторана, персонал;
   - customer flow (логин, профиль, заказы);
   - онлайн-магазин (`ShopPage`, корзина, checkout);
   - мультивалютность, локализация, темы.

## 5) Backend: ключевые наблюдения

1. **`server.js` как точка композиции**:
   - security middleware (`helmet`), CORS, compression;
   - rate limit на `/api`;
   - JSON/body limits повышены для загрузки изображений;
   - statics для `/uploads`;
   - централизованное подключение роутов.

2. **Контроллерная структура**:
   - `auth`, `restaurant`, `category`, `dish`, `orders`, `pricing`, `analytics` и др.;
   - отдельные customer-контроллеры;
   - административные и интеграционные endpoints (Telegram).

3. **Middleware-слой**:
   - auth/customerAuth;
   - validation;
   - upload;
   - trackView;
   - error handler.

## 6) Модель данных (Prisma)

Ключевые сущности:
- `User`, `Restaurant`, `RestaurantStaff`, `Subscription`
- меню: `CategoryGroup`, `Category`, `Dish`
- кастомизация блюд: `Modifier`, `ModifierOption`, `ModifierTemplate`, `ModifierTemplateOption`
- клиенты и взаимодействие: `Customer`, `CustomerFavorite`, `Order`, `OrderItem`
- e-commerce слой: `ProductCategory`, `Product`
- мультиязычность: `RestaurantLanguage`, `DishTranslation`, `CategoryTranslation`

Вывод: модель покрывает как классическое QR-меню, так и online-store сценарии.

## 7) Операционные и продуктовые сильные стороны

- Разделение ролей (admin/owner/staff/customer)
- Наличие trial/subscription сущностей
- Богатая документация в `docs/`
- Практичные скрипты для импорта/экспорта/seed
- Готовность к мобильной упаковке через Capacitor

## 8) Риски и зоны для улучшения

1. **Технический долг в репозитории**
   - Встречаются backup/legacy артефакты (`*.backup.js`, `BACKUP_INFO.txt`) — лучше вынести в архив.

2. **CORS/policy строгость**
   - В production-ветке CORS сейчас фактически permissive; для enterprise-сценариев стоит ужесточить whitelist.

3. **Наблюдаемость**
   - Есть консольное логирование, но нет явного централизованного structured logging/metrics/tracing слоя.

4. **Тестовое покрытие**
   - В проекте не видно явной тестовой матрицы unit/integration/e2e в кодовой структуре (есть в основном docs и ручные чеклисты).

## 9) Практический план следующего шага

1. Зафиксировать архитектурное ADR по auth/token flows и CORS policy.
2. Добавить минимальный CI quality gate:
   - backend smoke tests,
   - frontend build + route smoke.
3. Вычистить backup-файлы из runtime-каталогов.
4. Добавить health/ready endpoints с проверкой доступности БД.

## 10) Итог

Проект зрелый по функциональности, уже ориентирован на прод-сценарии и коммерческое использование. Главный потенциал улучшения — в **операционной дисциплине** (наблюдаемость, тестирование, security policy hardening) и небольшом **cleanup технического долга**.
