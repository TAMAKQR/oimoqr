import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkData() {
    try {
        const restaurants = await prisma.restaurant.count();
        const dishes = await prisma.dish.count();
        const categories = await prisma.category.count();
        const orders = await prisma.order.count();
        const customers = await prisma.customer.count();
        const users = await prisma.user.count();

        console.log('📊 ДАННЫЕ В БАЗЕ:');
        console.log('==================');
        console.log('👤 Users:', users);
        console.log('🏪 Restaurants:', restaurants);
        console.log('📂 Categories:', categories);
        console.log('🍽️ Dishes:', dishes);
        console.log('📦 Orders:', orders);
        console.log('👥 Customers:', customers);
        console.log('==================');
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkData();
