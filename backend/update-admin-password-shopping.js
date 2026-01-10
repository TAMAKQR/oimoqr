import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function updatePassword() {
    try {
        const email = 'shoppingalanya@gmail.com';
        const newPassword = 'shoppingalanya@gmail.com'; // Такой же как email

        console.log(`🔐 Обновление пароля для ${email}...`);

        // Проверяем пользователя
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            console.log('❌ Пользователь не найден!');
            return;
        }

        console.log(`✅ Пользователь найден: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   isAdmin: ${user.isAdmin}`);

        // Хешируем новый пароль
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Обновляем пароль
        await prisma.user.update({
            where: { email },
            data: {
                password: hashedPassword,
                isAdmin: true // Убеждаемся что это админ
            }
        });

        console.log('\n✅ Пароль успешно обновлен!');
        console.log(`📧 Email: ${email}`);
        console.log(`🔑 Пароль: ${newPassword}`);
        console.log('👑 Статус: Супер админ');

    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

updatePassword();
