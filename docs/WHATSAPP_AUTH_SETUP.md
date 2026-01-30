# WhatsApp Авторизация через Twilio

Инструкция по настройке авторизации через WhatsApp с использованием Twilio API.

## 🚀 Быстрый старт

### 1. Создание аккаунта Twilio

1. Зарегистрируйтесь на https://www.twilio.com/try-twilio
2. Подтвердите email и номер телефона
3. Получите $15 бесплатного кредита для тестирования

### 2. Настройка WhatsApp Sandbox (для разработки)

1. В консоли Twilio перейдите в **Messaging** → **Try it out** → **Send a WhatsApp message**
2. Следуйте инструкциям для активации Sandbox:
   - Отправьте сообщение с кодом на номер Twilio WhatsApp
   - Например: "join [your-code]" на номер +1 415 523 8886

3. Скопируйте учетные данные:
   - Account SID
   - Auth Token
   - WhatsApp Sandbox Number (формат: `whatsapp:+14155238886`)

### 3. Настройка переменных окружения

Добавьте в `.env` файл бэкенда:

```env
# Twilio WhatsApp API
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

### 4. Установка зависимостей

```bash
cd backend
npm install twilio
```

### 5. Запуск

```bash
# Backend
cd backend
npm run dev

# Frontend
cd frontend
npm run dev
```

## 📱 Как это работает

1. **Клиент вводит номер телефона** на странице `/customer/whatsapp-login`
2. **Бэкенд генерирует 4-значный код** и отправляет его через Twilio WhatsApp API
3. **Клиент получает сообщение в WhatsApp** с кодом
4. **Клиент вводит код** в приложении
5. **Бэкенд проверяет код** и создает/авторизует клиента
6. **Выдается JWT токен** для дальнейших запросов

## 🔧 API Endpoints

### POST `/api/customers/whatsapp/send-code`
Отправка кода верификации

**Request:**
```json
{
  "phoneNumber": "+77001234567"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Verification code sent via WhatsApp",
  "phoneNumber": "+77001234567"
}
```

### POST `/api/customers/whatsapp/verify-code`
Верификация кода и авторизация

**Request:**
```json
{
  "phoneNumber": "+77001234567",
  "code": "1234",
  "restaurantId": "optional-restaurant-id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Phone number verified successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "customer": {
    "id": "customer-id",
    "phone": "+77001234567",
    "name": "Клиент 4567"
  }
}
```

## 🛡️ Безопасность

- ✅ Коды действительны **5 минут**
- ✅ Максимум **3 попытки** ввода кода
- ✅ Защита от спама: **1 минута** между отправками
- ✅ Коды хранятся в памяти (для продакшена рекомендуется Redis)

## 💰 Стоимость

**Sandbox (разработка):**
- Бесплатно
- Ограничения: только предварительно зарегистрированные номера

**Production:**
- ~$0.005 за сообщение WhatsApp
- Требуется одобрение Facebook Business

## 🚀 Переход в Production

1. **Верификация бизнеса:**
   - Создайте Facebook Business Manager
   - Свяжите с Twilio аккаунтом
   - Пройдите верификацию

2. **Настройка Message Template:**
   - Создайте шаблон сообщения
   - Получите одобрение от WhatsApp
   - Используйте одобренный template для отправки

3. **Обновите номер:**
   ```env
   TWILIO_WHATSAPP_NUMBER=whatsapp:+YOUR_APPROVED_NUMBER
   ```

## 📊 Мониторинг

Логи в консоли бэкенда:
- 📱 Запрос на отправку кода
- ✅ Успешная отправка
- 🔐 Попытка верификации
- ❌ Ошибки

## 🐛 Troubleshooting

**"Failed to send verification code"**
- Проверьте TWILIO_ACCOUNT_SID и TWILIO_AUTH_TOKEN
- Убедитесь что Sandbox активирован
- Проверьте баланс аккаунта

**"Code already sent. Please wait..."**
- Защита от спама активна
- Подождите 60 секунд

**"Too many failed attempts"**
- Запросите новый код

## 🔄 Альтернатива: SMS

Если WhatsApp не подходит, можно легко переключиться на SMS:

```javascript
// whatsappService.js
await this.client.messages.create({
  from: this.phoneNumber, // Обычный Twilio номер
  to: formattedNumber,     // Без префикса whatsapp:
  body: `Ваш код: ${code}`
});
```

## 📝 Примечания

- В dev режиме код выводится в консоль если WhatsApp не настроен
- Номера автоматически форматируются в международный формат
- Поддержка России/СНГ: автозамена 8 на +7
