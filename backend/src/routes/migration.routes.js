import express from 'express';
import { prisma } from '../config/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/migrate-modifiers', authenticate, async (req, res, next) => {
  try {
    // Only allow admin users
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    console.log('🔄 Starting modifier migration...');

    // Get all modifiers
    const modifiers = await prisma.modifier.findMany({
      include: {
        options: true
      }
    });

    console.log(`Found ${modifiers.length} modifiers`);

    let migratedCount = 0;
    const migrated = [];

    for (const modifier of modifiers) {
      // If modifier has no options but has a price, create an option
      if (modifier.options.length === 0 && modifier.price !== null && modifier.price !== undefined) {
        console.log(`  ✅ Migrating modifier "${modifier.name}" (price: ${modifier.price})`);
        
        const option = await prisma.modifierOption.create({
          data: {
            modifierId: modifier.id,
            name: modifier.name,
            price: modifier.price
          }
        });

        migrated.push({
          modifierName: modifier.name,
          price: modifier.price,
          optionId: option.id
        });

        migratedCount++;
      }
    }

    console.log(`\n✅ Migration complete! Created ${migratedCount} modifier options.`);

    res.json({
      success: true,
      message: `Migration complete! Created ${migratedCount} modifier options.`,
      totalModifiers: modifiers.length,
      migratedCount,
      migrated
    });
  } catch (error) {
    next(error);
  }
});

export default router;
