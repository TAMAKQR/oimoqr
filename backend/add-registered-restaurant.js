import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Adding registeredRestaurantId column to Customer...');
    await prisma.$executeRawUnsafe(`
    ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "registeredRestaurantId" TEXT;
  `);
    console.log('✓ Column added (if not exists)');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
