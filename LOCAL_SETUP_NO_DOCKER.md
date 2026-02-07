# 🧪 Тестирование локально без Docker

## Запуск PostgreSQL локально (альтернатива Docker)

### Вариант 1: Использовать SQLite для разработки
```powershell
# 1. Переключиться на SQLite в schema.prisma
# Замените в backend/prisma/schema.prisma:
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

# 2. Создайте миграцию
cd backend
npx prisma migrate dev --name init

# 3. Запустите backend
npm run dev
```

### Вариант 2: Использовать cloud PostgreSQL (Supabase)
```powershell
# 1. Создайте .env.local в папке backend
# DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres

# 2. Примените миграции
cd backend
npx prisma migrate deploy

# 3. Запустите backend
npm run dev
```

## Запуск полного стека

```powershell
# В корневой папке проекта
npm run dev
```

Откроется:
- Frontend: http://localhost:5173
- Backend: http://localhost:5001
