import { prisma } from './src/config/prisma.js';

async function fixCoordinates() {
    try {
        await prisma.$executeRaw`ALTER TABLE "CustomerAddress" ALTER COLUMN "latitude" DROP NOT NULL`;
        console.log('✅ latitude made optional');

        await prisma.$executeRaw`ALTER TABLE "CustomerAddress" ALTER COLUMN "longitude" DROP NOT NULL`;
        console.log('✅ longitude made optional');

        console.log('\n✅ Migration completed successfully!');
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixCoordinates();
