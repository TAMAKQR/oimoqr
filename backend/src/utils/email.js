import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendWelcomeEmail = async (email, name, restaurantName, trialDays = 7) => {
  if (process.env.DISABLE_EMAIL === 'true') {
    console.log('Email sending is disabled for local development');
    return;
  }
  
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Добро пожаловать в QR Menu!',
      html: `
        <h1>Добро пожаловать, ${name}!</h1>
        <p>Ваш ресторан <strong>${restaurantName}</strong> успешно зарегистрирован.</p>
        <p>Вы получили <strong>${trialDays} дней бесплатного пробного периода</strong>.</p>
        <p>За это время вы можете:</p>
        <ul>
          <li>Настроить меню вашего ресторана</li>
          <li>Добавить категории и блюда</li>
          <li>Загрузить фотографии</li>
          <li>Настроить баннеры и социальные сети</li>
        </ul>
        <p>Если у вас возникнут вопросы, свяжитесь с нами.</p>
        <p>С уважением,<br>Команда QR Menu</p>
      `,
    });
  } catch (error) {
    console.error('Error sending welcome email:', error);
  }
};

export const sendTrialEndingEmail = async (email, name, daysLeft) => {
  if (process.env.DISABLE_EMAIL === 'true') {
    console.log('Email sending is disabled for local development');
    return;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: `Ваш пробный период заканчивается через ${daysLeft} дней`,
      html: `
        <h1>Здравствуйте, ${name}!</h1>
        <p>Ваш пробный период заканчивается через <strong>${daysLeft} дней</strong>.</p>
        <p>Чтобы продолжить использование QR Menu, пожалуйста, свяжитесь с администратором для активации подписки.</p>
        <p>С уважением,<br>Команда QR Menu</p>
      `,
    });
  } catch (error) {
    console.error('Error sending trial ending email:', error);
  }
};

export const sendSubscriptionActivatedEmail = async (email, name, plan) => {
  if (process.env.DISABLE_EMAIL === 'true') {
    console.log('Email sending is disabled for local development');
    return;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Ваша подписка активирована!',
      html: `
        <h1>Поздравляем, ${name}!</h1>
        <p>Ваша подписка <strong>${plan}</strong> успешно активирована.</p>
        <p>Теперь вы можете пользоваться всеми возможностями QR Menu без ограничений.</p>
        <p>С уважением,<br>Команда QR Menu</p>
      `,
    });
  } catch (error) {
    console.error('Error sending subscription activated email:', error);
  }
};