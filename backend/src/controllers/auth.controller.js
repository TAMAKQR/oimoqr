import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { config } from '../config/env.js';
import { sendWelcomeEmail } from '../utils/email.js';
import { calculateTrialEndDate } from '../utils/subscription.js';

export const register = async (req, res, next) => {
  try {
    const { email, password, name, phone, restaurantName, subdomain } = req.body;

    // Validate required fields
    if (!email || !password || !name || !restaurantName || !subdomain) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Check if subdomain is taken
    const existingRestaurant = await prisma.restaurant.findUnique({ where: { subdomain } });
    if (existingRestaurant) {
      return res.status(400).json({ error: 'Subdomain already taken' });
    }

    // Validate subdomain format (alphanumeric and hyphens only)
    if (!/^[a-z0-9-]+$/.test(subdomain)) {
      return res.status(400).json({ error: 'Subdomain can only contain lowercase letters, numbers, and hyphens' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Get trial configuration from DB
    // const trialConfig = await prisma.trialConfig.findFirst();
    const trialDays = parseInt(process.env.TRIAL_PERIOD_DAYS) || 7;

    // Create user with restaurant and trial subscription
    const trialEndDate = calculateTrialEndDate(trialDays);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        restaurants: {
          create: {
            name: restaurantName,
            subdomain,
            isTrialDefault: true
          }
        }
      },
      include: {
        restaurants: true
      }
    });

    // Create subscription after user and restaurant are created
    await prisma.subscription.create({
      data: {
        userId: user.id,
        restaurantId: user.restaurants[0].id,
        plan: 'TRIAL',
        status: 'TRIAL',
        trialEndsAt: trialEndDate,
        currentPeriodStart: new Date(),
        currentPeriodEnd: trialEndDate
      }
    });

    // Send welcome email
    await sendWelcomeEmail(email, name, restaurantName, trialDays);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      config.jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.status(201).json({
      message: 'Registration successful',
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt:', { email });

    if (!email || !password) {
      console.warn('Login failed: Email and password are required');
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      console.warn('Login failed: User not found', { email });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.warn('Login failed: Invalid password', { email });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      config.jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user; // Basic user info

    // Fetch restaurants separately for the response, but keep it lean
    const restaurants = await prisma.restaurant.findMany({
      where: { ownerId: user.id },
      select: {
        id: true,
        name: true,
        subdomain: true,
        socialLinks: true, // Добавляем socialLinks в ответ при логине
        subscriptions: {
          select: {
            status: true,
            plan: true,
            currentPeriodEnd: true,
            pricingTier: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    const userForResponse = {
      ...userWithoutPassword,
      restaurants
    };

    console.log('Login successful for:', {
      userId: user.id,
      email: user.email,
      isAdmin: user.isAdmin
    });

    res.json({
      message: 'Login successful',
      user: userForResponse,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        subscriptions: {
          include: {
            pricingTier: true
          }
        },
        restaurants: {
          include: {
            subscriptions: {
              select: {
                status: true,
                plan: true
              }
            },
            socialLinks: true
          }
        },
        restaurantStaff: {
          include: {
            restaurant: {
              include: {
                subscriptions: {
                  select: {
                    status: true,
                    plan: true
                  }
                },
                socialLinks: true
              }
            }
          }
        }
      }
    });

    const parseJsonField = (value, fallback) => {
      if (!value) {
        return fallback;
      }
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return fallback;
        }
      }
      return value;
    };

    const formatRestaurant = (restaurant) => {
      if (!restaurant) {
        return restaurant;
      }
      const formatted = { ...restaurant };
      formatted.banners = parseJsonField(formatted.banners, []);
      formatted.workingHours = parseJsonField(formatted.workingHours, null);
      formatted.menuCardStyle = formatted.cardStyle || 'horizontal';

      // Раскладываем socialLinks в поля верхнего уровня для консистентности
      const socialLinks = formatted.socialLinks || {};
      formatted.instagram = socialLinks.instagram || '';
      formatted.facebook = socialLinks.facebook || '';
      formatted.whatsapp = socialLinks.whatsapp || '';
      formatted.telegram = socialLinks.telegram || '';
      return formatted;
    };

    if (user?.restaurants) {
      user.restaurants = user.restaurants.map(formatRestaurant);
    }

    if (user?.restaurantStaff) {
      user.restaurantStaff = user.restaurantStaff.map(s => ({
        ...s,
        restaurant: formatRestaurant(s.restaurant)
      }));
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
};
