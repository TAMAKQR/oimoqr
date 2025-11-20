import { prisma } from '../config/prisma.js';

async function migrateModifiers() {
  console.log('🔄 Starting modifier migration...');

  // Get all modifiers
  const modifiers = await prisma.modifier.findMany({
    include: {
      options: true
    }
  });

  console.log(`Found ${modifiers.length} modifiers`);

  let migratedCount = 0;

  for (const modifier of modifiers) {
    // If modifier has no options but has a price, create an option
    if (modifier.options.length === 0 && modifier.price !== null && modifier.price !== undefined) {
      console.log(`  ✅ Migrating modifier "${modifier.name}" (price: ${modifier.price})`);
      
      await prisma.modifierOption.create({
        data: {
          modifierId: modifier.id,
          name: modifier.name,
          price: modifier.price
        }
      });

      migratedCount++;
    }
  }

  console.log(`\n✅ Migration complete! Created ${migratedCount} modifier options.`);
  await prisma.$disconnect();
}

migrateModifiers().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
