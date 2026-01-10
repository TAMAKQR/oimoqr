import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Adding deliveryType, paymentMethod, customerAddressId to Order...');

    await prisma.$executeRawUnsafe(`
    ALTER TABLE "Order"
    ADD COLUMN IF NOT EXISTS "deliveryType" TEXT DEFAULT 'delivery',
    ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT DEFAULT 'cash',
    ADD COLUMN IF NOT EXISTS "customerAddressId" TEXT;
  `);

    await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'Order_customerAddressId_fkey'
      ) THEN
        ALTER TABLE "Order"
        ADD CONSTRAINT "Order_customerAddressId_fkey"
        FOREIGN KEY ("customerAddressId") REFERENCES "CustomerAddress"("id") ON DELETE SET NULL;
      END IF;
    END$$;
  `);

    console.log('✓ Columns added');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
