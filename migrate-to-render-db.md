# Миграция с Supabase на Render PostgreSQL

## 1. Создать новую базу на Render
1. Зайти на https://dashboard.render.com
2. New → PostgreSQL
3. Параметры:
   - Name: `oimoqr-database`
   - Region: **Frankfurt** (обязательно тот же регион что и сервер!)
   - PostgreSQL Version: 16
   - Plan: Starter ($7/мес) или Free
4. Создать базу и скопировать:
   - Internal Database URL (для backend)
   - External Database URL (для миграции)

## 2. Экспорт данных из Supabase

### Вариант А: Через Supabase Dashboard (проще)
1. Зайти в Supabase → Database → Backups
2. Скачать последний backup

### Вариант Б: Через pg_dump (точнее)
```bash
# Установить PostgreSQL клиент если нет
# Windows: https://www.postgresql.org/download/windows/

# Экспорт всей базы
pg_dump "postgresql://postgres.tbztvmdjnjqivnxuyelr:DAS230411Alina@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres" > backup_before_migration.sql

# Или только данные (без схемы, т.к. схема есть в Prisma)
pg_dump --data-only "postgresql://postgres.tbztvmdjnjqivnxuyelr:DAS230411Alina@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres" > backup_data_only.sql
```

## 3. Импорт в Render PostgreSQL

### Сначала применить схему Prisma
```bash
# В локальном проекте временно изменить .env
DATABASE_URL="<EXTERNAL_DATABASE_URL_FROM_RENDER>"

# Применить миграции
cd backend
npx prisma migrate deploy

# Применить индексы
npm run apply:indexes
```

### Потом загрузить данные
```bash
# Если использовали pg_dump
psql "<EXTERNAL_DATABASE_URL_FROM_RENDER>" < backup_before_migration.sql

# Или через pgAdmin / DBeaver с GUI
```

## 4. Обновить переменные окружения на Render

1. Зайти в Render → oimoqr-backend → Environment
2. Изменить переменные:
   ```
   DATABASE_URL = <INTERNAL_DATABASE_URL>  # Важно: Internal, не External!
   DIRECT_URL = <INTERNAL_DATABASE_URL>
   ```
3. Save Changes

## 5. Перезапустить сервис

Render автоматически перезапустится после изменения env variables.

## 6. Проверка

1. Открыть ваше меню (например buffet.oimoqr.com)
2. Проверить что все данные на месте:
   - Категории
   - Блюда
   - Изображения
   - Группы категорий
3. Проверить логи производительности - должно быть <500ms вместо 3-5 сек

## 7. Очистка (после успешной миграции)

- Оставить Supabase базу еще на неделю на всякий случай
- Потом можно удалить Supabase проект

## Ожидаемый результат

**До миграции:**
- Сервер: Frankfurt 🇩🇪
- БД: Australia 🇦🇺
- Задержка: ~250ms × 3 запроса = ~750ms сеть + обработка
- **Итого: 3-5 секунд**

**После миграции:**
- Сервер: Frankfurt 🇩🇪
- БД: Frankfurt 🇩🇪 (тот же дата-центр!)
- Задержка: ~5-10ms × 3 запроса = ~30ms сеть + обработка
- **Итого: <500ms** ⚡

## Стоимость

Render PostgreSQL:
- Free: 256 MB RAM, 1 GB storage (достаточно для малых проектов)
- Starter: $7/мес - 256 MB RAM, 1 GB storage, ежедневные бэкапы
- Standard: $20/мес - 1 GB RAM, 10 GB storage

Supabase можно будет отключить и сэкономить.
