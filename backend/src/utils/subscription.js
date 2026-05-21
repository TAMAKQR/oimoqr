import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const calculateTrialEndDate = (days = 7) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

const normalizeBusinessType = (businessType) => {
  const value = typeof businessType === 'string' ? businessType.trim().toUpperCase() : '';
  return value || 'RESTAURANT';
};

export const getTrialConfigForBusinessType = async (businessType) => {
  const normalizedBusinessType = normalizeBusinessType(businessType);
  const fallbackDays = parseInt(process.env.TRIAL_PERIOD_DAYS) || 7;

  try {
    const config = await prisma.trialConfig.findFirst({
      where: {
        OR: [
          { businessType: normalizedBusinessType },
          { businessType: 'ALL' }
        ]
      },
      orderBy: [
        { businessType: 'asc' }
      ]
    });

    if (config?.businessType === normalizedBusinessType) {
      return config;
    }

    const exactConfig = await prisma.trialConfig.findUnique({
      where: { businessType: normalizedBusinessType }
    });

    return exactConfig || config || {
      businessType: normalizedBusinessType,
      name: 'Пробный период',
      days: fallbackDays,
      message: `Вы получите ${fallbackDays} дней бесплатного пробного периода`
    };
  } catch (error) {
    console.error('Error fetching trial config:', error);
    return {
      businessType: normalizedBusinessType,
      name: 'Пробный период',
      days: fallbackDays,
      message: `Вы получите ${fallbackDays} дней бесплатного пробного периода`
    };
  }
};

export const buildTrialSubscriptionData = async (businessType) => {
  const normalizedBusinessType = normalizeBusinessType(businessType);
  const trialConfig = await getTrialConfigForBusinessType(normalizedBusinessType);
  const trialEndDate = calculateTrialEndDate(trialConfig.days);

  return {
    trialConfig,
    subscriptionData: {
      plan: `TRIAL_${normalizedBusinessType}`,
      status: 'TRIAL',
      trialEndsAt: trialEndDate,
      currentPeriodStart: new Date(),
      currentPeriodEnd: trialEndDate
    }
  };
};

export const calculateSubscriptionEndDate = (plan) => {
  const date = new Date();
  
  if (plan === 'MONTHLY') {
    date.setMonth(date.getMonth() + 1);
  } else if (plan === 'YEARLY') {
    date.setFullYear(date.getFullYear() + 1);
  }
  
  return date;
};

export const isSubscriptionActive = (subscription) => {
  if (!subscription) return false;
  
  const now = new Date();
  
  if (subscription.status === 'TRIAL') {
    return subscription.trialEndsAt && new Date(subscription.trialEndsAt) > now;
  }
  
  if (subscription.status === 'ACTIVE') {
    return subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd) > now;
  }
  
  return false;
};

export const getSubscriptionStatus = (subscription) => {
  if (!subscription) return 'NONE';
  
  const now = new Date();
  
  if (subscription.status === 'TRIAL') {
    if (subscription.trialEndsAt && new Date(subscription.trialEndsAt) > now) {
      return 'TRIAL_ACTIVE';
    }
    return 'TRIAL_EXPIRED';
  }
  
  if (subscription.status === 'ACTIVE') {
    if (subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd) > now) {
      return 'ACTIVE';
    }
    return 'EXPIRED';
  }
  
  return subscription.status;
};

export const getTrialDaysRemaining = (subscription) => {
  if (!subscription || subscription.status !== 'TRIAL') return 0;
  
  const now = new Date();
  const trialEnds = new Date(subscription.trialEndsAt);
  
  if (trialEnds <= now) return 0;
  
  const daysRemaining = Math.ceil((trialEnds - now) / (1000 * 60 * 60 * 24));
  return daysRemaining;
};

export const calculateSubscriptionPrice = async (restaurantCount, businessType = null) => {
  if (restaurantCount <= 0) return 0;

  try {
    const normalizedBusinessType = typeof businessType === 'string' && businessType.trim()
      ? businessType.trim().toUpperCase()
      : null;

    const tier = await prisma.pricingTier.findFirst({
      where: {
        maxRestaurants: {
          gte: restaurantCount
        },
        isActive: true,
        ...(normalizedBusinessType
          ? {
            OR: [
              { businessType: normalizedBusinessType },
              { businessType: 'ALL' }
            ]
          }
          : {})
      },
      orderBy: {
        maxRestaurants: 'asc'
      }
    });

    if (tier) {
      return tier.price;
    }

    return defaultPrice(restaurantCount);
  } catch (error) {
    console.error('Error fetching pricing tier:', error);
    return defaultPrice(restaurantCount);
  }
};

const defaultPrice = (restaurantCount) => {
  if (restaurantCount === 1) return 20;
  return 20 + (restaurantCount - 1) * 10;
};
