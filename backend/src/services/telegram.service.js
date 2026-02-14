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
            // Polling включён всегда — нужен для обработки команд /start и /getid
            this.bot = new TelegramBot(token, {
                polling: {
                    interval: 2000,        // Проверяем каждые 2 секунды
                    autoStart: true,
                    params: {
                        timeout: 10        // Long polling timeout
                    }
                }
            });

            console.log('✅ Telegram Bot initialized (polling enabled)');

            // Обработка ошибок polling (чтобы не крашился сервер)
            this.bot.on('polling_error', (error) => {
                // 409 Conflict = другой экземпляр бота уже использует polling
                if (error.code === 'ETELEGRAM' && error.response?.statusCode === 409) {
                    console.warn('⚠️ Telegram Bot: another instance is already polling. Stopping polling...');
                    this.bot.stopPolling();
                } else {
                    console.error('❌ Telegram polling error:', error.code || error.message);
                }
            });

            // Обработчик команды /start для получения chat ID
            this.bot.onText(/\/start(@\w+)?/, (msg) => {
                const chatId = msg.chat.id;
                const chatType = msg.chat.type;

                let message = `🤖 Привет! Я бот OimoQR для уведомлений о заказах.\n\n`;

                if (chatType === 'group' || chatType === 'supergroup') {
                    message += `📍 *ID вашей группы:* \`${chatId}\`\n\n`;
                    message += `Скопируйте этот ID и вставьте в настройки ресторана в админ-панели.`;
                } else {
                    message += `📍 *Ваш Chat ID:* \`${chatId}\`\n\n`;
                    message += `Для получения уведомлений о заказах:\n`;
                    message += `1. Создайте группу в Telegram\n`;
                    message += `2. Добавьте меня в группу\n`;
                    message += `3. Отправьте /getid в группе\n`;
                    message += `4. Скопируйте ID группы в настройки ресторана`;
                }

                this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            });

            // Обработчик команды /getid — работает и в группе и в ЛС
            this.bot.onText(/\/getid(@\w+)?/, (msg) => {
                const chatId = msg.chat.id;
                const chatTitle = msg.chat.title || 'Личные сообщения';
                const chatType = msg.chat.type;

                let response = `📍 *Chat ID:* \`${chatId}\`\n`;
                response += `📝 *Название:* ${chatTitle}\n`;
                response += `🔖 *Тип:* ${chatType}\n\n`;

                if (chatType === 'group' || chatType === 'supergroup') {
                    response += `✅ Скопируйте ID выше и вставьте в настройки ресторана в админ-панели OimoQR.`;
                } else {
                    response += `⚠️ Для уведомлений о заказах добавьте бота в *группу* и отправьте /getid там.`;
                }

                this.bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
            });

            // Обработчик команды /help
            this.bot.onText(/\/help(@\w+)?/, (msg) => {
                const chatId = msg.chat.id;
                const helpMessage = `🤖 *OimoQR Bot — Помощь*\n\n` +
                    `Доступные команды:\n` +
                    `/start — Приветствие и инструкция\n` +
                    `/getid — Получить ID этого чата\n` +
                    `/help — Показать это сообщение\n\n` +
                    `*Как настроить уведомления:*\n` +
                    `1. Создайте группу в Telegram\n` +
                    `2. Добавьте @OimoQR\\_bot в группу\n` +
                    `3. Отправьте /getid в группе\n` +
                    `4. Скопируйте ID и вставьте в настройки ресторана\n` +
                    `5. Нажмите "Проверить подключение"`;

                this.bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
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
