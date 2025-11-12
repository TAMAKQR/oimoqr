import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function seed() {
  try {
    console.log('🌱 Seeding database...');

    // Delete existing seed data to avoid conflicts
    console.log('🧹 Deleting existing test users...');
    await prisma.user.deleteMany({
      where: {
        email: { in: ['admin@qrmenu.com', 'test@restaurant.com'] },
      },
    });
    console.log('✅ Test users deleted.');

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.create({
      data: {
        email: 'admin@qrmenu.com',
        password: hashedPassword,
        name: 'Admin',
        isAdmin: true,
      },
    });
    console.log('✅ Admin user created');

    // Create test restaurant
    const testUser = await prisma.user.create({
      data: {
        email: 'test@restaurant.com',
        password: await bcrypt.hash('test123', 10),
        name: 'Test Owner',
        phone: '+7 (999) 123-45-67',
        restaurants: {
          create: {
            name: 'Тестовый ресторан',
            subdomain: 'testrestaurant',
            address: 'г. Москва, ул. Тестовая, д. 1',
            phone: '+7 (999) 123-45-67',
            description: 'Лучший ресторан в городе',
            deliveryEnabled: true,
            deliveryFee: 200,
            minOrderAmount: 500,
            socialLinks: {
              create: {
                instagram: 'testrestaurant',
                whatsapp: '79991234567',
              },
            },
          },
        },
      },
      include: {
        restaurants: true,
      },
    });
    console.log('✅ Test restaurant created');

    // Create subscription for the test restaurant
    const trialConfig = await prisma.trialConfig.findFirst();
    const trialDays = trialConfig?.days || 7;
    const trialEndDate = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

    await prisma.subscription.create({
      data: {
        userId: testUser.id,
        restaurantId: testUser.restaurants[0].id,
        plan: 'TRIAL',
        status: 'TRIAL',
        trialEndsAt: trialEndDate,
        currentPeriodStart: new Date(),
        currentPeriodEnd: trialEndDate,
      },
    });
    console.log('✅ Trial subscription created for test restaurant');

    console.log('\n🎉 Database seeded successfully!');
    console.log('\n📝 Test accounts:');
    console.log('Admin: admin@qrmenu.com / admin123');
    console.log('Restaurant: test@restaurant.com / test123');
    console.log('\n🌐 Test menu: http://localhost:5173/menu/testrestaurant');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();