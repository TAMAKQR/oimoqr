import twilio from 'twilio';

class WhatsAppService {
    constructor() {
        this.accountSid = process.env.TWILIO_ACCOUNT_SID;
        this.authToken = process.env.TWILIO_AUTH_TOKEN;
        this.whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER; // формат: whatsapp:+14155238886

        if (!this.accountSid || !this.authToken || !this.whatsappNumber) {
            console.warn('⚠️ Twilio WhatsApp credentials not configured');
            this.client = null;
        } else {
            this.client = twilio(this.accountSid, this.authToken);
        }
    }

    // Генерация 4-значного кода
    generateCode() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    }

    // Отправка кода верификации через WhatsApp
    async sendVerificationCode(phoneNumber, code) {
        if (!this.client) {
            throw new Error('Twilio WhatsApp not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_NUMBER in .env');
        }

        try {
            // Убедимся что номер в международном формате
            const formattedNumber = this.formatPhoneNumber(phoneNumber);

            const message = await this.client.messages.create({
                from: this.whatsappNumber,
                to: `whatsapp:${formattedNumber}`,
                body: `🔐 Ваш код подтверждения: ${code}\n\nКод действителен 5 минут.\n\n- OimoQR Menu`
            });

            console.log(`✅ WhatsApp code sent to ${formattedNumber}:`, message.sid);
            return { success: true, messageSid: message.sid };
        } catch (error) {
            console.error('❌ Failed to send WhatsApp message:', error);

            // Форматирование номера телефона в международный формат
            formatPhoneNumber(phoneNumber) {
                // Убираем все нецифровые символы
                let cleaned = phoneNumber.replace(/\D/g, '');

                // Если номер начинается с 8 или 7 (Россия/СНГ), заменяем на +7
                if (cleaned.startsWith('8') || cleaned.startsWith('7')) {
                    cleaned = '7' + cleaned.substring(1);
                }

                // Если нет +, добавляем
                if (!cleaned.startsWith('+')) {
                    cleaned = '+' + cleaned;
                }

                return cleaned;
            }

            // Валидация номера телефона
            isValidPhoneNumber(phoneNumber) {
                const cleaned = phoneNumber.replace(/\D/g, '');
                // Минимум 10 цифр, максимум 15 (международный формат)
                return cleaned.length >= 10 && cleaned.length <= 15;
            }
        }

        export default new WhatsAppService();
