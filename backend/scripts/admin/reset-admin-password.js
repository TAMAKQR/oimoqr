import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function resetAdminPassword() {
    try {
        console.log('🔄 Обновление пароля для админа...');

        // Новый хеш для пароля "admin123"
        const newPasswordHash = '$2a$10$Vm7v3BxezQJEU6s5QtAvGeAFZRk/TS3L03R452kaSDc21ROrnxvC2';

        const admin = await prisma.user.update({
            where: { email: 'shoppingalanya@gmail.com' },
            data: { password: newPasswordHash }
        });

        console.log('✅ Пароль успешно обновлен!');
        console.log('📧 Email:', admin.email);
        console.log('👤 Имя:', admin.name);
        console.log('🔑 Новый пароль: admin123');

    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

resetAdminPassword();
