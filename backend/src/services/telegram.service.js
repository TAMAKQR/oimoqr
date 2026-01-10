import TelegramBot from 'node-telegram-bot-api';

class TelegramService {
    constructor() {
        this.bot = null;
        this.initBot();
    }

    initBot() {
        const token = process.env.TELEGRAM_BOT_TOKEN;

        if (!token) {
            console.warn('⚠️ TELEGRAM_BOT_TOKEN not configured');
            return;
        }

        try {
            // Используем polling только в development для локального тестирования
            const options = process.env.NODE_ENV === 'production'
                ? { polling: false }
                : { polling: true };

            this.bot = new TelegramBot(token, options);
            console.log('✅ Telegram Bot initialized');

            // Обработчик команды /start для получения chat ID
            this.bot.onText(/\/start/, (msg) => {
                const chatId = msg.chat.id;
                const chatType = msg.chat.type;

                let message = `🤖 Привет! Я бот OimoQR для уведомлений о заказах.\n\n`;

                if (chatType === 'group' || chatType === 'supergroup') {
                    message += `📍 **ID вашей группы**: \`${chatId}\`\n\n`;
                    message += `Скопируйте этот ID и вставьте в настройки ресторана в админ-панели.`;
                } else {
                    message += `⚠️ Для получения уведомлений:\n`;
                    message += `1. Добавьте меня в группу вашего ресторана\n`;
                    message += `2. Отправьте /start в группе\n`;
                    message += `3. Скопируйте ID группы из сообщения`;
                }

                this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            });

            // Обработчик команды /getid
            this.bot.onText(/\/getid/, (msg) => {
                const chatId = msg.chat.id;
                this.bot.sendMessage(chatId, `📍 Chat ID: \`${chatId}\``, { parse_mode: 'Markdown' });
            });

        } catch (error) {
            console.error('❌ Failed to initialize Telegram Bot:', error.message);
        }
    }

    async sendNewOrderNotification(order, restaurant) {
        if (!this.bot || !restaurant.telegramGroupId) {
            console.log('⚠️ Telegram notifications not configured for restaurant:', restaurant.name);
            return;
        }

        try {
            const items = order.items || [];
            const itemsList = items.map(item =>
                `• ${item.dish?.name || 'Unknown'} x${item.quantity} - ${item.price} ${restaurant.currency || '₽'}`
            ).join('\n');

            const deliveryType = order.deliveryType === 'delivery' ? '🚗 Доставка' : '🏃 Самовывоз';
            const paymentMethod = order.paymentMethod === 'cash' ? '💵 Наличные' : '💳 Карта';

            const message = `
🆕 **НОВЫЙ ЗАКАЗ #${order.orderNumber}**

👤 **Клиент:** ${order.customerName || 'Не указано'}
📞 **Телефон:** ${order.customerPhone || 'Не указано'}

**Тип заказа:** ${deliveryType}
${order.deliveryAddress ? `📍 **Адрес:** ${order.deliveryAddress}` : ''}

**Состав заказа:**
${itemsList}

💰 **Сумма:** ${order.totalAmount} ${restaurant.currency || '₽'}
💳 **Оплата:** ${paymentMethod}

${order.notes ? `📝 **Комментарий:** ${order.notes}` : ''}

⏰ Время: ${new Date().toLocaleString('ru-RU')}
      `.trim();

            await this.bot.sendMessage(restaurant.telegramGroupId, message, {
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });

            console.log(`✅ Telegram notification sent for order #${order.orderNumber}`);
        } catch (error) {
            console.error('❌ Failed to send Telegram notification:', error.message);
        }
    }

    async testConnection(chatId) {
        if (!this.bot) {
            throw new Error('Telegram bot not initialized');
        }

        try {
            await this.bot.sendMessage(chatId, '✅ Подключение успешно! Уведомления настроены.', {
                parse_mode: 'Markdown'
            });
            return true;
        } catch (error) {
            throw new Error(`Failed to send test message: ${error.message}`);
        }
    }
}

export default new TelegramService();
