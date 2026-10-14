import { prisma } from '../config/prisma.js';
import bcrypt from 'bcryptjs';
import { calculateSubscriptionEndDate, getTrialConfigForBusinessType } from '../utils/subscription.js';
import { sendSubscriptionActivatedEmail } from '../utils/email.js';
import { addBillingInterval, getMoneyMinorUnits } from '../utils/finikBilling.js';
import {
  listOpenBillingIssues,
  reconcileBillingIssue as reconcileOpenBillingIssue,
  resolveBillingIssue as resolveOpenBillingIssue,
  withBillingLifecycleLock,
} from '../services/finikBilling.service.js';

export const getBillingIssues = async (req, res, next) => {
  try {
    res.json({ issues: await listOpenBillingIssues() });
  } catch (error) {
    next(error);
  }
};

export const reconcileBillingIssue = async (req, res, next) => {
  try {
    res.json(await reconcileOpenBillingIssue(req.params.id));
  } catch (error) {
    next(error);
  }
};

export const resolveBillingIssue = async (req, res, next) => {
  try {
    res.json(await resolveOpenBillingIssue(req.params.id, {
      decision: req.body?.decision,
      note: req.body?.note,
      resolvedBy: req.user?.email || req.user?.id,
    }));
  } catch (error) {
    next(error);
  }
};

const ADMIN_DASHBOARD_CACHE_TTL_MS = 30 * 1000;
let adminDashboardStatsCache = {
  expiresAt: 0,
  payload: null
};

const isPricingTierCompatibleWithBusinessType = (pricingTier, businessType) => {
  const tierBusinessType = pricingTier?.businessType || 'RESTAURANT';
  return tierBusinessType === 'ALL' || tierBusinessType === businessType;
};

const getIncompatibleBusinessTypes = (restaurants, pricingTier) => {
  const businessTypes = [...new Set((restaurants || []).map((restaurant) => restaurant.businessType || 'RESTAURANT'))];
  return businessTypes.filter((businessType) => !isPricingTierCompatibleWithBusinessType(pricingTier, businessType));
};

const PRICING_BUSINESS_TYPES = ['RESTAURANT', 'HOTEL', 'ALL'];
const TRIAL_BUSINESS_TYPES = ['ALL', 'RESTAURANT', 'HOTEL'];
const BILLING_INTERVALS = ['month', 'year'];

const normalizeBillingCurrency = (value) => (
  typeof value === 'string' && /^[a-zA-Z]{3}$/.test(value.trim())
    ? value.trim().toLowerCase()
    : null
);

const normalizeTrialBusinessType = (businessType) => {
  const value = typeof businessType === 'string' ? businessType.trim().toUpperCase() : '';
  return TRIAL_BUSINESS_TYPES.includes(value) ? value : 'ALL';
};

// BillingSubscription is the account-level source used by pricing and new
// restaurant flows; Subscription rows are per-restaurant projections. Keep
// both representations in the same transaction for every manual admin change.
const syncAccountBillingProjection = async (tx, userId, preferredSubscription = null) => {
  const subscription = preferredSubscription || await tx.subscription.findFirst({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });
  if (!subscription) {
    await tx.billingSubscription.deleteMany({ where: { userId } });
    return null;
  }

  const rawStatus = String(subscription.status || 'PENDING').toUpperCase();
  const status = rawStatus === 'TRIALING'
    ? 'TRIAL'
    : (rawStatus === 'CANCELED' ? 'CANCELLED' : rawStatus);
  const data = {
    provider: subscription.source || 'MANUAL',
    providerSubscriptionId: null,
    externalPriceId: null,
    pricingTierId: subscription.pricingTierId,
    status,
    cancelAtPeriodEnd: false,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    trialEndsAt: subscription.trialEndsAt,
    activatedAt: status === 'ACTIVE'
      ? (subscription.currentPeriodStart || new Date())
      : null,
    providerCreatedAt: null,
    pastDueSince: null,
  };
  return tx.billingSubscription.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
};

// ======================== DASHBOARD STATS ========================

export const getDashboardStats = async (req, res, next) => {
  try {
    const nowTs = Date.now();
    if (adminDashboardStatsCache.payload && adminDashboardStatsCache.expiresAt > nowTs) {
      return res.json(adminDashboardStatsCache.payload);
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Выполняем все запросы параллельно
    const [
      totalUsers,
      totalRestaurants,
      totalOrders,
      totalCustomers,
      totalDishes,
      totalRevenue,
      ordersToday,
      revenueToday,
      ordersThisWeek,
      newUsersThisMonth,
      newRestaurantsThisMonth,
      newCustomersThisMonth,
      subscriptionsByStatus,
      ordersByStatus,
      ordersByDeliveryType,
      menuViews30d,
      userGrowth,
      orderGrowth,
      topRestaurants,
      recentOrders,
      citiesDistribution,
    ] = await Promise.all([
      // Общие счётчики
      prisma.user.count({ where: { isAdmin: false } }),
      prisma.restaurant.count(),
      prisma.order.count(),
      prisma.customer.count(),
      prisma.dish.count(),
      prisma.order.aggregate({ _sum: { totalAmount: true } }),

      // Сегодня
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      prisma.order.aggregate({ _sum: { totalAmount: true }, where: { createdAt: { gte: today } } }),

      // За неделю
      prisma.order.count({ where: { createdAt: { gte: sevenDaysAgo } } }),

      // Рост за месяц
      prisma.user.count({ where: { isAdmin: false, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.restaurant.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.customer.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),

      // Подписки по статусу
      prisma.subscription.groupBy({ by: ['status'], _count: true }),

      // Заказы по статусу
      prisma.order.groupBy({ by: ['status'], _count: true }),

      // Заказы по типу доставки
      prisma.order.groupBy({ by: ['deliveryType'], _count: true }),

      // Просмотры меню за 30 дней
      prisma.menuView.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),

      // Рост пользователей по дням (30 дней) 
      prisma.$queryRaw`
        SELECT DATE("createdAt") as date, COUNT(*)::int as count
        FROM "User"
        WHERE "createdAt" >= ${thirtyDaysAgo} AND "isAdmin" = false
        GROUP BY DATE("createdAt")
        ORDER BY date
      `,

      // Рост заказов по дням (30 дней)
      prisma.$queryRaw`
        SELECT DATE("createdAt") as date, COUNT(*)::int as count, COALESCE(SUM("totalAmount"), 0)::float as revenue
        FROM "Order"
        WHERE "createdAt" >= ${thirtyDaysAgo}
        GROUP BY DATE("createdAt")
        ORDER BY date
      `,

      // Топ 10 ресторанов по заказам
      prisma.restaurant.findMany({
        select: {
          id: true,
          name: true,
          subdomain: true,
          city: true,
          _count: { select: { orders: true, dishes: true } },
        },
        orderBy: { orders: { _count: 'desc' } },
        take: 10,
      }),

      // Последние 10 заказов
      prisma.order.findMany({
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          status: true,
          deliveryType: true,
          createdAt: true,
          restaurant: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),

      // Города
      prisma.$queryRaw`
        SELECT "city", COUNT(*)::int as count
        FROM "Restaurant"
        WHERE "city" IS NOT NULL AND "city" != ''
        GROUP BY "city"
        ORDER BY count DESC
        LIMIT 10
      `,
    ]);

    const payload = {
      overview: {
        totalUsers,
        totalRestaurants,
        totalOrders,
        totalCustomers,
        totalDishes,
        totalRevenue: totalRevenue._sum.totalAmount || 0,
        menuViews30d,
      },
      today: {
        orders: ordersToday,
        revenue: revenueToday._sum.totalAmount || 0,
      },
      week: {
        orders: ordersThisWeek,
      },
      growth: {
        newUsersThisMonth,
        newRestaurantsThisMonth,
        newCustomersThisMonth,
      },
      charts: {
        userGrowth,
        orderGrowth,
      },
      distributions: {
        subscriptionsByStatus,
        ordersByStatus,
        ordersByDeliveryType,
        citiesDistribution,
      },
      topRestaurants,
      recentOrders,
    };

    adminDashboardStatsCache = {
      payload,
      expiresAt: Date.now() + ADMIN_DASHBOARD_CACHE_TTL_MS
    };

    res.json(payload);
  } catch (error) {
    next(error);
  }
};

// ======================== SUBSCRIPTIONS ========================



export const updateUserSubscription = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { pricingTierId, status, durationMonths, startDate, endDate } = req.body;

    console.log('Admin updating user subscription:', { userId, pricingTierId, status, durationMonths, startDate, endDate });

    // Validate input
    if (!pricingTierId && !status) {
      return res.status(400).json({ error: 'pricingTierId or status is required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: true,
        restaurants: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.restaurants || user.restaurants.length === 0) {
      return res.status(404).json({ error: 'User has no restaurants' });
    }

    let updateData = {};
    let activationEmailPlan = null;

    // If activating a pricing tier
    if (pricingTierId) {
      const pricingTier = await prisma.pricingTier.findUnique({
        where: { id: pricingTierId }
      });

      if (!pricingTier) {
        return res.status(404).json({ error: 'Pricing tier not found' });
      }

      const incompatibleBusinessTypes = getIncompatibleBusinessTypes(user.restaurants, pricingTier);
      if (incompatibleBusinessTypes.length > 0) {
        return res.status(400).json({
          error: `Невозможно применить тариф "${pricingTier.name}" к типу бизнеса: ${incompatibleBusinessTypes.join(', ')}. Выберите тариф для этого типа бизнеса или универсальный тариф.`
        });
      }

      // Проверяем, не превышает ли количество ресторанов лимит нового тарифа
      const restaurantCount = user.restaurants.length;
      if (pricingTier.maxRestaurants && restaurantCount > pricingTier.maxRestaurants) {
        return res.status(400).json({
          error: `Невозможно применить тариф "${pricingTier.name}". У пользователя ${restaurantCount} ресторанов, а тариф позволяет только ${pricingTier.maxRestaurants}. Сначала нужно удалить лишние рестораны.`
        });
      }

      // Рассчитываем даты подписки
      let periodStart = startDate ? new Date(startDate) : new Date();
      let periodEnd;

      if (endDate) {
        // Если указана конечная дата - используем её
        periodEnd = new Date(endDate);
      } else if (durationMonths) {
        // Если указано количество месяцев - добавляем к дате начала
        periodEnd = new Date(periodStart);
        periodEnd.setMonth(periodEnd.getMonth() + parseInt(durationMonths));
      } else {
        // По умолчанию - 1 месяц (30 дней)
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + 30);
      }

      updateData = {
        plan: pricingTier.name,
        status: 'ACTIVE',
        source: 'MANUAL',
        pricingTierId,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd
      };

      console.log('Activating pricing tier:', updateData);

      activationEmailPlan = pricingTier.name;
    } else if (status) {
      updateData.status = status;
      updateData.source = 'MANUAL';
    }

    const subscriptions = await withBillingLifecycleLock(userId, async (tx) => {
      const lockedUser = await tx.user.findUnique({
        where: { id: userId },
        include: { restaurants: true },
      });
      if (!lockedUser) {
        const error = new Error('User not found');
        error.status = 404;
        throw error;
      }
      if (lockedUser.restaurants.length === 0) {
        const error = new Error('User has no restaurants');
        error.status = 404;
        throw error;
      }

      if (!pricingTierId) {
        await tx.subscription.updateMany({
          where: { userId },
          data: updateData,
        });
        const updatedSubscriptions = await tx.subscription.findMany({
          where: { userId },
          orderBy: [{ currentPeriodEnd: 'desc' }, { updatedAt: 'desc' }],
          include: {
            user: { select: { id: true, email: true, name: true } },
            pricingTier: true,
          },
        });
        await syncAccountBillingProjection(tx, userId, updatedSubscriptions[0]);
        return updatedSubscriptions;
      }

      const lockedPricingTier = await tx.pricingTier.findUnique({
        where: { id: pricingTierId },
      });
      if (!lockedPricingTier) {
        const error = new Error('Pricing tier not found');
        error.status = 404;
        throw error;
      }
      const incompatibleBusinessTypes = getIncompatibleBusinessTypes(
        lockedUser.restaurants,
        lockedPricingTier
      );
      if (incompatibleBusinessTypes.length > 0) {
        const error = new Error(
          `Невозможно применить тариф "${lockedPricingTier.name}" к типу бизнеса: ${incompatibleBusinessTypes.join(', ')}.`
        );
        error.status = 400;
        throw error;
      }
      if (
        lockedPricingTier.maxRestaurants !== null
        && lockedUser.restaurants.length > lockedPricingTier.maxRestaurants
      ) {
        const error = new Error(
          `У пользователя ${lockedUser.restaurants.length} ресторанов, тариф позволяет ${lockedPricingTier.maxRestaurants}.`
        );
        error.status = 400;
        throw error;
      }

      await tx.subscription.deleteMany({
        where: { userId }
      });

      await tx.subscription.createMany({
        data: lockedUser.restaurants.map((restaurant) => ({
          userId,
          restaurantId: restaurant.id,
          ...updateData,
        })),
      });
      const updatedSubscriptions = await tx.subscription.findMany({
        where: { userId },
        orderBy: [{ currentPeriodEnd: 'desc' }, { updatedAt: 'desc' }],
        include: {
          user: { select: { id: true, email: true, name: true } },
          pricingTier: true,
        },
      });
      await syncAccountBillingProjection(tx, userId, updatedSubscriptions[0]);
      return updatedSubscriptions;
    });

    if (activationEmailPlan) {
      try {
        await sendSubscriptionActivatedEmail(user.email, user.name, activationEmailPlan);
      } catch (emailError) {
        console.error('Failed to send activation email:', emailError);
      }
    }

    console.log('Subscriptions updated successfully:', subscriptions.map(s => s.id).join(', '));
    res.json(subscriptions[0]); // Возвращаем первую подписку для обратной совместимости
  } catch (error) {
    console.error('Error in updateUserSubscription:', error);
    next(error);
  }
};

export const updateSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { plan, status, pricingTierId } = req.body;

    console.log('Admin updating subscription:', { id, plan, status, pricingTierId });

    // Validate input
    if (!plan && !status && !pricingTierId) {
      return res.status(400).json({ error: 'Plan, status or pricingTierId is required' });
    }

    const initialSubscription = await prisma.subscription.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!initialSubscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    const result = await withBillingLifecycleLock(
      initialSubscription.userId,
      async (tx) => {
        const subscription = await tx.subscription.findUnique({
          where: { id },
          include: {
            user: { select: { id: true, email: true, name: true } },
          },
        });
        if (!subscription) {
          const error = new Error('Subscription not found');
          error.status = 404;
          throw error;
        }

        let updateData = {};
        let activationEmailPlan = null;
        if (pricingTierId) {
          const [pricingTier, restaurants] = await Promise.all([
            tx.pricingTier.findUnique({ where: { id: pricingTierId } }),
            tx.restaurant.findMany({
              where: { ownerId: subscription.userId },
              select: { id: true, businessType: true },
            }),
          ]);
          if (!pricingTier) {
            const error = new Error('Pricing tier not found');
            error.status = 404;
            throw error;
          }
          const incompatibleTypes = getIncompatibleBusinessTypes(restaurants, pricingTier);
          if (incompatibleTypes.length) {
            const error = new Error(
              `Невозможно применить тариф "${pricingTier.name}" к типам бизнеса: ${incompatibleTypes.join(', ')}.`
            );
            error.status = 400;
            throw error;
          }
          if (
            pricingTier.maxRestaurants !== null
            && restaurants.length > pricingTier.maxRestaurants
          ) {
            const error = new Error(
              `Невозможно применить тариф "${pricingTier.name}". У пользователя ${restaurants.length} ресторанов, а тариф позволяет только ${pricingTier.maxRestaurants}.`
            );
            error.status = 400;
            throw error;
          }

          const periodStart = new Date();
          updateData = {
            plan: pricingTier.name,
            status: 'ACTIVE',
            source: 'MANUAL',
            pricingTierId,
            currentPeriodStart: periodStart,
            currentPeriodEnd: addBillingInterval(periodStart, pricingTier.billingInterval),
          };
          activationEmailPlan = pricingTier.name;
        } else if (plan && (plan === 'MONTHLY' || plan === 'YEARLY')) {
          updateData = {
            plan,
            status: 'ACTIVE',
            source: 'MANUAL',
            currentPeriodStart: new Date(),
            currentPeriodEnd: calculateSubscriptionEndDate(plan),
          };
          activationEmailPlan = plan;
        } else if (status) {
          updateData = { status, source: 'MANUAL' };
        } else {
          const error = new Error('Unsupported subscription plan');
          error.status = 400;
          throw error;
        }

        await tx.subscription.updateMany({
          where: { userId: subscription.userId },
          data: updateData,
        });
        const updated = await tx.subscription.findUnique({
          where: { id },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true
              }
            },
            pricingTier: true
          }
        });
        if (!updated) {
          const error = new Error('Subscription not found');
          error.status = 404;
          throw error;
        }
        await syncAccountBillingProjection(tx, subscription.userId, updated);
        return {
          updatedSubscription: updated,
          activationEmailPlan,
          email: subscription.user.email,
          name: subscription.user.name,
        };
      }
    );

    if (result.activationEmailPlan) {
      try {
        await sendSubscriptionActivatedEmail(
          result.email,
          result.name,
          result.activationEmailPlan
        );
      } catch (emailError) {
        console.error('Failed to send activation email:', emailError);
      }
    }

    console.log('Subscription updated successfully:', result.updatedSubscription.id);
    res.json(result.updatedSubscription);
  } catch (error) {
    console.error('Error in updateSubscription:', error);
    next(error);
  }
};

export const extendSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { months } = req.body;

    const parsedMonths = Number(months);
    if (!Number.isInteger(parsedMonths) || parsedMonths < 1 || parsedMonths > 120) {
      return res.status(400).json({ error: 'Invalid months value' });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { id }
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const updatedSubscription = await withBillingLifecycleLock(
      subscription.userId,
      async (tx) => {
        const [lockedSubscription, accountSubscriptions, accountBilling] = await Promise.all([
          tx.subscription.findUnique({ where: { id } }),
          tx.subscription.findMany({
            where: { userId: subscription.userId },
            select: { currentPeriodEnd: true },
          }),
          tx.billingSubscription.findUnique({
            where: { userId: subscription.userId },
            select: { currentPeriodEnd: true },
          }),
        ]);
        if (!lockedSubscription) {
          const error = new Error('Subscription not found');
          error.status = 404;
          throw error;
        }
        const now = new Date();
        const currentEnd = [
          now,
          ...accountSubscriptions.map((item) => item.currentPeriodEnd).filter(Boolean),
          accountBilling?.currentPeriodEnd,
        ].filter(Boolean).reduce((latest, value) => (
          value > latest ? value : latest
        ), now);
        let newEnd = currentEnd;
        for (let index = 0; index < parsedMonths; index += 1) {
          newEnd = addBillingInterval(newEnd, 'month');
        }

        await tx.subscription.updateMany({
          where: { userId: subscription.userId },
          data: {
            currentPeriodEnd: newEnd,
            status: 'ACTIVE',
            source: 'MANUAL'
          }
        });
        const updated = await tx.subscription.findUnique({ where: { id } });
        await syncAccountBillingProjection(tx, subscription.userId, updated);
        return updated;
      }
    );

    res.json(updatedSubscription);
  } catch (error) {
    next(error);
  }
};

export const getSubscriptionStats = async (req, res, next) => {
  try {
    const now = new Date();

    const stats = await prisma.subscription.groupBy({
      by: ['status'],
      _count: true
    });

    const trialExpiringSoon = await prisma.subscription.count({
      where: {
        status: 'TRIAL',
        trialEndsAt: {
          gte: now,
          lte: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) // 3 days
        }
      }
    });

    const subscriptionExpiringSoon = await prisma.subscription.count({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: {
          gte: now,
          lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      }
    });

    res.json({
      stats,
      trialExpiringSoon,
      subscriptionExpiringSoon
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserCredentials = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { email, password } = req.body;

    console.log('Admin updating user credentials:', { userId, email, hasPassword: !!password });

    // Validate input
    if (!email && !password) {
      return res.status(400).json({ error: 'Email or password is required' });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        restaurants: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent admin from modifying other admins
    if (user.isAdmin) {
      return res.status(403).json({ error: 'Cannot modify admin users' });
    }

    let updateData = {};

    // Update email if provided
    if (email && email !== user.email) {
      // Check if email is already taken
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ error: 'Email already in use' });
      }

      updateData.email = email;
    }

    // Update password if provided
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      updateData.password = await bcrypt.hash(password, 10);
    }

    // If nothing to update, return current user
    if (Object.keys(updateData).length === 0) {
      return res.json({
        message: 'No changes to update',
        user
      });
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        isAdmin: true,
        restaurants: {
          select: {
            id: true,
            name: true,
            subdomain: true
          }
        }
      }
    });

    console.log('User credentials updated successfully:', updatedUser.id);
    res.json({
      message: 'User credentials updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error in updateUserCredentials:', error);
    next(error);
  }
};

export const deactivateUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Проверяем существование пользователя
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { restaurants: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (user.isAdmin) {
      return res.status(403).json({ error: 'Невозможно деактивировать администратора' });
    }

    await withBillingLifecycleLock(userId, async (tx) => {
      // Обновляем статус всех подписок пользователя на CANCELLED
      await tx.subscription.updateMany({
        where: { userId },
        data: {
          status: 'CANCELLED',
          source: 'MANUAL',
          currentPeriodEnd: new Date() // Немедленное окончание подписки
        }
      });
      const updated = await tx.subscription.findFirst({ where: { userId } });
      await syncAccountBillingProjection(tx, userId, updated);
    });

    res.json({ message: 'Пользователь успешно деактивирован' });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Проверяем существование пользователя
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { restaurants: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (user.isAdmin) {
      return res.status(403).json({ error: 'Невозможно удалить администратора' });
    }

    await withBillingLifecycleLock(userId, async (tx) => {
      const lockedUser = await tx.user.findUnique({
        where: { id: userId },
        select: {
          billingCustomerId: true,
          _count: { select: { billingPayments: true } },
        },
      });

      // Preserve any legacy external customer linkage until support explicitly
      // cleans it up; deleting a local account must not orphan remote billing.
      if (lockedUser?.billingCustomerId) {
        const error = new Error('Перед удалением пользователя удалите его внешний платёжный профиль и повторите попытку.');
        error.status = 409;
        error.code = 'BILLING_CUSTOMER_DELETE_REQUIRED';
        throw error;
      }
      if (lockedUser?._count.billingPayments > 0) {
        const error = new Error('Пользователя с историей платежей нельзя удалить. Деактивируйте его вместо удаления.');
        error.status = 409;
        error.code = 'BILLING_HISTORY_DELETE_FORBIDDEN';
        throw error;
      }

      // Удаляем пользователя (каскадное удаление затронет все связанные данные)
      await tx.user.delete({
        where: { id: userId }
      });
    });

    res.json({ message: 'Пользователь и все его данные успешно удалены' });
  } catch (error) {
    next(error);
  }
};

export const getAllUsers = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        isAdmin: false,
        // Только пользователи, у которых есть хотя бы один ресторан (владельцы)
        // Это исключит из списка персонал (менеджеров)
        restaurants: {
          some: {}
        }
      },
      // Оптимизированный запрос: выбираем только то, что нужно для таблицы
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        createdAt: true,
        // Включаем все рестораны, которыми владеет пользователь
        restaurants: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            businessType: true
          }
        },
        // Включаем все подписки пользователя с информацией о тарифе
        subscriptions: {
          select: {
            id: true,
            pricingTierId: true,
            status: true,
            plan: true,
            currentPeriodEnd: true,
            pricingTier: {
              select: {
                name: true,
                maxRestaurants: true
              }
            }
          }
        },
        // Считаем количество ресторанов, которыми владеет пользователь
        _count: {
          select: {
            restaurants: true
          }
        }
      }
    });

    res.json(users);
  } catch (error) {
    console.error('Error getting users:', error);
    next(error);
  }
};

export const getPricingTiers = async (req, res, next) => {
  try {
    const tiers = await prisma.pricingTier.findMany({
      include: {
        _count: { select: { billingPayments: true } },
      },
      orderBy: { order: 'asc' }
    });

    res.json(tiers.map(({ _count, ...tier }) => ({
      ...tier,
      hasPayments: _count.billingPayments > 0,
    })));
  } catch (error) {
    console.error('Error in getPricingTiers:', error.message);
    // Fallback: use raw SQL if Prisma Client is out of sync
    try {
      const tiers = await prisma.$queryRawUnsafe('SELECT * FROM "PricingTier" ORDER BY "order" ASC');
      return res.json(tiers);
    } catch (rawError) {
      console.error('Raw fallback also failed:', rawError.message);
    }
    next(error);
  }
};

export const createPricingTier = async (req, res, next) => {
  try {
    const {
      name,
      price,
      description,
      features,
      maxRestaurants,
      currency,
      billingInterval,
      onlinePaymentEnabled,
      businessType,
      order,
      isActive,
      bonusProgramEnabled,
      bonusAccrualRate,
      bonusExpiryDays,
      bonusBronzeLabel,
      bonusSilverLabel,
      bonusGoldLabel,
      bonusSilverFromOrders,
      bonusGoldFromOrders
    } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    if (!Number.isFinite(Number(price)) || Number(price) < 0) {
      return res.status(400).json({ error: 'Price must be a finite number >= 0' });
    }

    const normalizedCurrency = normalizeBillingCurrency(currency || 'kgs');
    const normalizedBillingInterval = String(billingInterval || 'month').trim().toLowerCase();
    const paymentEnabled = Boolean(onlinePaymentEnabled);
    const normalizedMaxRestaurants = maxRestaurants === '' || maxRestaurants === null || maxRestaurants === undefined
      ? null
      : Number.parseInt(maxRestaurants, 10);

    if (!normalizedCurrency) {
      return res.status(400).json({ error: 'Currency must be a 3-letter ISO code' });
    }

    if (!BILLING_INTERVALS.includes(normalizedBillingInterval)) {
      return res.status(400).json({ error: 'billingInterval must be month or year' });
    }

    if (normalizedMaxRestaurants !== null && (!Number.isInteger(normalizedMaxRestaurants) || normalizedMaxRestaurants < 1)) {
      return res.status(400).json({ error: 'maxRestaurants must be an integer >= 1' });
    }

    if (paymentEnabled && normalizedCurrency !== 'kgs') {
      return res.status(400).json({ error: 'Finik online payment requires KGS currency' });
    }

    if (paymentEnabled && getMoneyMinorUnits(price) === null) {
      return res.status(400).json({ error: 'Finik price must be > 0 with no more than two decimal places' });
    }

    const parsedBonusRate = bonusAccrualRate !== undefined && bonusAccrualRate !== null
      ? parseFloat(bonusAccrualRate)
      : 0;
    const parsedBonusExpiryDays = bonusExpiryDays !== undefined && bonusExpiryDays !== null
      ? parseInt(bonusExpiryDays)
      : 90;
    const parsedSilverFromOrders = bonusSilverFromOrders !== undefined && bonusSilverFromOrders !== null
      ? parseInt(bonusSilverFromOrders)
      : 8;
    const parsedGoldFromOrders = bonusGoldFromOrders !== undefined && bonusGoldFromOrders !== null
      ? parseInt(bonusGoldFromOrders)
      : 20;

    if (parsedBonusRate < 0 || parsedBonusRate > 1) {
      return res.status(400).json({ error: 'bonusAccrualRate must be between 0 and 1' });
    }

    if (parsedBonusExpiryDays < 1) {
      return res.status(400).json({ error: 'bonusExpiryDays must be >= 1' });
    }

    if (parsedSilverFromOrders < 1) {
      return res.status(400).json({ error: 'bonusSilverFromOrders must be >= 1' });
    }

    if (parsedGoldFromOrders <= parsedSilverFromOrders) {
      return res.status(400).json({ error: 'bonusGoldFromOrders must be greater than bonusSilverFromOrders' });
    }

    const normalizedBusinessType = typeof businessType === 'string' && businessType.trim()
      ? businessType.trim().toUpperCase()
      : 'RESTAURANT';

    if (!PRICING_BUSINESS_TYPES.includes(normalizedBusinessType)) {
      return res.status(400).json({ error: 'Unsupported pricing business type' });
    }

    const tier = await prisma.pricingTier.create({
      data: {
        name,
        price: Number(price),
        currency: normalizedCurrency,
        billingInterval: normalizedBillingInterval,
        onlinePaymentEnabled: paymentEnabled,
        description,
        features,
        maxRestaurants: normalizedMaxRestaurants,
        businessType: normalizedBusinessType,
        order: order || 0,
        isActive: isActive === undefined ? true : Boolean(isActive),
        bonusProgramEnabled: Boolean(bonusProgramEnabled),
        bonusAccrualRate: parsedBonusRate,
        bonusExpiryDays: parsedBonusExpiryDays,
        bonusBronzeLabel: bonusBronzeLabel || 'Bronze',
        bonusSilverLabel: bonusSilverLabel || 'Silver',
        bonusGoldLabel: bonusGoldLabel || 'Gold',
        bonusSilverFromOrders: parsedSilverFromOrders,
        bonusGoldFromOrders: parsedGoldFromOrders
      }
    });

    res.status(201).json({
      message: 'Pricing tier created successfully',
      tier
    });
  } catch (error) {
    next(error);
  }
};

export const updatePricingTier = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      price,
      description,
      features,
      maxRestaurants,
      currency,
      billingInterval,
      onlinePaymentEnabled,
      businessType,
      order,
      isActive,
      bonusProgramEnabled,
      bonusAccrualRate,
      bonusExpiryDays,
      bonusBronzeLabel,
      bonusSilverLabel,
      bonusGoldLabel,
      bonusSilverFromOrders,
      bonusGoldFromOrders
    } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    if (!Number.isFinite(Number(price)) || Number(price) < 0) {
      return res.status(400).json({ error: 'Price must be a finite number >= 0' });
    }

    const normalizedCurrency = normalizeBillingCurrency(currency || 'kgs');
    const normalizedBillingInterval = String(billingInterval || 'month').trim().toLowerCase();
    const paymentEnabled = Boolean(onlinePaymentEnabled);
    const normalizedMaxRestaurants = maxRestaurants === '' || maxRestaurants === null || maxRestaurants === undefined
      ? null
      : Number.parseInt(maxRestaurants, 10);

    if (!normalizedCurrency) {
      return res.status(400).json({ error: 'Currency must be a 3-letter ISO code' });
    }

    if (!BILLING_INTERVALS.includes(normalizedBillingInterval)) {
      return res.status(400).json({ error: 'billingInterval must be month or year' });
    }

    if (normalizedMaxRestaurants !== null && (!Number.isInteger(normalizedMaxRestaurants) || normalizedMaxRestaurants < 1)) {
      return res.status(400).json({ error: 'maxRestaurants must be an integer >= 1' });
    }

    if (paymentEnabled && normalizedCurrency !== 'kgs') {
      return res.status(400).json({ error: 'Finik online payment requires KGS currency' });
    }

    if (paymentEnabled && getMoneyMinorUnits(price) === null) {
      return res.status(400).json({ error: 'Finik price must be > 0 with no more than two decimal places' });
    }

    const parsedBonusRate = bonusAccrualRate !== undefined && bonusAccrualRate !== null
      ? parseFloat(bonusAccrualRate)
      : 0;
    const parsedBonusExpiryDays = bonusExpiryDays !== undefined && bonusExpiryDays !== null
      ? parseInt(bonusExpiryDays)
      : 90;
    const parsedSilverFromOrders = bonusSilverFromOrders !== undefined && bonusSilverFromOrders !== null
      ? parseInt(bonusSilverFromOrders)
      : 8;
    const parsedGoldFromOrders = bonusGoldFromOrders !== undefined && bonusGoldFromOrders !== null
      ? parseInt(bonusGoldFromOrders)
      : 20;

    if (parsedBonusRate < 0 || parsedBonusRate > 1) {
      return res.status(400).json({ error: 'bonusAccrualRate must be between 0 and 1' });
    }

    if (parsedBonusExpiryDays < 1) {
      return res.status(400).json({ error: 'bonusExpiryDays must be >= 1' });
    }

    if (parsedSilverFromOrders < 1) {
      return res.status(400).json({ error: 'bonusSilverFromOrders must be >= 1' });
    }

    if (parsedGoldFromOrders <= parsedSilverFromOrders) {
      return res.status(400).json({ error: 'bonusGoldFromOrders must be greater than bonusSilverFromOrders' });
    }

    const normalizedBusinessType = typeof businessType === 'string' && businessType.trim()
      ? businessType.trim().toUpperCase()
      : 'RESTAURANT';

    if (!PRICING_BUSINESS_TYPES.includes(normalizedBusinessType)) {
      return res.status(400).json({ error: 'Unsupported pricing business type' });
    }

    const tier = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`pricing-tier:${id}`}))`;
      const existingTier = await tx.pricingTier.findUnique({
        where: { id },
        select: {
          externalPriceId: true,
          currency: true,
          billingInterval: true,
          price: true,
          businessType: true,
          maxRestaurants: true,
          _count: { select: { billingPayments: true } },
        },
      });
      if (!existingTier) {
        const error = new Error('Pricing tier not found');
        error.status = 404;
        throw error;
      }

      const immutableBillingFieldsChanged = existingTier.currency !== normalizedCurrency
        || existingTier.billingInterval !== normalizedBillingInterval
        || Number(existingTier.price) !== Number(price)
        || existingTier.businessType !== normalizedBusinessType
        || existingTier.maxRestaurants !== normalizedMaxRestaurants;
      const hasPublishedPayments = existingTier._count.billingPayments > 0
        || Boolean(existingTier.externalPriceId);
      if (hasPublishedPayments && immutableBillingFieldsChanged) {
        const error = new Error(
          'Цена, валюта, период, тип бизнеса и лимит оплаченного тарифа неизменяемы. Создайте новый тариф.'
        );
        error.status = 409;
        error.code = 'BILLING_TIER_IMMUTABLE';
        throw error;
      }

      return tx.pricingTier.update({
        where: { id },
        data: {
          name,
          price: Number(price),
          currency: normalizedCurrency,
          billingInterval: normalizedBillingInterval,
          onlinePaymentEnabled: paymentEnabled,
          description,
          features,
          maxRestaurants: normalizedMaxRestaurants,
          businessType: normalizedBusinessType,
          order: order || 0,
          isActive,
          bonusProgramEnabled: Boolean(bonusProgramEnabled),
          bonusAccrualRate: parsedBonusRate,
          bonusExpiryDays: parsedBonusExpiryDays,
          bonusBronzeLabel: bonusBronzeLabel || 'Bronze',
          bonusSilverLabel: bonusSilverLabel || 'Silver',
          bonusGoldLabel: bonusGoldLabel || 'Gold',
          bonusSilverFromOrders: parsedSilverFromOrders,
          bonusGoldFromOrders: parsedGoldFromOrders,
        },
      });
    }, { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 30000 });

    res.json({
      message: 'Pricing tier updated successfully',
      tier
    });
  } catch (error) {
    next(error);
  }
};

export const deletePricingTier = async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`pricing-tier:${id}`}))`;
      const tier = await tx.pricingTier.findUnique({
        where: { id },
        select: {
          externalPriceId: true,
          _count: { select: { billingPayments: true } },
        },
      });
      if (!tier) {
        const error = new Error('Pricing tier not found');
        error.status = 404;
        throw error;
      }
      if (tier.externalPriceId || tier._count.billingPayments > 0) {
        const error = new Error('Нельзя удалить тариф с историей платежей. Отключите его для новых продаж.');
        error.status = 409;
        error.code = 'BILLING_TIER_IN_USE';
        throw error;
      }
      await tx.pricingTier.delete({ where: { id } });
    }, { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 30000 });

    res.json({ message: 'Pricing tier deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const getTrialConfig = async (req, res, next) => {
  try {
    if (req.query.all === 'true') {
      const configs = await prisma.trialConfig.findMany({
        where: {
          businessType: { in: TRIAL_BUSINESS_TYPES }
        },
        orderBy: { businessType: 'asc' }
      });

      const byType = new Map(configs.map((config) => [config.businessType, config]));
      const fallbackDays = parseInt(process.env.TRIAL_PERIOD_DAYS) || 7;

      return res.json(TRIAL_BUSINESS_TYPES.map((businessType) => (
        byType.get(businessType) || {
          id: null,
          businessType,
          name: businessType === 'ALL' ? 'Пробный период' : `Пробный период (${businessType})`,
          days: fallbackDays,
          message: `Вы получите ${fallbackDays} дней бесплатного пробного периода`
        }
      )));
    }

    const businessType = normalizeTrialBusinessType(req.query.businessType);
    const config = await getTrialConfigForBusinessType(businessType);
    res.json(config);
  } catch (error) {
    next(error);
  }
};

export const updateTrialConfig = async (req, res, next) => {
  try {
    const { name, days, message } = req.body;
    const businessType = normalizeTrialBusinessType(req.body.businessType);

    if (!days || days < 1) {
      return res.status(400).json({ error: 'Days must be >= 1' });
    }

    const config = await prisma.trialConfig.upsert({
      where: { businessType },
      create: {
        businessType,
        name: name || 'Пробный период',
        days: parseInt(days),
        message: message || 'Вы получите пробный период'
      },
      update: {
        name: name || 'Пробный период',
        days: parseInt(days),
        message: message || 'Вы получите пробный период'
      }
    });

    res.json({
      message: 'Trial config updated successfully',
      config
    });
  } catch (error) {
    next(error);
  }
};
