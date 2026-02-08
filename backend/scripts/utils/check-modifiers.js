import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkModifiers() {
    try {
        console.log('🔍 Проверяем модификаторы в базе данных...\n');

        // Получаем первое блюдо с модификаторами
        const dish = await prisma.dish.findFirst({
            include: {
                modifiers: {
                    include: {
                        options: true
                    }
                }
            },
            where: {
                modifiers: {
                    some: {}
                }
            }
        });

        if (!dish) {
            console.log('❌ Блюд с модификаторами не найдено');
            return;
        }

        console.log(`✅ Найдено блюдо: "${dish.name}"`);
        console.log(`📊 Количество модификаторов: ${dish.modifiers.length}\n`);

        dish.modifiers.forEach((modifier, index) => {
            console.log(`Модификатор #${index + 1}:`);
            console.log(`  Название: ${modifier.name}`);
            console.log(`  Тип: ${modifier.type}`);
            console.log(`  Цена: ${modifier.price}`);
            console.log(`  Количество опций: ${modifier.options.length}`);

            if (modifier.options.length > 0) {
                console.log(`  Опции:`);
                modifier.options.forEach((option) => {
                    console.log(`    - ${option.name}: ${option.price} ₽`);
                });
            } else {
                console.log(`  ⚠️ ВНИМАНИЕ: У модификатора нет опций!`);
            }
            console.log();
        });

    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkModifiers();