import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testConnection() {
    try {
        console.log('🔍 Проверка подключения к БД...\n');

        // Проверяем пользователей
        const users = await prisma.user.findMany({
            include: {
                restaurants: true
            }
        });
        console.log(`✅ Пользователей: ${users.length}`);
        users.forEach(u => {
            console.log(`   - ${u.email} (рестораны: ${u.restaurants.length})`);
        });

        // Проверяем рестораны
        const restaurants = await prisma.restaurant.findMany({
            include: {
                categories: true,
                dishes: true
            }
        });
        console.log(`\n✅ Ресторанов: ${restaurants.length}`);
        restaurants.forEach(r => {
            console.log(`   - ${r.name} (${r.subdomain}): категорий ${r.categories.length}, блюд ${r.dishes.length}`);
        });

        // Проверяем категории
        const categories = await prisma.category.findMany();
        console.log(`\n✅ Категорий: ${categories.length}`);

        // Проверяем блюда
        const dishes = await prisma.dish.findMany();
        console.log(`✅ Блюд: ${dishes.length}`);

    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        console.error('Детали:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testConnection();
