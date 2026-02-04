import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function applyMigration() {
    console.log('🔧 Applying fix for dish deletion...');

    try {
        // Drop existing foreign key constraints
        console.log('Dropping existing foreign key constraints...');
        await prisma.$executeRawUnsafe(`
      ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_dishId_fkey";
    `);

        await prisma.$executeRawUnsafe(`
      ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_productId_fkey";
    `);

        // Add new foreign key constraints with ON DELETE SET NULL
        console.log('Adding new foreign key constraints with ON DELETE SET NULL...');
        await prisma.$executeRawUnsafe(`
      ALTER TABLE "OrderItem" 
        ADD CONSTRAINT "OrderItem_dishId_fkey" 
        FOREIGN KEY ("dishId") 
        REFERENCES "Dish"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    `);

        await prisma.$executeRawUnsafe(`
      ALTER TABLE "OrderItem" 
        ADD CONSTRAINT "OrderItem_productId_fkey" 
        FOREIGN KEY ("productId") 
        REFERENCES "Product"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    `);

        console.log('✅ Migration applied successfully!');
        console.log('');
        console.log('Now dishes can be deleted. If a dish is used in orders:');
        console.log('- The backend will check and show a warning message');
        console.log('- If force-deleted, OrderItem.dishId will be set to NULL');

    } catch (error) {
        console.error('❌ Error applying migration:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

applyMigration();
