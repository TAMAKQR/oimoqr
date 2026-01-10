import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPricingTiers() {
    try {
        console.log('💰 Проверка тарифов...\n');

        const tiers = await prisma.pricingTier.findMany();

        tiers.forEach(tier => {
            console.log(`📦 ${tier.name}`);
            console.log(`   Цена: ${tier.price}`);
            console.log(`   Описание: ${tier.description}`);
            console.log(`   Features: ${tier.features}`);
            console.log('');
        });

    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkPricingTiers();
