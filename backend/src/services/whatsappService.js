import twilio from 'twilio';

class WhatsAppService {
    constructor() {
        this.accountSid = process.env.TWILIO_ACCOUNT_SID;
        this.authToken = process.env.TWILIO_AUTH_TOKEN;
        this.verifySid = process.env.TWILIO_VERIFY_SID; // Verify Service SID (начинается с VA)

        if (!this.accountSid || !this.authToken) {
            console.warn('⚠️ Twilio credentials not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)');
            this.client = null;
        } else if (!this.accountSid.startsWith('AC')) {
            console.warn('⚠️ TWILIO_ACCOUNT_SID looks invalid (must start with AC)');
            this.client = null;
        } else {
            try {
                this.client = twilio(this.accountSid, this.authToken);

                if (this.verifySid) {
                    console.log('✅ Twilio Verify API configured (SMS)');
                } else {
                    console.warn('⚠️ TWILIO_VERIFY_SID not set — Twilio Verify API will not work');
                }
            } catch (error) {
                console.warn('⚠️ Failed to initialize Twilio client:', error?.message || error);
                this.client = null;
            }
        }
    }

    // Отправка кода верификации через Twilio Verify (SMS)
    async sendVerificationCode(phoneNumber) {
        if (!this.client) {
            throw new Error('Twilio not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env');
        }

        if (!this.verifySid) {
            throw new Error('TWILIO_VERIFY_SID not configured. Create a Verify Service in Twilio Console.');
        }

        try {
            const formattedNumber = this.formatPhoneNumber(phoneNumber);

            const verification = await this.client.verify.v2
                .services(this.verifySid)
                .verifications.create({
                    to: formattedNumber,
                    channel: 'sms'
                });

            console.log(`✅ SMS verification code sent to ${formattedNumber}, status: ${verification.status}`);
            return { success: true, status: verification.status, channel: 'sms' };
        } catch (error) {
            console.error('❌ Failed to send SMS verification:', error);
            throw new Error(`Failed to send verification code: ${error.message}`);
        }
    }

    // Проверка кода верификации через Twilio Verify
    async checkVerificationCode(phoneNumber, code) {
        if (!this.client || !this.verifySid) {
            throw new Error('Twilio Verify not configured');
        }

        try {
            const formattedNumber = this.formatPhoneNumber(phoneNumber);

            const verificationCheck = await this.client.verify.v2
                .services(this.verifySid)
                .verificationChecks.create({
                    to: formattedNumber,
                    code: code
                });

            console.log(`🔐 Verification check for ${formattedNumber}: ${verificationCheck.status}`);

            return {
                success: verificationCheck.status === 'approved',
                status: verificationCheck.status
            };
        } catch (error) {
            console.error('❌ Verification check failed:', error);
            throw new Error(`Verification check failed: ${error.message}`);
        }
    }

    // Форматирование номера телефона в E.164 формат
    formatPhoneNumber(phoneNumber) {
        // Если номер уже в формате +XXXXX, просто очищаем лишние символы
        if (phoneNumber.startsWith('+')) {
            return '+' + phoneNumber.replace(/\D/g, '');
        }

        // Убираем все нецифровые символы
        let cleaned = phoneNumber.replace(/\D/g, '');

        // Добавляем +
        return '+' + cleaned;
    }

    // Валидация номера телефона
    isValidPhoneNumber(phoneNumber) {
        const cleaned = phoneNumber.replace(/\D/g, '');
        // Минимум 10 цифр, максимум 15 (международный формат)
        return cleaned.length >= 10 && cleaned.length <= 15;
    }
}

export default new WhatsAppService();
