# 🔒 Настройка безопасности для Production

> **⚠️ КРИТИЧЕСКИ ВАЖНО:** Следуйте этим инструкциям перед деплоем!

---

## 📋 Чеклист безопасности

### ✅ 1. Генерация JWT Secret

**Текущий JWT_SECRET слишком простой!** Сгенерируйте новый:

```powershell
# В PowerShell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Скопируйте результат и используйте как `JWT_SECRET` в Render/Vercel.

**Пример результата:**

```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2
```

---

### ✅ 2. Настройка Supabase Database

Ваш текущий DATABASE_URL:

```
postgresql://postgres:DAS230411Alina%40@db.lsqssdpsozjtmvzfqtws.supabase.co:5432/postgres?sslmode=require
```

**Проверьте:**

- ✅ Пароль правильно закодирован (`@` = `%40`)
- ✅ Хост правильный: `db.lsqssdpsozjtmvzfqtws.supabase.co`
- ✅ SSL включен: `sslmode=require`

**Где найти правильный URL:**

1. Откройте: https://supabase.com/dashboard
2. Выберите проект
3. Settings → Database → Connection string → URI
4. Скопируйте и замените `[YOUR-PASSWORD]` на ваш пароль

---

### ✅ 3. Настройка Cloudinary (ОБЯЗАТЕЛЬНО!)

**Почему нужен Cloudinary?**

- Vercel/Render имеют ephemeral filesystem (файлы удаляются после перезапуска)
- Загруженные фото блюд будут теряться без облачного хранилища

**Как настроить:**

1. **Зарегистрируйтесь:**

   - Перейдите: https://cloudinary.com/users/register/free
   - Бесплатный план: 25 GB хранилища, 25 GB трафика/месяц

2. **Получите credentials:**

   - Dashboard → Account Details
   - Скопируйте:
     - Cloud Name
     - API Key
     - API Secret

3. **Добавьте в переменные окружения:**
   ```env
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=123456789012345
   CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz123456
   ```

---

### ✅ 4. Настройка Email (Gmail)

**Для отправки email уведомлений:**

1. **Включите 2FA в Google аккаунте:**

   - https://myaccount.google.com/security

2. **Создайте App Password:**

   - https://myaccount.google.com/apppasswords
   - Выберите: Mail → Other (Custom name) → "OimoQR"
   - Скопируйте 16-значный пароль

3. **Добавьте в переменные:**
   ```env
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=abcd efgh ijkl mnop  # 16 символов без пробелов
   ```

---

### ✅ 5. Настройка CORS (Frontend URL)

**Текущий:**

```env
FRONTEND_URL=https://oimoqr-frontend.vercel.app
```

**После деплоя на Vercel обновите на реальный URL:**

```env
FRONTEND_URL=https://your-actual-domain.vercel.app
```

Или если используете свой домен:

```env
FRONTEND_URL=https://oimoqr.com
```

---

## 🚀 Деплой на Render (Backend)

### Шаг 1: Создайте Web Service

1. Перейдите: https://dashboard.render.com/
2. New → Web Service
3. Connect GitHub repository: `TAMAKQR/oimoqr`
4. Настройки:
   - **Name:** `oimoqr-backend`
   - **Root Directory:** `backend`
   - **Environment:** `Node`
   - **Build Command:** `npm install && npx prisma generate && npx prisma migrate deploy`
   - **Start Command:** `npm start`
   - **Plan:** Free

### Шаг 2: Добавьте Environment Variables

В Render Dashboard → Environment:

```env
DATABASE_URL=postgresql://postgres:DAS230411Alina%40@db.lsqssdpsozjtmvzfqtws.supabase.co:5432/postgres?sslmode=require

JWT_SECRET=<СГЕНЕРИРОВАННЫЙ_64_СИМВОЛА>
JWT_EXPIRES_IN=7d

NODE_ENV=production
PORT=10000

FRONTEND_URL=https://oimoqr-frontend.vercel.app

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=<GMAIL_APP_PASSWORD>
SMTP_FROM="OimoQR <noreply@oimoqr.com>"

CLOUDINARY_CLOUD_NAME=<YOUR_CLOUD_NAME>
CLOUDINARY_API_KEY=<YOUR_API_KEY>
CLOUDINARY_API_SECRET=<YOUR_API_SECRET>

UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880
TRIAL_PERIOD_DAYS=7
```

### Шаг 3: Deploy

- Нажмите "Create Web Service"
- Дождитесь завершения деплоя (~5 минут)
- Скопируйте URL: `https://oimoqr-backend.onrender.com`

---

## 🚀 Деплой на Vercel (Frontend)

### Шаг 1: Импортируйте проект

1. Перейдите: https://vercel.com/new
2. Import Git Repository: `TAMAKQR/oimoqr`
3. Настройки:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

### Шаг 2: Добавьте Environment Variables

```env
VITE_API_URL=https://oimoqr-backend.onrender.com/api
```

### Шаг 3: Deploy

- Нажмите "Deploy"
- Дождитесь завершения (~2 минуты)
- Скопируйте URL: `https://oimoqr-frontend.vercel.app`

### Шаг 4: Обновите FRONTEND_URL в Render

Вернитесь в Render → Environment Variables:

```env
FRONTEND_URL=https://oimoqr-frontend.vercel.app
```

Сохраните и перезапустите сервис.

---

## 🔐 Проверка безопасности

### ✅ Чеклист перед запуском:

- [ ] JWT_SECRET сгенерирован (64+ символа)
- [ ] DATABASE_URL правильный (Supabase)
- [ ] Cloudinary настроен (обязательно!)
- [ ] Gmail App Password создан
- [ ] FRONTEND_URL обновлен на реальный
- [ ] Все переменные добавлены в Render
- [ ] Все переменные добавлены в Vercel
- [ ] `.env.production` НЕ загружен на GitHub
- [ ] Тестовый запрос к API работает
- [ ] Регистрация работает
- [ ] Email отправляется
- [ ] Загрузка фото работает (Cloudinary)

---

## 🧪 Тестирование после деплоя

### 1. Проверьте Backend API

```powershell
# Health check
curl https://oimoqr-backend.onrender.com/api/health

# Должен вернуть: {"status":"ok"}
```

### 2. Проверьте Frontend

Откройте: https://oimoqr-frontend.vercel.app

### 3. Проверьте регистрацию

1. Зарегистрируйте тестовый ресторан
2. Проверьте email (должно прийти письмо)
3. Войдите в систему
4. Загрузите фото блюда (проверьте Cloudinary)

---

## 🆘 Troubleshooting

### Проблема: "Database connection failed"

**Решение:**

1. Проверьте DATABASE_URL в Render
2. Убедитесь, что пароль правильно закодирован (`@` → `%40`)
3. Проверьте, что Supabase проект активен

### Проблема: "CORS error"

**Решение:**

1. Проверьте FRONTEND_URL в Render
2. Убедитесь, что URL совпадает с Vercel URL
3. Перезапустите Render service

### Проблема: "Email not sending"

**Решение:**

1. Проверьте SMTP_USER и SMTP_PASS
2. Убедитесь, что используете Gmail App Password (не обычный пароль)
3. Проверьте логи в Render

### Проблема: "Images not uploading"

**Решение:**

1. Проверьте Cloudinary credentials
2. Убедитесь, что все 3 переменные установлены:
   - CLOUDINARY_CLOUD_NAME
   - CLOUDINARY_API_KEY
   - CLOUDINARY_API_SECRET
3. Проверьте квоту в Cloudinary Dashboard

---

## 📚 Дополнительные ресурсы

- **Supabase Docs:** https://supabase.com/docs
- **Render Docs:** https://render.com/docs
- **Vercel Docs:** https://vercel.com/docs
- **Cloudinary Docs:** https://cloudinary.com/documentation
- **Gmail App Passwords:** https://support.google.com/accounts/answer/185833

---

## 🎉 Готово!

После выполнения всех шагов ваше приложение будет:

✅ Безопасно (сильный JWT secret)  
✅ Надежно (PostgreSQL database)  
✅ Масштабируемо (Cloudinary для файлов)  
✅ Функционально (Email уведомления)  
✅ Готово к production!

---

**Следующий шаг:** [POST_DEPLOY.md](./POST_DEPLOY.md) - Настройка после деплоя
