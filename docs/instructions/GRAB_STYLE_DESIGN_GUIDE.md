# 🎨 Grab-Style Design System для OimoQR Shop

## Обзор

Интерфейс онлайн-магазина OimoQR создан по мотивам мобильного приложения **Grab** - одного из самых популярных приложений для доставки в Юго-Восточной Азии.

---

## 🎨 Цветовая палитра

### Основной цвет (Grab Green)

```css
grab-50: #e6f7f1   /* Очень светлый фон */
grab-100: #b3e8d6  /* Светлый фон */
grab-200: #80d9bb  /* Светлый акцент */
grab-300: #4dcaa0  /* Средний */
grab-400: #1abb85  /* Яркий */
grab-500: #00b14f  /* ⭐ Основной Grab Green */
grab-600: #009e47  /* Темнее */
grab-700: #008a3f  /* Еще темнее */
grab-800: #007737  /* Темный */
grab-900: #00642f  /* Самый темный */
```

### Дополнительные цвета

```css
grabOrange: #ff7a00  /* Акценты, предупреждения */
grabRed: #ff3b30     /* Ошибки, скидки */
grabYellow: #ffc107  /* Рекомендации, хиты */
```

### Использование

```jsx
// Кнопки
<button className="bg-grab-500 hover:bg-grab-600 text-white">

// Фон
<div className="bg-grab-50">

// Текст
<span className="text-grab-600">

// Рамка
<div className="border-grab-500">
```

---

## 📏 Скругление углов

### Grab-стиль скругления

```css
rounded-grab: 16px     /* Стандартное скругление */
rounded-grab-lg: 24px  /* Увеличенное скругление */
```

### Использование

```jsx
// Карточки товаров
<div className="rounded-grab">

// Кнопки
<button className="rounded-grab-lg">

// Модальные окна
<div className="rounded-t-grab-lg">
```

---

## 🌫️ Тени

### Grab-стиль теней

```css
shadow-grab: 0 2px 8px rgba(0, 0, 0, 0.08)      /* Легкая тень */
shadow-grab-lg: 0 4px 16px rgba(0, 0, 0, 0.12) /* Заметная тень */
```

### Использование

```jsx
// Карточки
<div className="shadow-grab hover:shadow-grab-lg">

// Плавающие элементы
<div className="shadow-grab-lg">
```

---

## 🧩 Компоненты

### 1. ProductCard

**Карточка товара в стиле Grab**

```jsx
import ProductCard from '../components/shop/ProductCard';

<ProductCard
  product={{
    id: '1',
    name: 'iPhone 15 Pro',
    price: 99999,
    compareAtPrice: 119999,
    images: ['url'],
    available: true,
    featured: true,
    stockQuantity: 5,
    trackInventory: true
  }}
  onAddToCart={(product, quantity) => {}}
/>
```

**Особенности:**
- ✅ Адаптивное изображение (aspect-square)
- ✅ Бейджи (скидки, хиты, остатки)
- ✅ Кнопка +/- для изменения количества
- ✅ Зеленый градиент при наведении

---

### 2. CategoryScroll

**Горизонтальный скролл категорий**

```jsx
import CategoryScroll from '../components/shop/CategoryScroll';

<CategoryScroll
  categories={[
    { id: '1', name: 'Электроника', image: 'url', _count: { products: 15 } }
  ]}
  activeCategory="1"
  onCategoryChange={(id) => {}}
/>
```

**Особенности:**
- ✅ Sticky позиция (прилипает при скролле)
- ✅ Скрытый scrollbar
- ✅ Активная категория подсвечена зеленым
- ✅ Счетчик товаров

---

### 3. ProductGrid

**Сетка товаров**

```jsx
import ProductGrid from '../components/shop/ProductGrid';

<ProductGrid
  products={products}
  onAddToCart={(product, qty) => {}}
  loading={false}
/>
```

**Особенности:**
- ✅ Адаптивная сетка (2/3/4 колонки)
- ✅ Skeleton loader при загрузке
- ✅ Пустое состояние с иконкой

---

### 4. FloatingCart

**Плавающая корзина (как в Grab)**

```jsx
import FloatingCart from '../components/shop/FloatingCart';

<FloatingCart
  items={[
    { product: {...}, quantity: 2 }
  ]}
  total={199998}
  onCheckout={() => {}}
/>
```

**Особенности:**
- ✅ Фиксированная позиция внизу экрана
- ✅ Анимация появления (slide-up)
- ✅ Показывает товары и сумму
- ✅ Скрывается при пустой корзине

---

## 📱 Страницы

### ShopPage (Публичная витрина)

**Путь:** `/shop/:subdomain`

**Секции:**
1. Header с логотипом и поиском
2. Скролл категорий (sticky)
3. Сетка товаров
4. Плавающая корзина

```jsx
import ShopPage from './pages/ShopPage';

// В роутере
<Route path="/shop/:subdomain" element={<ShopPage />} />
```

---

### StoreManagementPage (Панель управления)

**Путь:** `/store-management`

**Табы:**
1. **Товары** - Список всех товаров с действиями
2. **Категории** - Таблица категорий
3. **Остатки** - Управление складом

```jsx
import StoreManagementPage from './pages/StoreManagementPage';

<Route path="/store-management" element={<StoreManagementPage />} />
```

---

## 🎯 UX Принципы Grab

### 1. Мобильный фокус
- Интерфейс оптимизирован для телефонов
- Большие тачовые зоны (min 44x44px)
- Горизонтальные скроллы для категорий

### 2. Минимализм
- Чистый белый фон
- Много пространства
- Лаконичные карточки

### 3. Зеленые акценты
- Основные действия всегда зеленые
- Активное состояние = зеленый
- Hover эффекты с зеленым

### 4. Плавные анимации
```css
transition-all
transition-colors
animate-slide-up
```

### 5. Информативные бейджи
- Скидки → Красный
- Хиты → Желтый
- Остатки → Оранжевый

---

## 💡 Примеры использования

### Кнопка в стиле Grab

```jsx
<button className="
  bg-grab-500 
  hover:bg-grab-600 
  text-white 
  font-semibold 
  py-3 px-6 
  rounded-grab 
  shadow-grab 
  hover:shadow-grab-lg 
  transition-all
">
  Добавить в корзину
</button>
```

### Карточка в стиле Grab

```jsx
<div className="
  bg-white 
  rounded-grab 
  shadow-grab 
  hover:shadow-grab-lg 
  overflow-hidden 
  transition-shadow
">
  {/* Контент */}
</div>
```

### Бейдж скидки

```jsx
<span className="
  bg-grabRed 
  text-white 
  text-xs 
  px-2 py-1 
  rounded-full 
  font-bold
">
  -25%
</span>
```

---

## 🚀 Быстрый старт

### 1. Добавьте роуты

```jsx
// App.jsx
import ShopPage from './pages/ShopPage';
import StoreManagementPage from './pages/StoreManagementPage';

<Routes>
  <Route path="/shop/:subdomain" element={<ShopPage />} />
  <Route path="/store-management" element={<StoreManagementPage />} />
</Routes>
```

### 2. Используйте компоненты

```jsx
import ProductCard from './components/shop/ProductCard';
import CategoryScroll from './components/shop/CategoryScroll';
import ProductGrid from './components/shop/ProductGrid';
import FloatingCart from './components/shop/FloatingCart';
```

### 3. Примените цвета

```jsx
// Вместо старых цветов
<button className="bg-primary-500"> // ❌

// Используйте Grab
<button className="bg-grab-500">     // ✅
```

---

## 📚 Ссылки

- [Tailwind Config](../tailwind.config.js)
- [Компоненты Shop](../components/shop/)
- [ShopPage](../pages/ShopPage.jsx)
- [StoreManagementPage](../pages/StoreManagementPage.jsx)

---

## ✨ Особенности дизайна

### Адаптивность
```jsx
// Мобильный (2 колонки)
grid-cols-2

// Планшет (3 колонки)
md:grid-cols-3

// Десктоп (4 колонки)
lg:grid-cols-4
```

### Скрытие scrollbar

```jsx
// CategoryScroll
className="overflow-x-auto scrollbar-hide"
style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
```

### Анимации

```css
/* tailwind.config.js */
animation: {
  'slide-up': 'slide-up 0.3s ease-out'
}
```

---

**Готово! Теперь ваш магазин выглядит как Grab!** 🎨✨
