import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Adding entrance, floor, apartment, comment fields to CustomerAddress...');

    try {
        // Добавляем новые поля
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "CustomerAddress" 
            ADD COLUMN IF NOT EXISTS "entrance" TEXT,
            ADD COLUMN IF NOT EXISTS "floor" TEXT,
            ADD COLUMN IF NOT EXISTS "apartment" TEXT,
            ADD COLUMN IF NOT EXISTS "comment" TEXT
        `);

        console.log('✓ Fields added successfully');
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
