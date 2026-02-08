import { prisma } from './src/config/prisma.js';

async function checkUsers() {
    try {
        const users = await prisma.user.findMany({
            select: {
                email: true,
                name: true,
                isAdmin: true
            }
        });

        console.log('Пользователи в базе данных:');
        if (users.length === 0) {
            console.log('Нет пользователей');
        } else {
            users.forEach(user => {
                console.log(`- Email: ${user.email}, Имя: ${user.name}, Админ: ${user.isAdmin ? 'Да' : 'Нет'}`);
            });
        }
    } catch (error) {
        console.error('Ошибка:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkUsers();