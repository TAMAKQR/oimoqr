import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Загружаем production переменные окружения
dotenv.config({ path: '.env.production' });

const prisma = new PrismaClient();

async function fixMissingOptions() {
    try {
        console.log('🔄 Начинаем исправление модификаторов...\n');

        // Проверим подключение
        await prisma.$connect();
        console.log('✅ Подключение к базе данных успешно\n');

        // Находим все модификаторы без опций
        const modifiersWithoutOptions = await prisma.modifier.findMany({
            include: {
                options: true,
                dish: {
                    select: { name: true }
                }
            }
        });

        const needFix = modifiersWithoutOptions.filter(m => m.options.length === 0);

        console.log(`📊 Найдено модификаторов без опций: ${needFix.length}\n`);

        if (needFix.length === 0) {
            console.log('✅ Все модификаторы уже имеют опции!');
            return;
        }

        let created = 0;
        let skipped = 0;

        for (const modifier of needFix) {
            console.log(`📝 Обработка: "${modifier.dish.name}" → "${modifier.name}"`);
            console.log(`   Текущая цена модификатора: ${modifier.price}`);

            // Если у модификатора есть цена, создаем опцию с этой ценой
            if (modifier.price !== null && modifier.price !== undefined) {
                await prisma.modifierOption.create({
                    data: {
                        modifierId: modifier.id,
                        name: modifier.name,
                        price: modifier.price
                    }
                });
                console.log(`   ✅ Создана опция: "${modifier.name}" (${modifier.price})\n`);
                created++;
            } else {
                // Если цены нет, создаем опцию с ценой 0
                await prisma.modifierOption.create({
                    data: {
                        modifierId: modifier.id,
                        name: modifier.name,
                        price: 0
                    }
                });
                console.log(`   ⚠️ Создана опция с ценой 0: "${modifier.name}"\n`);
                created++;
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log(`✅ Исправление завершено!`);
        console.log(`📊 Создано опций: ${created}`);
        console.log(`⚠️ Пропущено: ${skipped}`);
        console.log('='.repeat(50));

    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

fixMissingOptions();
