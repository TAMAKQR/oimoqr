import { prisma } from '../config/prisma.js';
import { getMoneyMinorUnits } from '../utils/finikBilling.js';

export const getActivePricingTiers = async (req, res, next) => {
  try {
    const pricingTiers = await prisma.pricingTier.findMany({
      where: {
        isActive: true
      },
      orderBy: { order: 'asc' }
    });

    res.json(pricingTiers.map((tier) => {
      const { externalPriceId: _externalPriceId, ...publicTier } = tier;
      return {
        ...publicTier,
        isPurchasable: Boolean(
          tier.onlinePaymentEnabled
          && String(tier.currency).toUpperCase() === 'KGS'
          && getMoneyMinorUnits(tier.price) !== null
        )
      };
    }));
  } catch (error) {
    next(error);
  }
};
