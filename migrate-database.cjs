/**
 * Скрипт для миграции данных из Supabase в Render PostgreSQL
 * 
 * Использование:
 * node migrate-database.js
 */

const { PrismaClient } = require('@prisma/client');

// Старая база (Supabase)
const oldDb = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres.tbztvmdjnjqivnxuyelr:DAS230411Alina@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres"
        }
    }
});

// Новая база (Render)
const newDb = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://oimoqr_database_user:t41Ai9BF0ePaiR4wGGiQl6p4a9an4Tkz@dpg-d60v7gnfte5s73bgoj60-a.ohio-postgres.render.com/oimoqr_database"
        }
    }
});

async function migrateData() {
    console.log('🚀 Начинаем миграцию данных...\n');

    try {
        // 1. Пользователи
        console.log('1️⃣ Мигрируем пользователей...');
        const users = await oldDb.user.findMany();
        console.log(`   Найдено пользователей: ${users.length}`);
        for (const user of users) {
            await newDb.user.upsert({
                where: { id: user.id },
                create: user,
                update: user
            });
        }
        console.log('   ✅ Пользователи мигрированы\n');

        // 2. Рестораны
        console.log('2️⃣ Мигрируем рестораны...');
        const restaurants = await oldDb.restaurant.findMany();
        console.log(`   Найдено ресторанов: ${restaurants.length}`);
        for (const restaurant of restaurants) {
            await newDb.restaurant.upsert({
                where: { id: restaurant.id },
                create: restaurant,
                update: restaurant
            });
        }
        console.log('   ✅ Рестораны мигрированы\n');

        // 3. Языки ресторанов
        console.log('3️⃣ Мигрируем языки...');
        const languages = await oldDb.restaurantLanguage.findMany();
        console.log(`   Найдено языков: ${languages.length}`);
        for (const lang of languages) {
            await newDb.restaurantLanguage.upsert({
                where: { id: lang.id },
                create: lang,
                update: lang
            });
        }
        console.log('   ✅ Языки мигрированы\n');

        // 4. Группы категорий
        console.log('4️⃣ Мигрируем группы категорий...');
        const categoryGroups = await oldDb.categoryGroup.findMany();
        console.log(`   Найдено групп: ${categoryGroups.length}`);
        for (const group of categoryGroups) {
            await newDb.categoryGroup.upsert({
                where: { id: group.id },
                create: group,
                update: group
            });
        }
        console.log('   ✅ Группы категорий мигрированы\n');

        // 5. Категории
        console.log('5️⃣ Мигрируем категории...');
        const categories = await oldDb.category.findMany();
        console.log(`   Найдено категорий: ${categories.length}`);
        for (const category of categories) {
            await newDb.category.upsert({
                where: { id: category.id },
                create: category,
                update: category
            });
        }
        console.log('   ✅ Категории мигрированы\n');

        // 6. Переводы категорий
        console.log('6️⃣ Мигрируем переводы категорий...');
        const categoryTranslations = await oldDb.categoryTranslation.findMany();
        console.log(`   Найдено переводов: ${categoryTranslations.length}`);
        for (const trans of categoryTranslations) {
            await newDb.categoryTranslation.upsert({
                where: { id: trans.id },
                create: trans,
                update: trans
            });
        }
        console.log('   ✅ Переводы категорий мигрированы\n');

        // 7. Блюда
        console.log('7️⃣ Мигрируем блюда...');
        const dishes = await oldDb.dish.findMany();
        console.log(`   Найдено блюд: ${dishes.length}`);
        for (const dish of dishes) {
            await newDb.dish.upsert({
                where: { id: dish.id },
                create: dish,
                update: dish
            });
        }
        console.log('   ✅ Блюда мигрированы\n');

        // 8. Переводы блюд
        console.log('8️⃣ Мигрируем переводы блюд...');
        const dishTranslations = await oldDb.dishTranslation.findMany();
        console.log(`   Найдено переводов: ${dishTranslations.length}`);
        for (const trans of dishTranslations) {
            await newDb.dishTranslation.upsert({
                where: { id: trans.id },
                create: trans,
                update: trans
            });
        }
        console.log('   ✅ Переводы блюд мигрированы\n');

        // 9. Модификаторы
        console.log('9️⃣ Мигрируем модификаторы...');
        const modifiers = await oldDb.modifier.findMany();
        console.log(`   Найдено модификаторов: ${modifiers.length}`);
        for (const modifier of modifiers) {
            await newDb.modifier.upsert({
                where: { id: modifier.id },
                create: modifier,
                update: modifier
            });
        }
        console.log('   ✅ Модификаторы мигрированы\n');

        // 10. Опции модификаторов
        console.log('🔟 Мигрируем опции модификаторов...');
        const modifierOptions = await oldDb.modifierOption.findMany();
        console.log(`   Найдено опций: ${modifierOptions.length}`);
        for (const option of modifierOptions) {
            await newDb.modifierOption.upsert({
                where: { id: option.id },
                create: option,
                update: option
            });
        }
        console.log('   ✅ Опции модификаторов мигрированы\n');

        // 11. Тарифные планы
        console.log('1️⃣1️⃣ Мигрируем тарифные планы...');
        const pricingTiers = await oldDb.pricingTier.findMany();
        console.log(`   Найдено тарифов: ${pricingTiers.length}`);
        for (const tier of pricingTiers) {
            await newDb.pricingTier.upsert({
                where: { id: tier.id },
                create: tier,
                update: tier
            });
        }
        console.log('   ✅ Тарифные планы мигрированы\n');

        // 12. Подписки
        console.log('1️⃣2️⃣ Мигрируем подписки...');
        const subscriptions = await oldDb.subscription.findMany();
        console.log(`   Найдено подписок: ${subscriptions.length}`);
        for (const sub of subscriptions) {
            await newDb.subscription.upsert({
                where: { id: sub.id },
                create: sub,
                update: sub
            });
        }
        console.log('   ✅ Подписки мигрированы\n');

        // 13. Сотрудники
        console.log('1️⃣3️⃣ Мигрируем сотрудников...');
        const staff = await oldDb.restaurantStaff.findMany();
        console.log(`   Найдено сотрудников: ${staff.length}`);
        for (const member of staff) {
            await newDb.restaurantStaff.upsert({
                where: { id: member.id },
                create: member,
                update: member
            });
        }
        console.log('   ✅ Сотрудники мигрированы\n');

        // 14. Клиенты
        console.log('1️⃣4️⃣ Мигрируем клиентов...');
        const customers = await oldDb.customer.findMany();
        console.log(`   Найдено клиентов: ${customers.length}`);
        for (const customer of customers) {
            await newDb.customer.upsert({
                where: { id: customer.id },
                create: customer,
                update: customer
            });
        }
        console.log('   ✅ Клиенты мигрированы\n');

        // 15. Заказы
        console.log('1️⃣5️⃣ Мигрируем заказы...');
        const orders = await oldDb.order.findMany();
        console.log(`   Найдено заказов: ${orders.length}`);
        for (const order of orders) {
            await newDb.order.upsert({
                where: { id: order.id },
                create: order,
                update: order
            });
        }
        console.log('   ✅ Заказы мигрированы\n');

        // 16. Элементы заказов
        console.log('1️⃣6️⃣ Мигрируем элементы заказов...');
        const orderItems = await oldDb.orderItem.findMany();
        console.log(`   Найдено элементов: ${orderItems.length}`);
        for (const item of orderItems) {
            await newDb.orderItem.upsert({
                where: { id: item.id },
                create: item,
                update: item
            });
        }
        console.log('   ✅ Элементы заказов мигрированы\n');

        // 17. Избранное
        console.log('1️⃣7️⃣ Мигрируем избранное...');
        const favorites = await oldDb.customerFavorite.findMany();
        console.log(`   Найдено записей: ${favorites.length}`);
        for (const fav of favorites) {
            await newDb.customerFavorite.upsert({
                where: { id: fav.id },
                create: fav,
                update: fav
            });
        }
        console.log('   ✅ Избранное мигрировано\n');

        // 18. Просмотры меню
        console.log('1️⃣8️⃣ Мигрируем просмотры меню...');
        const menuViews = await oldDb.menuView.findMany();
        console.log(`   Найдено просмотров: ${menuViews.length}`);
        for (const view of menuViews) {
            await newDb.menuView.upsert({
                where: { id: view.id },
                create: view,
                update: view
            });
        }
        console.log('   ✅ Просмотры меню мигрированы\n');

        console.log('✅ Миграция данных завершена успешно!');
        console.log('\n📊 Статистика:');
        console.log(`   Пользователи: ${users.length}`);
        console.log(`   Рестораны: ${restaurants.length}`);
        console.log(`   Категории: ${categories.length}`);
        console.log(`   Блюда: ${dishes.length}`);
        console.log(`   Заказы: ${orders.length}`);
        console.log(`   Клиенты: ${customers.length}`);

    } catch (error) {
        console.error('❌ Ошибка при миграции:', error);
        throw error;
    } finally {
        await oldDb.$disconnect();
        await newDb.$disconnect();
    }
}

// Запуск миграции
migrateData()
    .then(() => {
        console.log('\n🎉 Готово! Теперь можете обновить DATABASE_URL на Render.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Критическая ошибка:', error);
        process.exit(1);
    });
