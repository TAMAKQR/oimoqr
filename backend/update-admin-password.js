import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Загружаем production переменные окружения
dotenv.config({ path: '.env.production' });

const prisma = new PrismaClient();

async function updateAdminPassword() {
    try {
        console.log('🔄 Подключаемся к Supabase...');

        // Проверим подключение
        await prisma.$connect();
        console.log('✅ Подключение к базе данных успешно');

        // Найдем админа
        const adminUser = await prisma.user.findFirst({
            where: {
                email: 'shoppingalanya@gmail.com',
                isAdmin: true
            }
        });

        if (!adminUser) {
            console.log('❌ Админ с email shoppingalanya@gmail.com не найден');
            return;
        }

        console.log(`✅ Найден админ: ${adminUser.name} (${adminUser.email})`);

        // Обновим пароль
        const newPasswordHash = '$2a$10$esoTIFWPX/GhnDcNvuzQEOkplM2qqQ/MD3qs.lqcYJKElXzyK4SMi';

        await prisma.user.update({
            where: { id: adminUser.id },
            data: { password: newPasswordHash }
        });

        console.log('✅ Пароль админа успешно обновлен!');
        console.log('🔑 Новый хэш пароля:', newPasswordHash);

    } catch (error) {
        console.error('❌ Ошибка при обновлении пароля:', error);
    } finally {
        await prisma.$disconnect();
    }
}

updateAdminPassword();