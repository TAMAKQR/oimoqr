import { prisma } from '../config/prisma.js';

export const getActivePricingTiers = async (req, res, next) => {
  try {
    const pricingTiers = await prisma.pricingTier.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' }
    });

    res.json(pricingTiers);
  } catch (error) {
    next(error);
  }
};