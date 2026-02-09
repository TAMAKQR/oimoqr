import { prisma } from '../config/prisma.js';
import { calculateTrialEndDate, calculateSubscriptionPrice, getTrialDaysRemaining } from '../utils/subscription.js';

export const getRestaurantBySubdomain = async (req, res, next) => {
  try {
    const startTime = Date.now();
    const { subdomain } = req.params;
    let { language } = req.query;
    const now = new Date();

    console.log(`⏱️ [Menu Load] Starting for subdomain: ${subdomain}, language: ${language}`);

    // 1) Быстро получаем базовую информацию ресторана (нужно для defaultLanguage)
    const t1 = Date.now();
    const restaurantBase = await prisma.restaurant.findUnique({
      where: { subdomain },
      select: {
        id: true,
        subdomain: true,
        name: true,
        description: true,
        phone: true,
        address: true,
        city: true,
        country: true,
        currency: true,
        banners: true,
        logo: true,
        cardStyle: true,
        primaryColor: true,
        themePalette: true,
        defaultLanguage: true,
        deliveryEnabled: true,
        deliveryFee: true,
        minOrderAmount: true,
        workingHours: true,
        isTemporarilyClosed: true,
        closureReason: true,
        latitude: true,
        longitude: true,
        deliveryRadius: true,
        businessType: true,
        telegramGroupId: true,
        telegramBotToken: true,
        ownerId: true,
        socialLinks: true,
        languages: {
          where: { isEnabled: true },
          orderBy: { order: 'asc' }
        },
        categoryGroups: {
          orderBy: { order: 'asc' },
          include: {
            categories: { orderBy: { order: 'asc' } }
          }
        }
      }
    });
    console.log(`⏱️ [Menu Load] Restaurant base: ${Date.now() - t1}ms`);

    if (!restaurantBase) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    if (!language) {
      language = restaurantBase.defaultLanguage;
    }

    // 2) Проверка активной подписки именно для этого ресторана
    const t2 = Date.now();
    const activeSubscription = await prisma.subscription.findFirst({
      where: {
        restaurantId: restaurantBase.id,
        OR: [
          { status: 'TRIAL', trialEndsAt: { gt: now } },
          { status: 'ACTIVE', currentPeriodEnd: { gt: now } }
        ]
      },
      include: {
        pricingTier: true,
        user: { select: { id: true } }
      }
    });
    console.log(`⏱️ [Menu Load] Subscription check: ${Date.now() - t2}ms`);

    if (!activeSubscription) {
      return res.status(403).json({ error: 'Restaurant subscription is not active' });
    }

    // Лимит ресторанов по тарифу (быстрый count вместо include всех ресторанов)
    if (activeSubscription.pricingTier?.maxRestaurants) {
      const ownerRestaurantsCount = await prisma.restaurant.count({
        where: { ownerId: activeSubscription.userId }
      });
      const maxRestaurants = activeSubscription.pricingTier.maxRestaurants;

      if (ownerRestaurantsCount > maxRestaurants) {
        return res.status(403).json({
          error: 'Subscription limit exceeded',
          message: `Превышен лимит ресторанов для текущей подписки (${maxRestaurants})`
        });
      }
    }

    // 3) Загружаем категории/блюда отдельно и фильтруем переводы на уровне БД
    const t3 = Date.now();
    const categories = await prisma.category.findMany({
      where: { restaurantId: restaurantBase.id },
      orderBy: { order: 'asc' },
      include: {
        translations: {
          where: { languageCode: language }
        },
        dishes: {
          where: { available: true },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            image: true,
            available: true,
            order: true,
            allergens: true,
            discount: true,
            badge: true,
            categoryId: true,
            restaurantId: true,
            createdAt: true,
            updatedAt: true,
            translations: {
              where: { languageCode: language }
            },
            modifiers: {
              orderBy: { order: 'asc' },
              include: {
                options: { orderBy: { createdAt: 'asc' } }
              }
            }
          }
        }
      }
    });
    console.log(`⏱️ [Menu Load] Categories & dishes: ${Date.now() - t3}ms`);

    // Parse workingHours if it's a JSON string (SQLite compatibility)
    let workingHours = restaurantBase.workingHours;
    if (workingHours && typeof workingHours === 'string') {
      try {
        workingHours = JSON.parse(workingHours);
      } catch (e) {
        workingHours = null;
      }
    }

    const restaurantWithImageUrl = {
      ...restaurantBase,
      workingHours,
      menuCardStyle: restaurantBase.cardStyle,
      categories: categories.map(category => {
        const categoryTranslation = category.translations?.[0];
        return {
          ...category,
          name: categoryTranslation?.name || category.name,
          description: categoryTranslation?.description || category.description,
          translations: undefined,
          dishes: category.dishes.map(dish => {
            const translation = dish.translations?.[0];
            return {
              ...dish,
              imageUrl: dish.image,
              name: translation?.name || dish.name,
              description: translation?.description || dish.description,
              translations: undefined
            };
          })
        };
      })
    };

    // Раскладываем socialLinks для консистентности с админ-панелью
    const socialLinks = restaurantBase.socialLinks || {};
    restaurantWithImageUrl.instagram = socialLinks.instagram || '';
    restaurantWithImageUrl.facebook = socialLinks.facebook || '';
    restaurantWithImageUrl.whatsapp = socialLinks.whatsapp || '';
    restaurantWithImageUrl.telegram = socialLinks.telegram || '';

    // Удаляем лишнее
    delete restaurantWithImageUrl.ownerId;
    delete restaurantWithImageUrl.socialLinks;

    // Трекинг просмотра меню
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0] ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.ip;
    const userAgent = req.headers['user-agent'];

    // Асинхронно записываем просмотр (не блокируем ответ)
    prisma.menuView.create({
      data: {
        restaurantId: restaurantBase.id,
        ipAddress,
        userAgent
      }
    }).catch(err => {
      console.error('Error tracking menu view:', err);
      const totalTime = Date.now() - startTime;
      console.log(`⏱️ [Menu Load] ✅ TOTAL TIME: ${totalTime}ms`);

    });

    res.json(restaurantWithImageUrl);
  } catch (error) {
    next(error);
  }
};

export const updateRestaurant = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      address,
      phone,
      description,
      instagram,
      facebook,
      whatsapp,
      telegram,
      deliveryEnabled,
      deliveryFee,
      minOrderAmount,
      currency,
      menuCardStyle,
      primaryColor,
      themePalette,
      workingHours,
      isTemporarilyClosed,
      closureReason,
      latitude,
      longitude,
      deliveryRadius,
      telegramGroupId
    } = req.body;

    const restaurant = await prisma.restaurant.update({
      where: { id },
      data: {
        name,
        address,
        phone,
        description,
        deliveryEnabled,
        deliveryFee: deliveryFee ? parseFloat(deliveryFee) : null,
        minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : null,
        currency,
        cardStyle: menuCardStyle || 'horizontal',
        primaryColor: primaryColor || null,
        themePalette: themePalette || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        deliveryRadius: deliveryRadius ? parseFloat(deliveryRadius) : null,
        workingHours: workingHours ? JSON.stringify(workingHours) : null,
        isTemporarilyClosed: isTemporarilyClosed || false,
        closureReason: closureReason || null,
        telegramGroupId: telegramGroupId || null,
      },
      include: {
        subscriptions: true,
        socialLinks: true
      }
    });

    // Update social links separately
    if (instagram || facebook || whatsapp || telegram) {
      await prisma.socialLink.upsert({
        where: { restaurantId: id },
        create: {
          restaurantId: id,
          instagram: instagram || null,
          facebook: facebook || null,
          whatsapp: whatsapp || null,
          telegram: telegram || null
        },
        update: {
          instagram: instagram || null,
          facebook: facebook || null,
          whatsapp: whatsapp || null,
          telegram: telegram || null
        }
      });
    }

    // Parse banners if it's a JSON string (SQLite compatibility)
    if (restaurant.banners && typeof restaurant.banners === 'string') {
      try {
        restaurant.banners = JSON.parse(restaurant.banners);
      } catch (e) {
        restaurant.banners = [];
      }
    }

    // Parse workingHours if it's a JSON string (SQLite compatibility)
    if (restaurant.workingHours && typeof restaurant.workingHours === 'string') {
      try {
        restaurant.workingHours = JSON.parse(restaurant.workingHours);
      } catch (e) {
        restaurant.workingHours = null;
      }
    }

    // Re-fetch the restaurant with the updated social links to ensure the response is fresh
    const updatedRestaurantWithLinks = await prisma.restaurant.findUnique({
      where: { id },
      include: {
        subscriptions: true,
        socialLinks: true
      }
    });

    // Parse workingHours for the final response
    if (updatedRestaurantWithLinks.workingHours && typeof updatedRestaurantWithLinks.workingHours === 'string') {
      try {
        updatedRestaurantWithLinks.workingHours = JSON.parse(updatedRestaurantWithLinks.workingHours);
      } catch (e) {
        updatedRestaurantWithLinks.workingHours = null;
      }
    }

    // Parse banners for the final response
    if (updatedRestaurantWithLinks.banners && typeof updatedRestaurantWithLinks.banners === 'string') {
      try {
        updatedRestaurantWithLinks.banners = JSON.parse(updatedRestaurantWithLinks.banners);
      } catch (e) {
        updatedRestaurantWithLinks.banners = [];
      }
    }

    res.json(updatedRestaurantWithLinks);
  } catch (error) {
    next(error);
  }
};

export const uploadBanner = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('ðŸ–¼ï¸ Uploading banner:', { filename: req.file.filename, path: req.file.path });

    // Get image URL (Cloudinary returns full URL, local storage returns filename)
    const bannerUrl = req.file.path && req.file.path.startsWith('http')
      ? req.file.path
      : `/uploads/${req.file.filename}`;

    console.log('ðŸ–¼ï¸ Banner URL:', bannerUrl);

    // Add banner to restaurant
    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
      select: { banners: true }
    });

    // Parse banners if it's a JSON string (SQLite compatibility)
    let currentBanners = [];
    if (restaurant.banners) {
      if (typeof restaurant.banners === 'string') {
        try {
          currentBanners = JSON.parse(restaurant.banners);
        } catch (e) {
          currentBanners = [];
        }
      } else if (Array.isArray(restaurant.banners)) {
        currentBanners = restaurant.banners;
      }
    }

    const newBanners = [...currentBanners, bannerUrl];

    const updatedRestaurant = await prisma.restaurant.update({
      where: { id },
      data: {
        banners: JSON.stringify(newBanners)
      }
    });

    // Parse banners for response (SQLite compatibility)
    if (updatedRestaurant.banners && typeof updatedRestaurant.banners === 'string') {
      try {
        updatedRestaurant.banners = JSON.parse(updatedRestaurant.banners);
      } catch (e) {
        updatedRestaurant.banners = [];
      }
    }

    res.json({
      message: 'Banner uploaded successfully',
      bannerUrl,
      restaurant: updatedRestaurant
    });
  } catch (error) {
    next(error);
  }
};

export const deleteBanner = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { bannerUrl } = req.body;

    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
      select: { banners: true }
    });

    // Parse banners if it's a JSON string (SQLite compatibility)
    let currentBanners = [];
    if (restaurant.banners) {
      if (typeof restaurant.banners === 'string') {
        try {
          currentBanners = JSON.parse(restaurant.banners);
        } catch (e) {
          currentBanners = [];
        }
      } else if (Array.isArray(restaurant.banners)) {
        currentBanners = restaurant.banners;
      }
    }

    const updatedBanners = currentBanners.filter(b => b !== bannerUrl);

    const updatedRestaurant = await prisma.restaurant.update({
      where: { id },
      data: {
        banners: JSON.stringify(updatedBanners)
      }
    });

    // Parse banners for response (SQLite compatibility)
    if (updatedRestaurant.banners && typeof updatedRestaurant.banners === 'string') {
      try {
        updatedRestaurant.banners = JSON.parse(updatedRestaurant.banners);
      } catch (e) {
        updatedRestaurant.banners = [];
      }
    }

    res.json({
      message: 'Banner deleted successfully',
      restaurant: updatedRestaurant
    });
  } catch (error) {
    next(error);
  }
};

export const uploadLogo = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('ðŸ¢ Uploading logo:', { filename: req.file.filename, path: req.file.path });

    // Get image URL (Cloudinary returns full URL, local storage returns filename)
    const logoUrl = req.file.path && req.file.path.startsWith('http')
      ? req.file.path
      : `/uploads/${req.file.filename}`;

    console.log('ðŸ¢ Logo URL:', logoUrl);

    const updatedRestaurant = await prisma.restaurant.update({
      where: { id },
      data: { logo: logoUrl }
    });

    console.log('âœ… Logo updated successfully');

    // Parse banners for response (SQLite compatibility)
    if (updatedRestaurant.banners && typeof updatedRestaurant.banners === 'string') {
      try {
        updatedRestaurant.banners = JSON.parse(updatedRestaurant.banners);
      } catch (e) {
        updatedRestaurant.banners = [];
      }
    }

    res.json({
      message: 'Logo uploaded successfully',
      logoUrl,
      restaurant: updatedRestaurant
    });
  } catch (error) {
    next(error);
  }
};

export const deleteLogo = async (req, res, next) => {
  try {
    const { id } = req.params;

    const updatedRestaurant = await prisma.restaurant.update({
      where: { id },
      data: { logo: null }
    });

    // Parse banners for response (SQLite compatibility)
    if (updatedRestaurant.banners && typeof updatedRestaurant.banners === 'string') {
      try {
        updatedRestaurant.banners = JSON.parse(updatedRestaurant.banners);
      } catch (e) {
        updatedRestaurant.banners = [];
      }
    }

    res.json({
      message: 'Logo deleted successfully',
      restaurant: updatedRestaurant
    });
  } catch (error) {
    next(error);
  }
};

export const updateMenuCardStyle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { menuCardStyle } = req.body;

    if (!menuCardStyle || !['horizontal', 'vertical'].includes(menuCardStyle)) {
      return res.status(400).json({ error: 'Invalid menuCardStyle. Must be "horizontal" or "vertical"' });
    }

    const updatedRestaurant = await prisma.restaurant.update({
      where: { id },
      data: { cardStyle: menuCardStyle }
    });

    const restaurantWithMenuCardStyle = {
      ...updatedRestaurant,
      menuCardStyle: updatedRestaurant.cardStyle
    };

    res.json({
      message: 'Menu card style updated successfully',
      menuCardStyle: restaurantWithMenuCardStyle.menuCardStyle,
      restaurant: restaurantWithMenuCardStyle
    });
  } catch (error) {
    next(error);
  }
};

export const createRestaurant = async (req, res, next) => {
  try {
    const { name, subdomain } = req.body;

    if (!name || !subdomain) {
      return res.status(400).json({ error: 'Restaurant name and subdomain are required' });
    }

    // Check if subdomain is taken
    const existingRestaurant = await prisma.restaurant.findUnique({ where: { subdomain } });
    if (existingRestaurant) {
      return res.status(400).json({ error: 'Subdomain already taken' });
    }

    // Validate subdomain format
    if (!/^[a-z0-9-]+$/.test(subdomain)) {
      return res.status(400).json({ error: 'Subdomain can only contain lowercase letters, numbers, and hyphens' });
    }

    // ÐŸÐ¾Ð»ÑƒÑ‡Ð°ÐµÐ¼ Ð²ÑÐµ Ñ€ÐµÑÑ‚Ð¾Ñ€Ð°Ð½Ñ‹ Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»Ñ Ð²Ð¼ÐµÑÑ‚Ðµ Ñ Ð¸Ñ… Ð¿Ð¾Ð´Ð¿Ð¸ÑÐºÐ°Ð¼Ð¸
    const userRestaurants = await prisma.restaurant.findMany({
      where: { ownerId: req.user.id },
      include: {
        subscriptions: {
          where: {
            OR: [
              {
                status: 'TRIAL',
                trialEndsAt: { gt: new Date() }
              },
              {
                status: 'ACTIVE',
                currentPeriodEnd: { gt: new Date() }
              }
            ]
          }
        }
      }
    });

    // ÐŸÐ¾Ð´ÑÑ‡Ð¸Ñ‚Ñ‹Ð²Ð°ÐµÐ¼ Ñ€ÐµÑÑ‚Ð¾Ñ€Ð°Ð½Ñ‹ Ñ Ð°ÐºÑ‚Ð¸Ð²Ð½Ñ‹Ð¼Ð¸ Ð¿Ð¾Ð´Ð¿Ð¸ÑÐºÐ°Ð¼Ð¸
    const restaurantsWithActiveSubscriptions = userRestaurants.filter(
      restaurant => restaurant.subscriptions.some(sub =>
        (sub.status === 'TRIAL' && new Date(sub.trialEndsAt) > new Date()) ||
        (sub.status === 'ACTIVE' && new Date(sub.currentPeriodEnd) > new Date())
      )
    );

    const existingCount = userRestaurants.length;
    const activeCount = restaurantsWithActiveSubscriptions.length;

    // Ð•ÑÐ»Ð¸ ÑÑ‚Ð¾ Ð¿ÐµÑ€Ð²Ñ‹Ð¹ Ñ€ÐµÑÑ‚Ð¾Ñ€Ð°Ð½ - Ñ€Ð°Ð·Ñ€ÐµÑˆÐ°ÐµÐ¼ (TRIAL)
    const isFirstRestaurant = existingCount === 0;

    // ÐŸÑ€Ð¾Ð²ÐµÑ€ÑÐµÐ¼ Ð²ÑÐµ Ð¿Ð¾Ð´Ð¿Ð¸ÑÐºÐ¸ Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»Ñ
    const userSubscriptions = await prisma.subscription.findMany({
      where: {
        userId: req.user.id,
        OR: [
          {
            status: 'TRIAL',
            trialEndsAt: { gt: new Date() }
          },
          {
            status: 'ACTIVE',
            currentPeriodEnd: { gt: new Date() }
          }
        ]
      }
    });

    // ÐŸÐ¾Ð»ÑƒÑ‡Ð°ÐµÐ¼ Ð°ÐºÑ‚Ð¸Ð²Ð½ÑƒÑŽ Ð¿Ð¾Ð´Ð¿Ð¸ÑÐºÑƒ Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»Ñ Ð´Ð»Ñ Ð¿Ñ€Ð¾Ð²ÐµÑ€ÐºÐ¸ Ð»Ð¸Ð¼Ð¸Ñ‚Ð° (Ð¿Ñ€Ð¾Ð²ÐµÑ€ÑÐµÐ¼ Ð¡ÐÐÐ§ÐÐ›Ð)
    const activeUserSubscription = await prisma.subscription.findFirst({
      where: {
        userId: req.user.id,
        status: 'ACTIVE',
        currentPeriodEnd: { gt: new Date() }
      },
      include: {
        pricingTier: true
      }
    });

    // Ð•ÑÐ»Ð¸ ÑÑ‚Ð¾ Ð½Ðµ Ð¿ÐµÑ€Ð²Ñ‹Ð¹ Ñ€ÐµÑÑ‚Ð¾Ñ€Ð°Ð½, Ð¿Ñ€Ð¾Ð²ÐµÑ€ÑÐµÐ¼ Ð¿Ð¾Ð´Ð¿Ð¸ÑÐºÐ¸
    if (!isFirstRestaurant) {
      const newRestaurantCount = existingCount + 1;
      const monthlyPrice = await calculateSubscriptionPrice(newRestaurantCount);

      // Ð•ÑÐ»Ð¸ Ñƒ Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»Ñ ÐµÑÑ‚ÑŒ Ð°ÐºÑ‚Ð¸Ð²Ð½Ð°Ñ Ð¿Ð¾Ð´Ð¿Ð¸ÑÐºÐ° Ñ Ñ‚Ð°Ñ€Ð¸Ñ„Ð½Ñ‹Ð¼ Ð¿Ð»Ð°Ð½Ð¾Ð¼ - Ð¸ÑÐ¿Ð¾Ð»ÑŒÐ·ÑƒÐµÐ¼ ÐµÐ³Ð¾ Ð»Ð¸Ð¼Ð¸Ñ‚
      if (activeUserSubscription?.pricingTier) {
        // ÐŸÑ€Ð¾Ð²ÐµÑ€ÑÐµÐ¼ Ð»Ð¸Ð¼Ð¸Ñ‚ Ð¸Ð· Ñ‚Ð°Ñ€Ð¸Ñ„Ð° - ÑÑ‚Ð° Ð¿Ñ€Ð¾Ð²ÐµÑ€ÐºÐ° Ð½Ð¸Ð¶Ðµ (ÑÑ‚Ñ€Ð¾ÐºÐ° ~575)
        // ÐŸÑ€Ð¾Ð¿ÑƒÑÐºÐ°ÐµÐ¼ ÑÑ‚Ð°Ñ€ÑƒÑŽ Ð¿Ñ€Ð¾Ð²ÐµÑ€ÐºÑƒ activeCount
      } else {
        // Ð¡Ñ‚Ð°Ñ€Ð°Ñ Ð»Ð¾Ð³Ð¸ÐºÐ° Ð´Ð»Ñ Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»ÐµÐ¹ Ð±ÐµÐ· Ñ‚Ð°Ñ€Ð¸Ñ„Ð½Ð¾Ð³Ð¾ Ð¿Ð»Ð°Ð½Ð°
        // Ð•ÑÐ»Ð¸ Ð½ÐµÑ‚ Ð°ÐºÑ‚Ð¸Ð²Ð½Ð¾Ð¹ Ð¿Ð¾Ð´Ð¿Ð¸ÑÐºÐ¸ Ð¸Ð»Ð¸ ÑƒÐ¶Ðµ ÐµÑÑ‚ÑŒ Ñ€ÐµÑÑ‚Ð¾Ñ€Ð°Ð½ Ð² ÑÑ‚Ð°Ñ‚ÑƒÑÐµ PENDING
        if (activeCount === 0 || existingCount > activeCount) {
          const trialSubscription = userSubscriptions.find(sub => sub.status === 'TRIAL');
          const trialDaysRemaining = trialSubscription ? getTrialDaysRemaining(trialSubscription) : 0;

          return res.status(403).json({
            error: 'Active subscription required',
            message: 'Ð”Ð»Ñ ÑÐ¾Ð·Ð´Ð°Ð½Ð¸Ñ Ð´Ð¾Ð¿Ð¾Ð»Ð½Ð¸Ñ‚ÐµÐ»ÑŒÐ½Ð¾Ð³Ð¾ Ñ€ÐµÑÑ‚Ð¾Ñ€Ð°Ð½Ð° Ñ‚Ñ€ÐµÐ±ÑƒÐµÑ‚ÑÑ Ð°ÐºÑ‚Ð¸Ð²Ð½Ð°Ñ Ð¿Ð¾Ð´Ð¿Ð¸ÑÐºÐ°',
            requiresPayment: true,
            pricing: {
              monthlyPrice,
              currentRestaurants: existingCount,
              activeRestaurants: activeCount,
              pendingRestaurants: existingCount - activeCount,
              currency: 'USD'
            },
            trial: {
              daysRemaining: trialDaysRemaining
            }
          });
        }
      }
    }

    const trialEndDate = calculateTrialEndDate(parseInt(process.env.TRIAL_PERIOD_DAYS) || 7);
    const newRestaurantCount = existingCount + 1;
    const monthlyPrice = await calculateSubscriptionPrice(newRestaurantCount);

    // Ð˜ÑÐ¿Ð¾Ð»ÑŒÐ·ÑƒÐµÐ¼ ÑƒÐ¶Ðµ Ð¿Ð¾Ð»ÑƒÑ‡ÐµÐ½Ð½ÑƒÑŽ Ð¿Ð¾Ð´Ð¿Ð¸ÑÐºÑƒ Ð¸Ð· Ð¿Ñ€ÐµÐ´Ñ‹Ð´ÑƒÑ‰ÐµÐ¹ Ð¿Ñ€Ð¾Ð²ÐµÑ€ÐºÐ¸
    // (activeUserSubscription ÑƒÐ¶Ðµ Ð·Ð°Ð³Ñ€ÑƒÐ¶ÐµÐ½Ð° Ð²Ñ‹ÑˆÐµ)

    // ÐžÐ¿Ñ€ÐµÐ´ÐµÐ»ÑÐµÐ¼ Ð¼Ð°ÐºÑÐ¸Ð¼Ð°Ð»ÑŒÐ½Ð¾Ðµ ÐºÐ¾Ð»Ð¸Ñ‡ÐµÑÑ‚Ð²Ð¾ Ñ€ÐµÑÑ‚Ð¾Ñ€Ð°Ð½Ð¾Ð² Ð¸Ð· Ñ‚Ð°Ñ€Ð¸Ñ„Ð° Ð¿Ð¾Ð´Ð¿Ð¸ÑÐºÐ¸
    const maxRestaurants = activeUserSubscription?.pricingTier?.maxRestaurants || 1;

    // Ð”Ð¾Ð¿Ð¾Ð»Ð½Ð¸Ñ‚ÐµÐ»ÑŒÐ½Ð°Ñ Ð¿Ñ€Ð¾Ð²ÐµÑ€ÐºÐ° Ð¿ÐµÑ€ÐµÐ´ ÑÐ¾Ð·Ð´Ð°Ð½Ð¸ÐµÐ¼
    // Ð•ÑÐ»Ð¸ Ñƒ Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»Ñ Ð±Ð¾Ð»ÑŒÑˆÐµ Ð°ÐºÑ‚Ð¸Ð²Ð½Ñ‹Ñ… Ñ€ÐµÑÑ‚Ð¾Ñ€Ð°Ð½Ð¾Ð² Ñ‡ÐµÐ¼ Ð¿Ð¾Ð·Ð²Ð¾Ð»ÑÐµÑ‚ Ð¿Ð¾Ð´Ð¿Ð¸ÑÐºÐ°
    if (existingCount >= maxRestaurants) {
      const trialSubscription = userSubscriptions.find(sub => sub.status === 'TRIAL');
      const trialDaysRemaining = trialSubscription ? getTrialDaysRemaining(trialSubscription) : 0;

      return res.status(403).json({
        error: 'Subscription limit reached',
        message: 'Ð”Ð¾ÑÑ‚Ð¸Ð³Ð½ÑƒÑ‚ Ð»Ð¸Ð¼Ð¸Ñ‚ Ñ€ÐµÑÑ‚Ð¾Ñ€Ð°Ð½Ð¾Ð² Ð´Ð»Ñ Ñ‚ÐµÐºÑƒÑ‰ÐµÐ¹ Ð¿Ð¾Ð´Ð¿Ð¸ÑÐºÐ¸',
        requiresPayment: true,
        pricing: {
          monthlyPrice: await calculateSubscriptionPrice(existingCount + 1),
          currentRestaurants: existingCount,
          activeRestaurants: activeCount,
          maxRestaurants: maxRestaurants,
          currency: 'USD'
        },
        trial: {
          daysRemaining: trialDaysRemaining
        }
      });
    }

    // Ð¡Ð¾Ð·Ð´Ð°ÐµÐ¼ Ñ€ÐµÑÑ‚Ð¾Ñ€Ð°Ð½ Ñ‚Ð¾Ð»ÑŒÐºÐ¾ ÐµÑÐ»Ð¸ Ð²ÑÐµ Ð¿Ñ€Ð¾Ð²ÐµÑ€ÐºÐ¸ Ð¿Ñ€Ð¾Ð¹Ð´ÐµÐ½Ñ‹
    const restaurant = await prisma.restaurant.create({
      data: {
        name,
        subdomain,
        ownerId: req.user.id
      }
    });

    // Create subscription after restaurant is created
    const subscription = await prisma.subscription.create({
      data: {
        userId: req.user.id,
        restaurantId: restaurant.id,
        plan: 'MONTHLY',
        status: isFirstRestaurant ? 'TRIAL' : 'PENDING',
        trialEndsAt: isFirstRestaurant ? trialEndDate : null,
        currentPeriodStart: new Date(),
        currentPeriodEnd: isFirstRestaurant ? trialEndDate : new Date(),
      }
    });

    const restaurantWithSubscription = {
      ...restaurant,
      subscription
    };

    const successResponse = {
      message: 'Restaurant created successfully',
      restaurant: restaurantWithSubscription,
      pricing: {
        isFirstRestaurant,
        totalRestaurants: newRestaurantCount,
        monthlyPrice: monthlyPrice,
        currency: 'USD',
        requiresPayment: !isFirstRestaurant
      }
    };

    if (isFirstRestaurant) {
      const trialDaysRemaining = getTrialDaysRemaining(subscription);
      successResponse.trial = {
        daysRemaining: trialDaysRemaining
      };
    }

    res.status(201).json(successResponse);
  } catch (error) {
    next(error);
  }
};

export const deleteRestaurant = async (req, res, next) => {
  try {
    const { id } = req.params;

    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
      include: {
        subscriptions: true
      }
    });

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    if (restaurant.isTrialDefault) {
      const userRestaurants = await prisma.restaurant.findMany({
        where: { ownerId: req.user.id },
        include: {
          subscriptions: true
        }
      });

      const hasOtherPaidRestaurants = userRestaurants.some(r =>
        r.id !== id && r.subscriptions.some(sub =>
          sub.status === 'ACTIVE' && new Date(sub.currentPeriodEnd) > new Date()
        )
      );

      if (userRestaurants.length === 1 || !hasOtherPaidRestaurants) {
        return res.status(403).json({
          error: 'Cannot delete trial restaurant',
          message: 'ÐÐµÐ²Ð¾Ð·Ð¼Ð¾Ð¶Ð½Ð¾ ÑƒÐ´Ð°Ð»Ð¸Ñ‚ÑŒ Ð¿Ñ€Ð¾Ð±Ð½Ñ‹Ð¹ Ñ€ÐµÑÑ‚Ð¾Ñ€Ð°Ð½. Ð¡Ð½Ð°Ñ‡Ð°Ð»Ð° ÑÐ¾Ð·Ð´Ð°Ð¹Ñ‚Ðµ Ð½Ð¾Ð²Ñ‹Ð¹ Ñ€ÐµÑÑ‚Ð¾Ñ€Ð°Ð½ Ñ Ð¿Ð»Ð°Ñ‚Ð½Ð¾Ð¹ Ð¿Ð¾Ð´Ð¿Ð¸ÑÐºÐ¾Ð¹.'
        });
      }

      await prisma.restaurant.update({
        where: { id },
        data: { isTrialDefault: false }
      });
    }

    await prisma.restaurant.delete({
      where: { id }
    });

    res.json({
      message: 'Restaurant deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const copyMenu = async (req, res, next) => {
  try {
    const { id: targetRestaurantId } = req.params;
    const { sourceRestaurantId } = req.body;

    if (!sourceRestaurantId) {
      return res.status(400).json({ error: 'sourceRestaurantId is required' });
    }

    // Get source restaurant with all categories and dishes
    const sourceRestaurant = await prisma.restaurant.findUnique({
      where: { id: sourceRestaurantId },
      include: {
        categories: {
          include: {
            dishes: {
              include: {
                modifiers: {
                  include: {
                    options: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!sourceRestaurant) {
      return res.status(404).json({ error: 'Source restaurant not found' });
    }

    // Log modifiers for debugging
    console.log('ðŸ“‹ Copying menu from restaurant:', sourceRestaurantId);
    sourceRestaurant.categories.forEach(cat => {
      cat.dishes.forEach(dish => {
        if (dish.modifiers && dish.modifiers.length > 0) {
          console.log(`ðŸ“¦ Dish "${dish.name}" has ${dish.modifiers.length} modifiers`);
          dish.modifiers.forEach(mod => {
            const optionsCount = mod.options?.length || 0;
            const hasDirectPrice = mod.price !== null && mod.price !== undefined;
            console.log(`  â”œâ”€ Modifier "${mod.name}": ${optionsCount} options${hasDirectPrice ? ` (legacy price: ${mod.price})` : ''}`);
            if (mod.options && mod.options.length > 0) {
              mod.options.forEach(opt => {
                console.log(`  â”‚  â”œâ”€ Option "${opt.name}": ${opt.price} price`);
              });
            }
          });
        }
      });
    });

    // Delete existing categories and dishes in target restaurant
    await prisma.category.deleteMany({
      where: { restaurantId: targetRestaurantId }
    });

    // Copy categories and dishes
    for (const sourceCategory of sourceRestaurant.categories) {
      const newCategory = await prisma.category.create({
        data: {
          name: sourceCategory.name,
          description: sourceCategory.description,
          image: sourceCategory.image,
          order: sourceCategory.order,
          restaurantId: targetRestaurantId,
          dishes: {
            create: sourceCategory.dishes.map(dish => ({
              name: dish.name,
              description: dish.description,
              price: dish.price,
              image: dish.image,
              available: dish.available,
              order: dish.order,
              allergens: dish.allergens,
              discount: dish.discount,
              badge: dish.badge,
              restaurantId: targetRestaurantId,
              modifiers: {
                create: dish.modifiers.map(modifier => {
                  // Handle both old schema (modifier.price) and new schema (modifier.options)
                  if (modifier.options && modifier.options.length > 0) {
                    // New schema: modifier has options array
                    return {
                      name: modifier.name,
                      type: modifier.type,
                      required: modifier.required,
                      order: modifier.order,
                      options: {
                        create: modifier.options.map(option => ({
                          name: option.name,
                          price: option.price || 0
                        }))
                      }
                    };
                  } else {
                    // Old schema: modifier has direct price field
                    // Create a single option with the modifier's name and price
                    return {
                      name: modifier.name,
                      type: modifier.type,
                      required: modifier.required,
                      order: modifier.order,
                      options: {
                        create: [{
                          name: modifier.name,
                          price: modifier.price || 0
                        }]
                      }
                    };
                  }
                })
              }
            }))
          }
        },
        include: {
          dishes: {
            include: {
              modifiers: {
                include: {
                  options: true
                }
              }
            }
          }
        }
      });
    }

    res.json({
      message: 'Menu copied successfully',
      categoriesCount: sourceRestaurant.categories.length,
      dishesCount: sourceRestaurant.categories.reduce((sum, cat) => sum + cat.dishes.length, 0)
    });
  } catch (error) {
    next(error);
  }
};

export const getRestaurantCategories = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;

    const categories = await prisma.category.findMany({
      where: { restaurantId },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        order: true
      }
    });

    res.json(categories);
  } catch (error) {
    next(error);
  }
};
/**
 * ÐŸÐ¾Ð»ÑƒÑ‡Ð¸Ñ‚ÑŒ ÑÐ¿Ð¸ÑÐ¾Ðº ÐºÐ»Ð¸ÐµÐ½Ñ‚Ð¾Ð² Ñ€ÐµÑÑ‚Ð¾Ñ€Ð°Ð½Ð°
 */
export const getRestaurantCustomers = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const userId = req.user.id;

    // ÐŸÑ€Ð¾Ð²ÐµÑ€ÑÐµÐ¼, Ñ‡Ñ‚Ð¾ Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»ÑŒ - Ð²Ð»Ð°Ð´ÐµÐ»ÐµÑ† Ñ€ÐµÑÑ‚Ð¾Ñ€Ð°Ð½Ð° Ð¸Ð»Ð¸ ÐµÐ³Ð¾ ÑÐ¾Ñ‚Ñ€ÑƒÐ´Ð½Ð¸Ðº
    const restaurant = await prisma.restaurant.findFirst({
      where: {
        id: restaurantId,
        OR: [
          { ownerId: userId },
          {
            staff: {
              some: { userId }
            }
          }
        ]
      }
    });

    if (!restaurant) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // ÐŸÐ¾Ð»ÑƒÑ‡Ð°ÐµÐ¼ ÐºÐ»Ð¸ÐµÐ½Ñ‚Ð¾Ð² Ñ Ð¸Ñ… ÑÑ‚Ð°Ñ‚Ð¸ÑÑ‚Ð¸ÐºÐ¾Ð¹ Ð·Ð°ÐºÐ°Ð·Ð¾Ð²
    const customers = await prisma.customer.findMany({
      where: { restaurantId },
      include: {
        orders: {
          select: {
            id: true,
            totalAmount: true,
            status: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' }
        },
        favoriteDishes: {
          select: {
            dish: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        savedAddresses: {
          select: {
            id: true,
            address: true,
            isDefault: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Ð”Ð¾Ð±Ð°Ð²Ð»ÑÐµÐ¼ ÑÑ‚Ð°Ñ‚Ð¸ÑÑ‚Ð¸ÐºÑƒ Ð´Ð»Ñ ÐºÐ°Ð¶Ð´Ð¾Ð³Ð¾ ÐºÐ»Ð¸ÐµÐ½Ñ‚Ð°
    const customersWithStats = customers.map(customer => {
      const totalOrders = customer.orders.length;
      const totalSpent = customer.orders.reduce((sum, order) => sum + parseFloat(order.totalAmount || 0), 0);
      const lastOrderDate = customer.orders[0]?.createdAt || null;

      const { password, ...customerData } = customer;

      return {
        ...customerData,
        stats: {
          totalOrders,
          totalSpent,
          lastOrderDate
        }
      };
    });

    res.json({
      customers: customersWithStats,
      total: customersWithStats.length
    });
  } catch (error) {
    next(error);
  }
};
