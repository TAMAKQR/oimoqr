# 📢 Руководство по уведомлениям

## Обзор

В проекте используется **react-hot-toast** для красивых кастомных уведомлений вместо стандартных `alert()` и `confirm()`.

---

## 🎨 Типы уведомлений

### 1. Успешные уведомления (Success)

```javascript
import toast from 'react-hot-toast';

toast.success('Настройки сохранены!');
toast.success('Блюдо добавлено успешно!');
```

**Вид:** Зеленый фон, иконка ✅

---

### 2. Ошибки (Error)

```javascript
toast.error('Ошибка при сохранении');
toast.error('Не удалось загрузить данные');
```

**Вид:** Красный фон, иконка ❌

---

### 3. Информационные (Info)

```javascript
toast('Файл выбран: image.jpg');
toast('Загрузка началась...', { icon: '📤' });
```

**Вид:** Темно-серый фон, кастомная иконка

---

### 4. Загрузка (Loading)

```javascript
const toastId = toast.loading('Загрузка...');

// После завершения:
toast.success('Готово!', { id: toastId });
// или
toast.error('Ошибка!', { id: toastId });
```

**Вид:** Синий фон, спиннер

---

## ⚠️ Диалоги подтверждения

Для замены стандартного `confirm()` используйте `confirmDialog`:

### Базовое использование:

```javascript
import { confirmDialog } from '../utils/confirmDialog';

const handleDelete = async () => {
  const confirmed = await confirmDialog('Удалить этот элемент?');
  
  if (!confirmed) return;
  
  // Выполняем удаление
  await deleteItem();
};
```

---

### С кастомными опциями:

```javascript
const confirmed = await confirmDialog(
  'Вы уверены, что хотите удалить ресторан?\n\nЭто действие необратимо!',
  {
    confirmText: 'Удалить навсегда',
    cancelText: 'Отмена',
    icon: '🗑️',
    duration: 10000 // Показывать 10 секунд
  }
);
```

---

### Опции confirmDialog:

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `message` | string | - | Текст сообщения (обязательно) |
| `confirmText` | string | 'Подтвердить' | Текст кнопки подтверждения |
| `cancelText` | string | 'Отмена' | Текст кнопки отмены |
| `icon` | string | '⚠️' | Эмодзи иконка |
| `duration` | number | 8000 | Время показа (мс) |

---

## 🎯 Примеры из проекта

### Сохранение блюда:

```javascript
const handleSave = async () => {
  try {
    await menuService.saveDish(data);
    toast.success('Блюдо сохранено!');
  } catch (err) {
    toast.error('Ошибка при сохранении блюда');
  }
};
```

---

### Удаление с подтверждением:

```javascript
const handleDeleteDish = async (dishId) => {
  const confirmed = await confirmDialog('Удалить блюдо?', {
    confirmText: 'Удалить',
    cancelText: 'Отмена',
    icon: '🗑️'
  });
  
  if (!confirmed) return;

  try {
    await menuService.deleteDish(dishId);
    toast.success('Блюдо удалено');
  } catch (err) {
    toast.error('Ошибка при удалении блюда');
  }
};
```

---

### Загрузка файла с индикатором:

```javascript
const handleUpload = async (file) => {
  const toastId = toast.loading('Загрузка изображения...');
  
  try {
    await uploadImage(file);
    toast.success('Изображение загружено!', { id: toastId });
  } catch (err) {
    toast.error('Ошибка загрузки', { id: toastId });
  }
};
```

---

## 📝 Настройка в App.jsx

Глобальные настройки для всех toast:

```jsx
<Toaster 
  position="top-center"
  toastOptions={{
    duration: 4000,
    style: {
      background: '#363636',
      color: '#fff',
      padding: '16px',
      borderRadius: '8px',
    },
    success: {
      duration: 3000,
      style: { background: '#10b981' },
    },
    error: {
      duration: 5000,
      style: { background: '#ef4444' },
    },
  }}
/>
```

---

## 🚫 Что НЕ использовать

❌ **Устарело:**
```javascript
alert('Сохранено');
confirm('Удалить?');
window.alert('Ошибка');
window.confirm('Вы уверены?');
```

✅ **Используйте вместо этого:**
```javascript
toast.success('Сохранено');
const confirmed = await confirmDialog('Удалить?');
toast.error('Ошибка');
const confirmed = await confirmDialog('Вы уверены?');
```

---

## 🎨 Иконки

Рекомендуемые эмодзи для разных действий:

- ✅ Успех: `toast.success()`
- ❌ Ошибка: `toast.error()`
- 🗑️ Удаление: `icon: '🗑️'`
- ⚠️ Предупреждение: `icon: '⚠️'`
- 📤 Загрузка: `icon: '📤'`
- 💾 Сохранение: `icon: '💾'`
- 🖼️ Изображение: `icon: '🖼️'`
- 💬 Сообщение: `icon: '💬'`

---

## 📚 Документация

Полная документация react-hot-toast:
https://react-hot-toast.com/

---

Создано: 8 января 2026
