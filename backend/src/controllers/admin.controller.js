import { prisma } from '../config/prisma.js';
import bcrypt from 'bcryptjs';
import { calculateSubscriptionEndDate } from '../utils/subscription.js';
import { sendSubscriptionActivatedEmail } from '../utils/email.js';



export const updateUserSubscription = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { pricingTierId, status } = req.body;

    console.log('Admin updating user subscription:', { userId, pricingTierId, status });

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

    // If activating a pricing tier
    if (pricingTierId) {
      const pricingTier = await prisma.pricingTier.findUnique({
        where: { id: pricingTierId }
      });

      if (!pricingTier) {
        return res.status(404).json({ error: 'Pricing tier not found' });
      }

      // Проверяем, не превышает ли количество ресторанов лимит нового тарифа
      const restaurantCount = user.restaurants.length;
      if (pricingTier.maxRestaurants && restaurantCount > pricingTier.maxRestaurants) {
        return res.status(400).json({ 
          error: `Невозможно применить тариф "${pricingTier.name}". У пользователя ${restaurantCount} ресторанов, а тариф позволяет только ${pricingTier.maxRestaurants}. Сначала нужно удалить лишние рестораны.`
        });
      }

      // Default to 30 days for subscription
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      updateData = {
        plan: pricingTier.name,
        status: 'ACTIVE',
        pricingTierId,
        currentPeriodStart: new Date(),
        currentPeriodEnd: endDate
      };

      console.log('Activating pricing tier:', updateData);

      // Send activation email (don't fail if email fails)
      try {
        await sendSubscriptionActivatedEmail(user.email, user.name, pricingTier.name);
      } catch (emailError) {
        console.error('Failed to send activation email:', emailError);
      }
    } else if (status) {
      updateData.status = status;
    }

    // Сначала удалим все существующие подписки пользователя
    await prisma.subscription.deleteMany({
      where: {
        userId
      }
    });

    // Создаем новые подписки для всех ресторанов пользователя
    const subscriptions = await Promise.all(user.restaurants.map(restaurant => 
      prisma.subscription.create({
        data: {
          userId,
          restaurantId: restaurant.id,
          ...updateData
        },
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
      })
    ));

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

    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: {
        user: true,
        pricingTier: true
      }
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    let updateData = {};

    // If activating a pricing tier
    if (pricingTierId) {
      const pricingTier = await prisma.pricingTier.findUnique({
        where: { id: pricingTierId }
      });

      if (!pricingTier) {
        return res.status(404).json({ error: 'Pricing tier not found' });
      }

      // Проверяем количество ресторанов пользователя
      const user = await prisma.user.findUnique({
        where: { id: subscription.userId },
        include: { restaurants: true }
      });

      // Проверяем, не превышает ли количество ресторанов лимит нового тарифа
      if (user && pricingTier.maxRestaurants && user.restaurants.length > pricingTier.maxRestaurants) {
        return res.status(400).json({ 
          error: `Невозможно применить тариф "${pricingTier.name}". У пользователя ${user.restaurants.length} ресторанов, а тариф позволяет только ${pricingTier.maxRestaurants}. Сначала нужно удалить лишние рестораны.`
        });
      }

      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      updateData = {
        plan: pricingTier.name,
        status: 'ACTIVE',
        pricingTierId,
        currentPeriodStart: new Date(),
        currentPeriodEnd: endDate
      };

      console.log('Activating pricing tier:', updateData);

      try {
        await sendSubscriptionActivatedEmail(
          subscription.user.email,
          subscription.user.name,
          pricingTier.name
        );
      } catch (emailError) {
        console.error('Failed to send activation email:', emailError);
      }
    } else if (plan && (plan === 'MONTHLY' || plan === 'YEARLY')) {
      const endDate = calculateSubscriptionEndDate(plan);
      updateData = {
        plan,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: endDate
      };

      console.log('Activating paid plan:', updateData);

      try {
        await sendSubscriptionActivatedEmail(
          subscription.user.email,
          subscription.user.name,
          plan
        );
      } catch (emailError) {
        console.error('Failed to send activation email:', emailError);
      }
    } else if (status) {
      updateData.status = status;
    }

    const updatedSubscription = await prisma.subscription.update({
      where: { id },
      data: updateData,
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

    console.log('Subscription updated successfully:', updatedSubscription.id);
    res.json(updatedSubscription);
  } catch (error) {
    console.error('Error in updateSubscription:', error);
    next(error);
  }
};

export const extendSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { months } = req.body;

    if (!months || months < 1) {
      return res.status(400).json({ error: 'Invalid months value' });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { id }
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const currentEnd = new Date(subscription.currentPeriodEnd);
    const newEnd = new Date(currentEnd);
    newEnd.setMonth(newEnd.getMonth() + parseInt(months));

    const updatedSubscription = await prisma.subscription.update({
      where: { id },
      data: {
        currentPeriodEnd: newEnd,
        status: 'ACTIVE'
      }
    });

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
        restaurant: true
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
        restaurant: {
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

    // Обновляем статус всех подписок пользователя на CANCELLED
    await prisma.subscription.updateMany({
      where: { userId },
      data: { 
        status: 'CANCELLED',
        currentPeriodEnd: new Date() // Немедленное окончание подписки
      }
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

    // Удаляем пользователя (каскадное удаление затронет все связанные данные)
    await prisma.user.delete({
      where: { id: userId }
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
        isAdmin: false
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
            subdomain: true
          }
        },
        // Включаем все подписки пользователя с информацией о тарифе
        subscriptions: {
          select: {
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
      orderBy: { order: 'asc' }
    });

    res.json(tiers);
  } catch (error) {
    next(error);
  }
};

export const createPricingTier = async (req, res, next) => {
  try {
    const { name, price, description, features, maxRestaurants, order } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    if (price < 0) {
      return res.status(400).json({ error: 'Price must be >= 0' });
    }

    const tier = await prisma.pricingTier.create({
      data: {
        name,
        price: parseFloat(price),
        description,
        features,
        maxRestaurants: maxRestaurants ? parseInt(maxRestaurants) : null,
        order: order || 0
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
    const { name, price, description, features, maxRestaurants, order, isActive } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    if (price < 0) {
      return res.status(400).json({ error: 'Price must be >= 0' });
    }

    const tier = await prisma.pricingTier.update({
      where: { id },
      data: {
        name,
        price: parseFloat(price),
        description,
        features,
        maxRestaurants: maxRestaurants ? parseInt(maxRestaurants) : null,
        order: order || 0,
        isActive
      }
    });

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

    await prisma.pricingTier.delete({
      where: { id }
    });

    res.json({ message: 'Pricing tier deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const getTrialConfig = async (req, res, next) => {
  try {
    const trialDays = parseInt(process.env.TRIAL_PERIOD_DAYS) || 7;
    res.json({ days: trialDays });
  } catch (error) {
    next(error);
  }
};

export const updateTrialConfig = async (req, res, next) => {
  try {
    const { name, days, message } = req.body;

    if (!days || days < 1) {
      return res.status(400).json({ error: 'Days must be >= 1' });
    }

    let config = await prisma.trialConfig.findFirst();

    if (!config) {
      config = await prisma.trialConfig.create({
        data: {
          name: name || 'Пробный период',
          days: parseInt(days),
          message: message || 'Вы получите пробный период'
        }
      });
    } else {
      config = await prisma.trialConfig.update({
        where: { id: config.id },
        data: {
          name: name || config.name,
          days: parseInt(days),
          message: message || config.message
        }
      });
    }

    res.json({
      message: 'Trial config updated successfully',
      config
    });
  } catch (error) {
    next(error);
  }
};