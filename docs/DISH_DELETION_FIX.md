# Исправление удаления блюд

## Проблема
При попытке удалить блюдо в админке возникала ошибка, если это блюдо использовалось хотя бы в одном заказе. Это происходило из-за ограничения foreign key в базе данных.

## Решение

### 1. Обновлена схема Prisma
В файле `backend/prisma/schema.prisma` добавлено `onDelete: SetNull` для связей:
- `OrderItem.dishId` → `Dish.id`
- `OrderItem.productId` → `Product.id`

Это позволяет при удалении блюда автоматически устанавливать `null` в заказах вместо блокировки удаления.

### 2. Добавлена проверка в контроллере
В `backend/src/controllers/dish.controller.js` функция `deleteDish` теперь:
- Проверяет, используется ли блюдо в заказах
- Показывает информативное сообщение с количеством заказов
- Предлагает альтернативу - скрыть блюдо вместо удаления

### 3. Улучшен UI
В `frontend/src/pages/MenuManagementPage.jsx`:
- Показывается детальное сообщение об ошибке
- При успехе показывается уведомление "Блюдо удалено"

## Применение миграции на production (Render)

### Вариант 1: Через Render Dashboard (рекомендуется)
1. Зайдите в Render Dashboard → PostgreSQL Database
2. Откройте Shell (psql)
3. Выполните SQL:

```sql
-- Drop existing constraints
ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_dishId_fkey";
ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_productId_fkey";

-- Add new constraints with ON DELETE SET NULL
ALTER TABLE "OrderItem" 
  ADD CONSTRAINT "OrderItem_dishId_fkey" 
  FOREIGN KEY ("dishId") 
  REFERENCES "Dish"("id") 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

ALTER TABLE "OrderItem" 
  ADD CONSTRAINT "OrderItem_productId_fkey" 
  FOREIGN KEY ("productId") 
  REFERENCES "Product"("id") 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;
```

### Вариант 2: Через psql локально
```bash
psql "postgresql://oimoqr_database_user:t41Ai9BF0ePaiR4wGGiQl6p4a9an4Tkz@dpg-d60v7gnfte5s73bgoj60-a.ohio-postgres.render.com/oimoqr_database" -f backend/migrations/fix_dish_deletion.sql
```

### Вариант 3: После деплоя на Render
Создайте файл `backend/src/scripts/apply-migration.js`:

```javascript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// ... (код из apply-fix-dish-deletion.js)
```

И выполните на сервере:
```bash
node backend/src/scripts/apply-migration.js
```

## Проверка
После применения миграции:
1. Перезапустите backend
2. Попробуйте удалить блюдо в админке
3. Если блюдо используется в заказах - вы увидите информативное сообщение
4. Если блюдо не используется - оно будет успешно удалено

## Альтернатива удалению
Вместо удаления блюда можно:
- Использовать кнопку "⏸" для снятия блюда с публикации (поле `available = false`)
- Это скроет блюдо из меню, но сохранит его в истории заказов
