# 🔧 Исправление удаления блюд - Краткая инструкция

## Что было сделано локально ✅

1. ✅ Обновлена схема Prisma (`backend/prisma/schema.prisma`)
2. ✅ Добавлена проверка в контроллере блюд
3. ✅ Улучшено отображение ошибок в админке
4. ✅ Создан SQL файл для миграции

## Что нужно сделать на сервере (Render) 🚀

### Быстрый способ (5 минут):

1. Откройте [Render Dashboard](https://dashboard.render.com/)
2. Перейдите в PostgreSQL Database → `oimoqr_database`
3. Нажмите кнопку **"Shell"** (psql)
4. Скопируйте и вставьте этот SQL код:

```sql
ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_dishId_fkey";
ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_productId_fkey";

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

5. Нажмите Enter
6. После успешного выполнения перезапустите backend сервис
7. Готово! ✅

### Проверка работы:

1. Откройте админку вашего ресторана
2. Попробуйте удалить любое блюдо
3. Если блюдо используется в заказах - увидите информативное сообщение
4. Если блюдо не используется - оно будет успешно удалено

## Альтернатива удалению 💡

Вместо удаления блюда лучше использовать кнопку **"⏸"** (снять с публикации):
- Блюдо скроется из меню для клиентов
- Останется в истории заказов
- Можно легко вернуть обратно

---

**Полная документация:** [docs/DISH_DELETION_FIX.md](DISH_DELETION_FIX.md)
