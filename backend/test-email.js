import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function testEmail() {
  try {
    console.log('📧 Тестируем отправку email...');
    console.log('SMTP Host:', process.env.SMTP_HOST);
    console.log('SMTP User:', process.env.SMTP_USER);
    console.log('SMTP From:', process.env.SMTP_FROM);
    
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: process.env.SMTP_USER, // Отправляем самому себе
      subject: '✅ Тест OimoQR Email',
      html: `
        <h1>🎉 Email работает!</h1>
        <p>Если вы получили это письмо, значит SMTP настроен правильно.</p>
        <p>Теперь приветственные письма будут отправляться автоматически при регистрации.</p>
        <hr>
        <p><small>Отправлено из OimoQR Backend</small></p>
      `,
    });

    console.log('✅ Письмо успешно отправлено!');
    console.log('Message ID:', info.messageId);
    console.log('📬 Проверьте почту:', process.env.SMTP_USER);
  } catch (error) {
    console.error('❌ Ошибка отправки:', error.message);
    console.error('Детали:', error);
  }
}

testEmail();