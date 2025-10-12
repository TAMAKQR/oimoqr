import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { calculateSubscriptionEndDate } from '../utils/subscription.js';
import { sendSubscriptionActivatedEmail } from '../utils/email.js';

const prisma = new PrismaClient();

export const getAllRestaurants = async (req, res, next) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true
          }
        },
        subscription: true,
        _count: {
          select: {
            categories: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(restaurants);
  } catch (error) {
    next(error);
  }
};

export const getRestaurantById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true
          }
        },
        subscription: true,
        categories: {
          include: {
            _count: {
              select: {
                dishes: true
              }
            }
          }
        }
      }
    });

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    res.json(restaurant);
  } catch (error) {
    next(error);
  }
};

export const updateSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { plan, status } = req.body;

    console.log('Admin updating subscription:', { id, plan, status });

    // Validate input
    if (!plan && !status) {
      return res.status(400).json({ error: 'Plan or status is required' });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: {
        restaurant: {
          include: {
            user: true
          }
        }
      }
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    let updateData = {};

    // If activating a paid plan
    if (plan && (plan === 'MONTHLY' || plan === 'YEARLY')) {
      const endDate = calculateSubscriptionEndDate(plan);
      updateData = {
        plan,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: endDate
      };

      console.log('Activating paid plan:', updateData);

      // Send activation email (don't fail if email fails)
      try {
        await sendSubscriptionActivatedEmail(
          subscription.restaurant.user.email,
          subscription.restaurant.user.name,
          plan
        );
      } catch (emailError) {
        console.error('Failed to send activation email:', emailError);
        // Continue anyway
      }
    } else if (status) {
      // Just update status
      updateData.status = status;
      console.log('Updating status only:', updateData);
    }

    const updatedSubscription = await prisma.subscription.update({
      where: { id },
      data: updateData,
      include: {
        restaurant: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true
              }
            }
          }
        }
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