import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function createBasicTier() {
  try {
    const tier = await prisma.pricingTier.create({
      data: {
        name: 'Базовый',
        price: 20,
        description: 'До 5 ресторанов',
        maxRestaurants: 5,
        order: 1,
        isActive: true
      }
    });

    console.log('✅ Базовый тариф создан:', tier);
  } catch (error) {
    console.error('❌ Ошибка создания тарифа:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createBasicTier();