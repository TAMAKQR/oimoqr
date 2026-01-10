import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedOnlineStorePricing() {
    try {
        console.log('🛍️ Создание тарифа для онлайн-магазина...');

        // Создаем тариф для онлайн-магазина
        const onlineStoreTier = await prisma.pricingTier.create({
            data: {
                name: 'Онлайн Магазин',
                price: 2999,
                description: 'Полноценный интернет-магазин с управлением товарами и заказами',
                features: JSON.stringify({
                    features: [
                        'Неограниченное количество товаров',
                        'Вариации товаров (размеры, цвета)',
                        'Управление складом и остатками',
                        'Система заказов с уведомлениями',
                        'Интеграция с WhatsApp',
                        'Аналитика продаж',
                        'SEO оптимизация',
                        'Мультивалютность',
                        'Персональный поддомен',
                        'Техническая поддержка 24/7'
                    ],
                    businessType: 'ONLINE_STORE'
                }),
                maxRestaurants: 1,
                order: 3,
                isActive: true
            }
        });

        console.log('✅ Тариф "Онлайн Магазин" создан:');
        console.log(`   ID: ${onlineStoreTier.id}`);
        console.log(`   Цена: ${onlineStoreTier.price} руб/мес`);
        console.log(`   Функции: ${JSON.parse(onlineStoreTier.features).features.length} шт.`);

    } catch (error) {
        console.error('❌ Ошибка при создании тарифа:', error);
    } finally {
        await prisma.$disconnect();
    }
}

seedOnlineStorePricing();
