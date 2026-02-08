# 🧪 Руководство по тестированию

> Полное руководство по тестированию QR Menu SaaS Platform

---

## 📋 Содержание

- [Быстрый старт](#-быстрый-старт)
- [Типы тестов](#-типы-тестов)
- [Ручное тестирование](#-ручное-тестирование)
- [API тестирование](#-api-тестирование)
- [E2E тестирование](#-e2e-тестирование)
- [Тестовые данные](#-тестовые-данные)
- [Чек-листы](#-чек-листы)

---

## 🚀 Быстрый старт

### Подготовка тестовой среды

```powershell
# 1. Запустить проект
npm run dev

# 2. Создать тестовые данные
Set-Location "d:\QR MENU\backend"
node prisma/seed.js

# 3. Открыть в браузере
# Frontend: http://localhost:5173
# Backend: http://localhost:5000
```

### Тестовые аккаунты

```
Владелец ресторана:
Email: test@restaurant.com
Password: test123
Restaurant: Test Restaurant
Subdomain: testrestaurant

Администратор:
Email: admin@oimoqr.com
Password: admin123
Role: admin
```

---

## 🎯 Типы тестов

### 1. Ручное тестирование (Manual Testing)

- ✅ Функциональное тестирование UI
- ✅ Тестирование пользовательских сценариев
- ✅ Кросс-браузерное тестирование
- ✅ Адаптивный дизайн

### 2. API тестирование

- ✅ Тестирование endpoints
- ✅ Валидация данных
- ✅ Обработка ошибок
- ✅ Аутентификация и авторизация

### 3. E2E тестирование (End-to-End)

- ✅ Полные пользовательские сценарии
- ✅ Интеграционное тестирование
- ✅ Тестирование бизнес-процессов

### 4. Нагрузочное тестирование

- ✅ Производительность API
- ✅ Время отклика
- ✅ Обработка множественных запросов

---

## 🖱️ Ручное тестирование

### Сценарий 1: Регистрация нового ресторана

**Цель:** Проверить процесс регистрации

**Шаги:**

1. Открыть http://localhost:5173/register
2. Заполнить форму:
   - Email: `newrestaurant@test.com`
   - Password: `password123`
   - Restaurant Name: `New Restaurant`
   - Subdomain: `newrestaurant`
   - Phone: `+1234567890`
3. Нажать "Register"

**Ожидаемый результат:**

- ✅ Редирект на dashboard
- ✅ Отображается приветственное сообщение
- ✅ Создан ресторан с trial подпиской (7 дней)
- ✅ Получен JWT token
- ✅ Email уведомление отправлено

**Проверки:**

```sql
-- Проверить в БД
SELECT * FROM "User" WHERE email = 'newrestaurant@test.com';
SELECT * FROM "Restaurant" WHERE subdomain = 'newrestaurant';
SELECT * FROM "Subscription" WHERE "restaurantId" = (
  SELECT id FROM "Restaurant" WHERE subdomain = 'newrestaurant'
);
```

---

### Сценарий 2: Создание меню

**Цель:** Проверить создание категорий и блюд

**Предусловия:**

- Пользователь авторизован как владелец ресторана

**Шаги:**

#### 2.1. Создание категории

1. Перейти на страницу Menu Management
2. Нажать "+ Add Category"
3. Заполнить:
   - Name: `Pizza`
   - Icon: `🍕`
4. Нажать "Save"

**Ожидаемый результат:**

- ✅ Категория создана
- ✅ Отображается в списке категорий
- ✅ Toast уведомление "Category created"

#### 2.2. Создание блюда

1. Выбрать категорию "Pizza"
2. Нажать "+ Add Dish"
3. Заполнить:
   - Name: `Margherita`
   - Description: `Classic Italian pizza`
   - Price: `12.99`
4. Загрузить изображение (JPG/PNG, < 5MB)
5. Добавить модификатор:
   - Name: `Size`
   - Options: `Small, Medium, Large`
   - Prices: `0, 2, 4`
6. Нажать "Save"

**Ожидаемый результат:**

- ✅ Блюдо создано
- ✅ Изображение загружено
- ✅ Модификаторы сохранены
- ✅ Блюдо отображается в категории

---

### Сценарий 3: Управление изображениями и прогресс загрузки

**Цель:** Проверить новые UX-функции: видимость фото, удаление изображений, прогресс-бар загрузки

**Предусловия:**

- Пользователь авторизован как владелец ресторана
- Создана хотя бы одна категория

**Шаги:**

#### 3.1. Проверка видимости фото блюд

1. Перейти на страницу Menu Management
2. Выбрать категорию с блюдами
3. Нажать на блюдо для редактирования
4. Проверить отображение текущего фото (если есть)

**Ожидаемый результат:**

- ✅ Фото отображается в полном размере (w-full h-48)
- ✅ Изображение четко видно в модальном окне
- ✅ Кнопка удаления (красный крестик) видна в правом верхнем углу

#### 3.2. Загрузка фото с прогресс-баром

1. В модальном окне блюда нажать "Выбрать файл"
2. Выбрать изображение (желательно > 1MB для видимого прогресса)
3. Нажать "Сохранить"
4. Наблюдать за процессом загрузки

**Ожидаемый результат:**

- ✅ Появляется предпросмотр выбранного файла
- ✅ Отображается сообщение "✓ Выбран файл: [имя файла]"
- ✅ При загрузке появляется синий прогресс-бар
- ✅ Отображается процент загрузки (0-100%)
- ✅ Полоса прогресса плавно заполняется
- ✅ После завершения блюдо обновляется с новым фото

#### 3.3. Удаление фото блюда

1. Открыть блюдо с фото
2. Навести курсор на изображение
3. Нажать красную кнопку с крестиком
4. Подтвердить удаление

**Ожидаемый результат:**

- ✅ Появляется диалог подтверждения
- ✅ После подтверждения фото удаляется
- ✅ Отображается сообщение "Изображение удалено"
- ✅ Поле для загрузки нового фото становится доступным

#### 3.4. Управление баннерами

1. Перейти в Restaurant Settings
2. Прокрутить до секции "Баннеры"
3. Проверить отображение текущих баннеров (если есть)
4. Навести курсор на баннер

**Ожидаемый результат:**

- ✅ Баннеры отображаются в сетке (grid)
- ✅ При наведении появляется кнопка удаления (hover-эффект)
- ✅ Кнопка удаления имеет красный цвет

#### 3.5. Загрузка баннера с прогрессом

1. Нажать "Выбрать файл" в секции баннеров
2. Выбрать изображение (рекомендуется 1200x400px)
3. Нажать "Сохранить изменения"
4. Наблюдать за загрузкой

**Ожидаемый результат:**

- ✅ Появляется предпросмотр баннера
- ✅ Отображается "✓ Выбран файл: [имя]"
- ✅ При загрузке показывается прогресс-бар с процентами
- ✅ Текст "Загрузка баннера..." и процент (например, "45%")
- ✅ Синяя полоса прогресса заполняется плавно
- ✅ После загрузки баннер добавляется к существующим

#### 3.6. Удаление баннера

1. Навести курсор на любой баннер
2. Дождаться появления кнопки удаления
3. Нажать кнопку удаления
4. Подтвердить действие

**Ожидаемый результат:**

- ✅ Кнопка плавно появляется при наведении (opacity transition)
- ✅ Появляется диалог подтверждения
- ✅ Баннер удаляется из списка
- ✅ Страница обновляется автоматически

**Проверка в коде:**

```javascript
// MenuManagementPage.jsx - строки 483-541
// - Полноразмерное изображение: className="w-full h-48 object-cover rounded"
// - Кнопка удаления: handleDeleteImage()
// - Прогресс-бар: uploadProgress state (0-100%)

// RestaurantSettingsPage.jsx - строки 254-312
// - Hover-эффект: className="opacity-0 group-hover:opacity-100"
// - Удаление баннера: handleDeleteBanner()
// - Прогресс загрузки: uploadProgress с анимацией
```

**Проверка в DevTools:**

```javascript
// Проверить состояние загрузки
console.log("Upload Progress:", uploadProgress); // должно быть 0-100

// Проверить URL изображения
console.log("Current Image:", currentImageUrl);

// Проверить файл для загрузки
console.log("Selected File:", imageFile);
```

---

### Сценарий 4: Просмотр меню клиентом

**Цель:** Проверить публичное отображение меню

**Шаги:**

1. Открыть http://localhost:5173/menu/testrestaurant
2. Проверить отображение:
   - Название ресторана
   - Адрес и телефон
   - Социальные сети
   - Баннер-слайдер
   - Категории
   - Блюда с фото и ценами

**Ожидаемый результат:**

- ✅ Все данные отображаются корректно
- ✅ Баннер-слайдер работает (автопрокрутка)
- ✅ Категории кликабельны
- ✅ Изображения блюд загружаются
- ✅ Цены отформатированы правильно

---

### Сценарий 5: Оформление заказа

**Цель:** Проверить процесс добавления в корзину и заказа

**Шаги:**

1. Открыть меню ресторана
2. Выбрать блюдо "Margherita Pizza"
3. Выбрать модификаторы:
   - Size: Large (+$4)
   - Extra Cheese: Yes (+$2)
4. Нажать "Add to Cart"
5. Добавить еще одно блюдо
6. Открыть корзину
7. Проверить итоговую сумму
8. Нажать "Order via WhatsApp"

**Ожидаемый результат:**

- ✅ Блюда добавлены в корзину
- ✅ Модификаторы применены
- ✅ Сумма рассчитана правильно
- ✅ Открывается WhatsApp с предзаполненным сообщением
- ✅ Сообщение содержит все детали заказа

**Формат сообщения WhatsApp:**

```
🍽️ New Order from QR Menu

📋 Order Details:

1. Margherita Pizza
   - Size: Large
   - Extra Cheese: Yes
   - Quantity: 1
   - Price: $18.99

2. Pepperoni Pizza
   - Size: Medium
   - Quantity: 1
   - Price: $14.99

─────────────────────────────
Subtotal: $33.98
Delivery Fee: $5.00
Total: $38.98
─────────────────────────────

📍 Delivery Address:
[Customer will add]

📞 Contact:
[Customer will add]
```

---

### Сценарий 6: Управление подписками (Админ)

**Цель:** Проверить админ-панель

**Предусловия:**

- Авторизован как admin@oimoqr.com

**Шаги:**

1. Перейти на /admin
2. Просмотреть список ресторанов
3. Выбрать ресторан с истекшей подпиской
4. Нажать "Manage Subscription"
5. Изменить:
   - Plan: Monthly
   - Status: Active
   - End Date: +30 дней от текущей даты
6. Нажать "Save"

**Ожидаемый результат:**

- ✅ Подписка обновлена
- ✅ Email уведомление отправлено владельцу
- ✅ Статус изменен на "Active"
- ✅ Ресторан может снова использовать систему

---

## 🔌 API тестирование

### Инструменты

- **Postman** - GUI для тестирования API
- **cURL** - командная строка
- **Thunder Client** - VS Code extension

### Настройка Postman

1. Создать новую коллекцию "QR Menu API"
2. Добавить переменные окружения:

```json
{
  "baseUrl": "http://localhost:5000/api",
  "token": "",
  "restaurantId": "",
  "categoryId": "",
  "dishId": ""
}
```

---

### Тест 1: Регистрация

**Request:**

```http
POST {{baseUrl}}/auth/register
Content-Type: application/json

{
  "email": "apitest@restaurant.com",
  "password": "test123",
  "restaurantName": "API Test Restaurant",
  "subdomain": "apitest",
  "phone": "+1234567890"
}
```

**Expected Response (201):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "apitest@restaurant.com",
    "role": "owner"
  },
  "restaurant": {
    "id": 1,
    "name": "API Test Restaurant",
    "subdomain": "apitest",
    "phone": "+1234567890"
  }
}
```

**Тесты (Postman):**

```javascript
pm.test("Status code is 201", function () {
  pm.response.to.have.status(201);
});

pm.test("Response has token", function () {
  var jsonData = pm.response.json();
  pm.expect(jsonData.token).to.be.a("string");
  pm.environment.set("token", jsonData.token);
});

pm.test("Restaurant created", function () {
  var jsonData = pm.response.json();
  pm.expect(jsonData.restaurant.subdomain).to.eql("apitest");
  pm.environment.set("restaurantId", jsonData.restaurant.id);
});
```

---

### Тест 2: Вход

**Request:**

```http
POST {{baseUrl}}/auth/login
Content-Type: application/json

{
  "email": "test@restaurant.com",
  "password": "test123"
}
```

**Expected Response (200):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 2,
    "email": "test@restaurant.com",
    "role": "owner"
  }
}
```

**Тесты:**

```javascript
pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});

pm.test("Token received", function () {
  var jsonData = pm.response.json();
  pm.expect(jsonData.token).to.exist;
  pm.environment.set("token", jsonData.token);
});
```

---

### Тест 3: Создание категории

**Request:**

```http
POST {{baseUrl}}/categories
Content-Type: application/json
Authorization: Bearer {{token}}

{
  "restaurantId": {{restaurantId}},
  "name": "Pizza",
  "icon": "🍕"
}
```

**Expected Response (201):**

```json
{
  "id": 1,
  "restaurantId": 1,
  "name": "Pizza",
  "icon": "🍕",
  "order": 0,
  "createdAt": "2024-01-15T10:00:00.000Z"
}
```

**Тесты:**

```javascript
pm.test("Status code is 201", function () {
  pm.response.to.have.status(201);
});

pm.test("Category created", function () {
  var jsonData = pm.response.json();
  pm.expect(jsonData.name).to.eql("Pizza");
  pm.environment.set("categoryId", jsonData.id);
});
```

---

### Тест 4: Создание блюда

**Request:**

```http
POST {{baseUrl}}/dishes
Content-Type: application/json
Authorization: Bearer {{token}}

{
  "categoryId": {{categoryId}},
  "name": "Margherita Pizza",
  "description": "Classic Italian pizza with fresh mozzarella",
  "price": 12.99,
  "modifiers": [
    {
      "name": "Size",
      "options": [
        { "name": "Small", "price": 0 },
        { "name": "Medium", "price": 2 },
        { "name": "Large", "price": 4 }
      ]
    },
    {
      "name": "Extra Cheese",
      "price": 2.00
    }
  ]
}
```

**Expected Response (201):**

```json
{
  "id": 1,
  "categoryId": 1,
  "name": "Margherita Pizza",
  "description": "Classic Italian pizza with fresh mozzarella",
  "price": 12.99,
  "image": null,
  "modifiers": [...],
  "createdAt": "2024-01-15T10:00:00.000Z"
}
```

---

### Тест 5: Получение меню (публичный)

**Request:**

```http
GET {{baseUrl}}/restaurants/testrestaurant
```

**Expected Response (200):**

```json
{
  "restaurant": {
    "id": 1,
    "name": "Test Restaurant",
    "subdomain": "testrestaurant",
    "phone": "+1234567890",
    "whatsapp": "+1234567890",
    "address": "123 Main St",
    "instagram": "https://instagram.com/test",
    "facebook": "https://facebook.com/test",
    "twitter": "https://twitter.com/test",
    "deliveryEnabled": true,
    "deliveryFee": 5.00,
    "minimumOrder": 15.00,
    "banners": [...]
  },
  "categories": [
    {
      "id": 1,
      "name": "Pizza",
      "icon": "🍕",
      "dishes": [
        {
          "id": 1,
          "name": "Margherita Pizza",
          "description": "...",
          "price": 12.99,
          "image": "...",
          "modifiers": [...]
        }
      ]
    }
  ]
}
```

**Тесты:**

```javascript
pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});

pm.test("Restaurant data exists", function () {
  var jsonData = pm.response.json();
  pm.expect(jsonData.restaurant).to.exist;
  pm.expect(jsonData.categories).to.be.an("array");
});

pm.test("Categories have dishes", function () {
  var jsonData = pm.response.json();
  pm.expect(jsonData.categories[0].dishes).to.be.an("array");
});
```

---

### Тест 6: Загрузка изображения

**Request:**

```http
POST {{baseUrl}}/dishes/{{dishId}}/upload-image
Authorization: Bearer {{token}}
Content-Type: multipart/form-data

image: [file]
```

**Expected Response (200):**

```json
{
  "message": "Image uploaded successfully",
  "imageUrl": "/uploads/dishes/1234567890-pizza.jpg"
}
```

---

### Тест 7: Обновление подписки (Админ)

**Request:**

```http
PUT {{baseUrl}}/admin/subscriptions/1
Content-Type: application/json
Authorization: Bearer {{adminToken}}

{
  "plan": "monthly",
  "status": "active",
  "startDate": "2024-01-15",
  "endDate": "2024-02-15"
}
```

**Expected Response (200):**

```json
{
  "id": 1,
  "restaurantId": 1,
  "plan": "monthly",
  "status": "active",
  "startDate": "2024-01-15T00:00:00.000Z",
  "endDate": "2024-02-15T00:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:00.000Z"
}
```

---

### Тест 8: Обработка ошибок

#### 8.1. Неверные учетные данные

```http
POST {{baseUrl}}/auth/login
Content-Type: application/json

{
  "email": "wrong@email.com",
  "password": "wrongpassword"
}
```

**Expected Response (401):**

```json
{
  "error": "Invalid credentials"
}
```

#### 8.2. Отсутствие токена

```http
GET {{baseUrl}}/categories
```

**Expected Response (401):**

```json
{
  "error": "No token provided"
}
```

#### 8.3. Дубликат субдомена

```http
POST {{baseUrl}}/auth/register
Content-Type: application/json

{
  "email": "new@test.com",
  "password": "test123",
  "restaurantName": "New Restaurant",
  "subdomain": "testrestaurant"
}
```

**Expected Response (400):**

```json
{
  "error": "Subdomain already exists"
}
```

---

## 🤖 E2E тестирование

### Настройка (Playwright/Cypress)

**Установка Playwright:**

```powershell
npm install -D @playwright/test
npx playwright install
```

**playwright.config.js:**

```javascript
module.exports = {
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://localhost:5173",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    port: 5173,
  },
};
```

---

### E2E Тест 1: Полный цикл регистрации и создания меню

**tests/e2e/restaurant-setup.spec.js:**

```javascript
const { test, expect } = require("@playwright/test");

test("Restaurant owner can register and create menu", async ({ page }) => {
  // 1. Регистрация
  await page.goto("/register");
  await page.fill('input[name="email"]', "e2e@test.com");
  await page.fill('input[name="password"]', "test123");
  await page.fill('input[name="restaurantName"]', "E2E Restaurant");
  await page.fill('input[name="subdomain"]', "e2etest");
  await page.fill('input[name="phone"]', "+1234567890");
  await page.click('button[type="submit"]');

  // 2. Проверка редиректа на dashboard
  await expect(page).toHaveURL("/dashboard");
  await expect(page.locator("h1")).toContainText("Dashboard");

  // 3. Создание категории
  await page.click("text=Menu");
  await page.click("text=Add Category");
  await page.fill('input[name="name"]', "Pizza");
  await page.fill('input[name="icon"]', "🍕");
  await page.click('button:has-text("Save")');

  // 4. Проверка создания категории
  await expect(page.locator("text=Pizza")).toBeVisible();

  // 5. Создание блюда
  await page.click("text=Add Dish");
  await page.fill('input[name="name"]', "Margherita");
  await page.fill('textarea[name="description"]', "Classic pizza");
  await page.fill('input[name="price"]', "12.99");

  // Загрузка изображения
  const fileInput = await page.locator('input[type="file"]');
  await fileInput.setInputFiles("./tests/fixtures/pizza.jpg");

  await page.click('button:has-text("Save")');

  // 6. Проверка создания блюда
  await expect(page.locator("text=Margherita")).toBeVisible();
  await expect(page.locator("text=$12.99")).toBeVisible();
});
```

---

### E2E Тест 2: Клиент оформляет заказ

**tests/e2e/customer-order.spec.js:**

```javascript
const { test, expect } = require("@playwright/test");

test("Customer can browse menu and place order", async ({ page, context }) => {
  // 1. Открыть меню ресторана
  await page.goto("/menu/testrestaurant");

  // 2. Проверка отображения информации
  await expect(page.locator("h1")).toContainText("Test Restaurant");
  await expect(page.locator("text=+1234567890")).toBeVisible();

  // 3. Выбор категории
  await page.click("text=Pizza");

  // 4. Добавление блюда в корзину
  await page.click("text=Margherita Pizza");

  // Выбор модификаторов
  await page.click("text=Large");
  await page.check('input[name="extraCheese"]');

  await page.click('button:has-text("Add to Cart")');

  // 5. Проверка корзины
  await expect(page.locator(".cart-count")).toContainText("1");

  // 6. Открыть корзину
  await page.click(".cart-button");

  // 7. Проверка содержимого
  await expect(page.locator("text=Margherita Pizza")).toBeVisible();
  await expect(page.locator("text=Large")).toBeVisible();
  await expect(page.locator("text=Extra Cheese")).toBeVisible();

  // 8. Проверка суммы
  const total = await page.locator(".total-price").textContent();
  expect(total).toContain("$18.99"); // 12.99 + 4 (Large) + 2 (Cheese)

  // 9. Оформление заказа через WhatsApp
  const [newPage] = await Promise.all([
    context.waitForEvent("page"),
    page.click('button:has-text("Order via WhatsApp")'),
  ]);

  // 10. Проверка URL WhatsApp
  const url = newPage.url();
  expect(url).toContain("wa.me");
  expect(url).toContain("Margherita Pizza");
  expect(url).toContain("Large");
  expect(url).toContain("Extra Cheese");
});
```

---

### E2E Тест 3: Админ управляет подписками

**tests/e2e/admin-subscriptions.spec.js:**

```javascript
const { test, expect } = require("@playwright/test");

test("Admin can manage subscriptions", async ({ page }) => {
  // 1. Вход как админ
  await page.goto("/login");
  await page.fill('input[name="email"]', "admin@qrmenu.com");
  await page.fill('input[name="password"]', "admin123");
  await page.click('button[type="submit"]');

  // 2. Переход в админ-панель
  await page.goto("/admin");
  await expect(page.locator("h1")).toContainText("Admin Panel");

  // 3. Поиск ресторана
  await page.fill('input[placeholder="Search"]', "Test Restaurant");
  await page.click('button:has-text("Search")');

  // 4. Открыть управление подпиской
  await page.click('button:has-text("Manage")');

  // 5. Изменить подписку
  await page.selectOption('select[name="plan"]', "monthly");
  await page.selectOption('select[name="status"]', "active");

  // Установить дату окончания на +30 дней
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30);
  await page.fill('input[name="endDate"]', endDate.toISOString().split("T")[0]);

  await page.click('button:has-text("Save")');

  // 6. Проверка успешного обновления
  await expect(page.locator("text=Subscription updated")).toBeVisible();
  await expect(page.locator("text=Active")).toBeVisible();
});
```

---

## 📊 Тестовые данные

### Seed данные

**backend/prisma/seed.js:**

```javascript
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  // 1. Создать админа
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.create({
    data: {
      email: "admin@qrmenu.com",
      password: adminPassword,
      role: "admin",
    },
  });

  // 2. Создать тестового владельца
  const ownerPassword = await bcrypt.hash("test123", 10);
  const owner = await prisma.user.create({
    data: {
      email: "test@restaurant.com",
      password: ownerPassword,
      role: "owner",
    },
  });

  // 3. Создать ресторан
  const restaurant = await prisma.restaurant.create({
    data: {
      userId: owner.id,
      name: "Test Restaurant",
      subdomain: "testrestaurant",
      phone: "+1234567890",
      whatsapp: "+1234567890",
      address: "123 Main Street, City, Country",
      instagram: "https://instagram.com/testrestaurant",
      facebook: "https://facebook.com/testrestaurant",
      twitter: "https://twitter.com/testrestaurant",
      deliveryEnabled: true,
      deliveryFee: 5.0,
      minimumOrder: 15.0,
    },
  });

  // 4. Создать подписку (trial)
  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 7);

  await prisma.subscription.create({
    data: {
      restaurantId: restaurant.id,
      plan: "trial",
      status: "active",
      startDate: new Date(),
      endDate: trialEndDate,
    },
  });

  // 5. Создать категории
  const pizzaCategory = await prisma.category.create({
    data: {
      restaurantId: restaurant.id,
      name: "Pizza",
      icon: "🍕",
      order: 0,
    },
  });

  const burgerCategory = await prisma.category.create({
    data: {
      restaurantId: restaurant.id,
      name: "Burgers",
      icon: "🍔",
      order: 1,
    },
  });

  // 6. Создать блюда
  await prisma.dish.create({
    data: {
      categoryId: pizzaCategory.id,
      name: "Margherita Pizza",
      description:
        "Classic Italian pizza with fresh mozzarella, tomato sauce, and basil",
      price: 12.99,
      modifiers: {
        create: [
          {
            name: "Size",
            options: [
              { name: "Small", price: 0 },
              { name: "Medium", price: 2 },
              { name: "Large", price: 4 },
            ],
          },
          {
            name: "Extra Cheese",
            price: 2.0,
          },
        ],
      },
    },
  });

  await prisma.dish.create({
    data: {
      categoryId: pizzaCategory.id,
      name: "Pepperoni Pizza",
      description: "Spicy pepperoni with extra cheese",
      price: 14.99,
      modifiers: {
        create: [
          {
            name: "Size",
            options: [
              { name: "Small", price: 0 },
              { name: "Medium", price: 2 },
              { name: "Large", price: 4 },
            ],
          },
        ],
      },
    },
  });

  await prisma.dish.create({
    data: {
      categoryId: burgerCategory.id,
      name: "Classic Burger",
      description: "Beef patty with lettuce, tomato, and special sauce",
      price: 9.99,
      modifiers: {
        create: [
          {
            name: "Add Bacon",
            price: 2.0,
          },
          {
            name: "Extra Patty",
            price: 3.0,
          },
        ],
      },
    },
  });

  console.log("✅ Seed data created successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**Запуск:**

```powershell
Set-Location "d:\QR MENU\backend"
node prisma/seed.js
```

---

## ✅ Чек-листы тестирования

### Чек-лист: Регистрация и аутентификация

- [ ] Регистрация с валидными данными
- [ ] Регистрация с существующим email (ошибка)
- [ ] Регистрация с существующим subdomain (ошибка)
- [ ] Регистрация с невалидным email (ошибка)
- [ ] Регистрация с коротким паролем (ошибка)
- [ ] Вход с правильными учетными данными
- [ ] Вход с неправильным паролем (ошибка)
- [ ] Вход с несуществующим email (ошибка)
- [ ] JWT token генерируется и сохраняется
- [ ] Token истекает через 7 дней
- [ ] Logout очищает token

### Чек-лист: Управление меню

- [ ] Создание категории
- [ ] Редактирование категории
- [ ] Удаление категории
- [ ] Изменение порядка категорий
- [ ] Создание блюда
- [ ] Редактирование блюда
- [ ] Удаление блюда
- [ ] Загрузка изображения блюда (JPG)
- [ ] Загрузка изображения блюда (PNG)
- [ ] Загрузка слишком большого файла (ошибка)
- [ ] Загрузка неподдерживаемого формата (ошибка)
- [ ] Добавление модификаторов
- [ ] Редактирование модификаторов
- [ ] Удаление модификаторов

### Чек-лист: Публичное меню

- [ ] Отображение информации о ресторане
- [ ] Отображение баннер-слайдера
- [ ] Автопрокрутка баннеров
- [ ] Отображение категорий
- [ ] Отображение блюд
- [ ] Отображение изображений блюд
- [ ] Отображение цен
- [ ] Добавление в корзину
- [ ] Выбор модификаторов
- [ ] Изменение количества в корзине
- [ ] Удаление из корзины
- [ ] Подсчет итоговой суммы
- [ ] Подсчет стоимости доставки
- [ ] Формирование сообщения WhatsApp
- [ ] Открытие WhatsApp с предзаполненным сообщением

### Чек-лист: Подписки

- [ ] Trial подписка создается при регистрации
- [ ] Trial подписка длится 7 дней
- [ ] Уведомление за 2 дня до истечения trial
- [ ] Блокировка доступа после истечения подписки
- [ ] Админ может изменить план подписки
- [ ] Админ может продлить подписку
- [ ] Админ может отменить подписку
- [ ] Email уведомление при изменении подписки

### Чек-лист: Админ-панель

- [ ] Доступ только для админов
- [ ] Список всех ресторанов
- [ ] Поиск ресторанов
- [ ] Фильтрация по статусу подписки
- [ ] Просмотр деталей ресторана
- [ ] Управление подпиской
- [ ] Статистика платформы
- [ ] Просмотр меню ресторана

### Чек-лист: Безопасность

- [ ] Пароли хешируются (bcrypt)
- [ ] JWT токены подписаны
- [ ] Защита от SQL injection
- [ ] Защита от XSS
- [ ] Rate limiting на auth endpoints
- [ ] CORS настроен правильно
- [ ] Валидация всех входных данных
- [ ] Авторизация на защищенных endpoints
- [ ] Проверка прав доступа (owner/admin)

### Чек-лист: Производительность

- [ ] Время загрузки главной страницы < 2 сек
- [ ] Время загрузки меню < 1 сек
- [ ] Изображения оптимизированы
- [ ] API endpoints отвечают < 500ms
- [ ] База данных индексирована
- [ ] Нет N+1 запросов
- [ ] Pagination для больших списков

### Чек-лист: Адаптивность

- [ ] Desktop (1920px+)
- [ ] Laptop (1366px)
- [ ] Tablet (768px)
- [ ] Mobile (375px)
- [ ] Mobile (320px)
- [ ] Landscape orientation
- [ ] Touch events работают
- [ ] Swipe для слайдера

### Чек-лист: Кросс-браузерность

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## 🔧 Инструменты тестирования

### Рекомендуемые инструменты

| Инструмент                | Назначение                    | Установка                                    |
| ------------------------- | ----------------------------- | -------------------------------------------- |
| **Postman**               | API тестирование              | [postman.com](https://postman.com)           |
| **Thunder Client**        | API тестирование (VS Code)    | VS Code Extension                            |
| **Playwright**            | E2E тестирование              | `npm i -D @playwright/test`                  |
| **Cypress**               | E2E тестирование              | `npm i -D cypress`                           |
| **Jest**                  | Unit тестирование             | `npm i -D jest`                              |
| **React Testing Library** | Тестирование React            | `npm i -D @testing-library/react`            |
| **Lighthouse**            | Performance audit             | Chrome DevTools                              |
| **BrowserStack**          | Кросс-браузерное тестирование | [browserstack.com](https://browserstack.com) |

---

## 📖 Связанные документы

- [API.md](./API.md) - Документация API
- [API_EXAMPLES.md](./API_EXAMPLES.md) - Примеры использования API
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Архитектура системы
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Деплой и мониторинг
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Руководство для разработчиков

---

<div align="center">

**🧪 Качество через тестирование**

[Документация](./START_HERE.md) • [API](./API.md) • [Архитектура](./ARCHITECTURE.md)

</div>
