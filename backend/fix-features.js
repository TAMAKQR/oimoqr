import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixFeatures() {
    try {
        console.log('🔍 Проверка PricingTier.features...\n');

        const tiers = await prisma.pricingTier.findMany();

        for (const tier of tiers) {
            console.log(`\n📦 Тариф: ${tier.name}`);
            console.log(`   Features (тип: ${typeof tier.features}):`, tier.features);

            // Если features - строка, но не JSON, конвертируем
            if (tier.features && typeof tier.features === 'string') {
                try {
                    JSON.parse(tier.features);
                    console.log('   ✅ Уже валидный JSON');
                } catch (e) {
                    console.log('   ⚠️  Не JSON, конвертируем...');

                    // Конвертируем строку в JSON массив
                    const featuresArray = tier.features.split(',').map(f => f.trim()).filter(Boolean);
                    const featuresJson = JSON.stringify(featuresArray);

                    await prisma.pricingTier.update({
                        where: { id: tier.id },
                        data: { features: featuresJson }
                    });

                    console.log(`   ✅ Обновлено: ${featuresJson}`);
                }
            }
        }

        console.log('\n✅ Готово!');
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

fixFeatures();
