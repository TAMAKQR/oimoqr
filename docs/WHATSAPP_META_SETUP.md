# WhatsApp Авторизация через Meta Business Platform

Официальная интеграция WhatsApp напрямую через Facebook/Meta - более надежный и экономичный вариант для продакшена.

## 🆚 Сравнение: Twilio vs Meta

| Параметр | Twilio | Meta WhatsApp Business |
|----------|--------|------------------------|
| **Цена** | ~$0.005 за сообщение | **Бесплатно** до 1000 разговоров/мес |
| **Настройка** | Легко (Sandbox за 5 мин) | Сложнее (верификация бизнеса) |
| **Время старта** | 5 минут | 1-2 недели (ожидание верификации) |
| **Для разработки** | Sandbox бесплатно | Требует верификацию |
| **Для продакшена** | Платно | Условно бесплатно |
| **Надежность** | Высокая | Высокая |

## 📋 Требования

1. **Facebook Business Account** (бесплатно)
2. **Верифицированный бизнес** в Meta
3. **WhatsApp Business Account**
4. **Одобренный Message Template**

## 🚀 Пошаговая настройка

### Шаг 1: Создание Facebook Business Account

1. Перейдите на https://business.facebook.com
2. Нажмите **Create Account**
3. Заполните информацию о бизнесе
4. Подтвердите email

### Шаг 2: Верификация бизнеса

1. В Business Manager → **Business Settings**
2. Перейдите в **Security Center** → **Business Verification**
3. Загрузите документы:
   - Регистрационные документы компании
   - ИНН / Tax ID
   - Подтверждение адреса
4. Ожидайте одобрения (1-5 рабочих дней)

**Документы для верификации:**
- Свидетельство о регистрации ИП/ООО
- Выписка из ЕГРЮЛ/ЕГРИП
- Паспорт владельца бизнеса
- Договор аренды офиса или utility bill

### Шаг 3: Создание WhatsApp Business Account

1. В Business Manager → **Business Settings**
2. **Accounts** → **WhatsApp Business Accounts**
3. Нажмите **Add** → **Create a WhatsApp Business Account**
4. Выберите **Business Portfolio**
5. Заполните информацию:
   - Business name
   - Business category
   - Business description
   - Website
6. Добавьте номер телефона:
   - ⚠️ Номер НЕ должен быть зарегистрирован в обычном WhatsApp
   - Получите SMS с кодом верификации
   - Введите код

### Шаг 4: Создание WhatsApp App

1. Перейдите на https://developers.facebook.com
2. **My Apps** → **Create App**
3. Выберите тип: **Business**
4. Заполните:
   - App Name: "OimoQR Menu"
   - Contact Email
   - Business Account
5. В настройках приложения добавьте **WhatsApp** продукт
6. Привяжите WhatsApp Business Account

### Шаг 5: Получение Access Token

1. В WhatsApp продукте → **Configuration**
2. **Temporary Access Token** (действует 24 часа, для теста)
3. Для продакшена создайте **Permanent Token**:
   - **Business Settings** → **System Users**
   - Create System User
   - Assign Assets → WhatsApp Business Account
   - Generate Token → выберите права:
     - `whatsapp_business_management`
     - `whatsapp_business_messaging`

### Шаг 6: Создание Message Template

**⚠️ ВАЖНО:** WhatsApp требует предварительно одобренные шаблоны для сообщений!

1. WhatsApp Manager → **Message Templates**
2. **Create Template**
3. Параметры:
   - **Name:** `verification_code`
   - **Category:** `AUTHENTICATION`
   - **Language:** Russian
   - **Body:**
     ```
     🔐 Ваш код подтверждения: {{1}}
     
     Код действителен 5 минут.
     
     - OimoQR Menu
     ```
4. **Submit for Review**
5. Ожидайте одобрения (обычно 24-48 часов)

### Шаг 7: Настройка в коде

Создайте новый сервис для Meta WhatsApp:

```javascript
// backend/src/services/metaWhatsAppService.js
import axios from 'axios';

class MetaWhatsAppService {
    constructor() {
        this.phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
        this.accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
        this.apiUrl = 'https://graph.facebook.com/v18.0';
    }

    async sendVerificationCode(phoneNumber, code) {
        try {
            const response = await axios.post(
                `${this.apiUrl}/${this.phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: phoneNumber,
                    type: 'template',
                    template: {
                        name: 'verification_code',
                        language: { code: 'ru' },
                        components: [
                            {
                                type: 'body',
                                parameters: [
                                    { type: 'text', text: code }
                                ]
                            }
                        ]
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('✅ WhatsApp code sent via Meta:', response.data);
            return { success: true, messageId: response.data.messages[0].id };
        } catch (error) {
            console.error('❌ Meta WhatsApp error:', error.response?.data || error);
            throw error;
        }
    }
}

export default new MetaWhatsAppService();
```

### Шаг 8: Переменные окружения

```env
# Meta WhatsApp Business Platform
META_WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
META_WHATSAPP_ACCESS_TOKEN=your_permanent_access_token
META_WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
```

## 💰 Тарификация

**Бесплатные лимиты (категория AUTHENTICATION):**
- Первая 1000 разговоров в месяц: **БЕСПЛАТНО**
- Каждый следующий разговор: ~$0.005-0.01

**Разговор** = обмен сообщениями в течение 24 часов с одним клиентом

**Преимущества:**
- ✅ 1000 авторизаций в месяц бесплатно
- ✅ Официальная интеграция
- ✅ Зеленая галочка (verified business)
- ✅ Более высокие лимиты отправки

## 🔧 Webhook для получения ответов

Если нужно получать ответы от клиентов:

1. **Configure Webhooks:**
   - Callback URL: `https://oimoqr.onrender.com/api/webhooks/whatsapp`
   - Verify Token: ваш секретный токен
   - Subscribe to: `messages`

2. **Создайте endpoint:**
```javascript
router.post('/webhooks/whatsapp', (req, res) => {
    console.log('WhatsApp webhook:', req.body);
    res.sendStatus(200);
});

router.get('/webhooks/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});
```

## ⚡ Текущее состояние

**Сейчас:**
- Twilio не настроен → коды выводятся в консоль (DEV mode)
- Приложение работает, авторизация функциональна

**После верификации бизнеса:**
- Настроить Meta WhatsApp Business
- Создать и одобрить message template
- Получить permanent access token
- Переключить с Twilio на Meta

## 📝 Чек-лист

- [ ] Создать Facebook Business Account
- [ ] Пройти Business Verification
- [ ] Создать WhatsApp Business Account
- [ ] Добавить номер телефона
- [ ] Создать WhatsApp App
- [ ] Получить Access Token
- [ ] Создать Message Template `verification_code`
- [ ] Дождаться одобрения template
- [ ] Настроить переменные окружения
- [ ] Протестировать отправку
- [ ] (Опционально) Настроить webhooks

## 🔗 Полезные ссылки

- [Meta Business Suite](https://business.facebook.com)
- [WhatsApp Business Platform](https://developers.facebook.com/docs/whatsapp)
- [Message Templates Guide](https://developers.facebook.com/docs/whatsapp/message-templates)
- [Pricing](https://developers.facebook.com/docs/whatsapp/pricing)
- [Business Verification](https://www.facebook.com/business/help/2058515294227817)

## 💡 Рекомендация

**Для сейчас:**
- Оставьте как есть (DEV mode с кодами в консоли)
- Или временно используйте SMS через SMS.ru/SMSC.ru (~1₽ за SMS)

**Для продакшена:**
- Настройте Meta WhatsApp Business (бесплатно до 1000 сообщений)
- Получите зеленую галочку verified business
- Более надежно и профессионально
