import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      password: hashedPassword,
      name: 'Administrator',
      isAdmin: true
    }
  });

  // Create test user
  const testUser = await prisma.user.create({
    data: {
      email: 'test@example.com',
      password: await bcrypt.hash('test123', 10),
      name: 'Test User',
      phone: '+7 999 123 45 67'
    }
  });

  // Create pricing tiers
  const starter = await prisma.pricingTier.create({
    data: {
      name: 'Стартовый',
      price: 990,
      description: 'Для небольших заведений',
      features: 'Базовые функции\nОдин ресторан\nБазовая поддержка',
      maxRestaurants: 1,
      order: 1
    }
  });

  const business = await prisma.pricingTier.create({
    data: {
      name: 'Бизнес',
      price: 2990,
      description: 'Для сети ресторанов',
      features: 'Все функции тарифа Стартовый\nДо 3 ресторанов\nПриоритетная поддержка',
      maxRestaurants: 3,
      order: 2
    }
  });

  // Create test restaurant
  const restaurant = await prisma.restaurant.create({
    data: {
      name: 'Тестовый Ресторан',
      subdomain: 'test-restaurant',
      description: 'Тестовое заведение для демонстрации',
      phone: '+7 999 888 77 66',
      address: 'ул. Тестовая, 123',
      city: 'Москва',
      country: 'Россия',
      ownerId: testUser.id
    }
  });

  // Create subscription for test restaurant
  await prisma.subscription.create({
    data: {
      userId: testUser.id,
      restaurantId: restaurant.id,
      plan: 'TRIAL',
      status: 'TRIAL',
      pricingTierId: starter.id,
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days trial
    }
  });

  console.log('Database seeded successfully!');
}

main()
  .catch(e => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });