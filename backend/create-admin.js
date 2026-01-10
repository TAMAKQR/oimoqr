import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createAdmin() {
    try {
        const email = 'admin@oimoqr.com';
        const password = 'admin123';
        const name = 'Администратор';

        // Проверяем есть ли уже пользователь
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            console.log('❌ Пользователь с email', email, 'уже существует');
            return;
        }

        // Хешируем пароль
        const hashedPassword = await bcrypt.hash(password, 10);

        // Создаем админа
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                isAdmin: true
            }
        });

        console.log('✅ Администратор успешно создан!');
        console.log('==========================================');
        console.log('📧 Email:', email);
        console.log('🔑 Пароль:', password);
        console.log('👤 Имя:', name);
        console.log('🎭 Админ:', user.isAdmin);
        console.log('==========================================');
        console.log('\n🌐 Войдите в админку: http://localhost:5173/admin');
        console.log('\n⚠️  ВАЖНО: Смените пароль после первого входа!');

    } catch (error) {
        console.error('❌ Ошибка при создании администратора:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

createAdmin();
