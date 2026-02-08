import { prisma } from './src/config/prisma.js';

async function migrateCustomers() {
    try {
        // Проверяем существующих клиентов
        const customers = await prisma.customer.findMany();
        console.log(`Найдено клиентов: ${customers.length}`);

        if (customers.length > 0) {
            // Показываем данные
            customers.forEach(c => {
                console.log(`- ID: ${c.id}, Phone: ${c.phone}, RestaurantID: ${c.restaurantId}`);
            });

            // Проверяем дубликаты телефонов
            const phoneGroups = {};
            customers.forEach(c => {
                if (!phoneGroups[c.phone]) {
                    phoneGroups[c.phone] = [];
                }
                phoneGroups[c.phone].push(c);
            });

            const duplicates = Object.entries(phoneGroups).filter(([phone, customers]) => customers.length > 1);

            if (duplicates.length > 0) {
                console.log('\n⚠️ ВНИМАНИЕ! Найдены дубликаты телефонов:');
                duplicates.forEach(([phone, customers]) => {
                    console.log(`Phone: ${phone} - ${customers.length} клиентов`);
                });
                console.log('\nНужно оставить только одного клиента на номер.');
                console.log('Остальные будут удалены при миграции.');
            } else {
                console.log('\n✅ Дубликатов телефонов нет. Миграция будет безопасной.');
            }
        }

        // Применяем миграцию вручную через SQL
        console.log('\nПрименение миграции...');

        // 1. Удаляем индекс
        await prisma.$executeRaw`DROP INDEX IF EXISTS "Customer_phone_restaurantId_key"`;
        console.log('✅ Удален индекс Customer_phone_restaurantId_key');

        // 2. Удаляем колонку restaurantId
        await prisma.$executeRaw`ALTER TABLE "Customer" DROP COLUMN IF EXISTS "restaurantId"`;
        console.log('✅ Удалена колонка restaurantId');

        // 3. Создаем новый уникальный индекс по phone
        await prisma.$executeRaw`CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone")`;
        console.log('✅ Создан уникальный индекс Customer_phone_key');

        console.log('\n✅ Миграция завершена успешно!');

    } catch (error) {
        console.error('❌ Ошибка:', error);
    } finally {
        await prisma.$disconnect();
    }
}

migrateCustomers();
