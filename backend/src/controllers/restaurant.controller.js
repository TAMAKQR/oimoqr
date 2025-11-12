import { prisma } from '../config/prisma.js';
import { calculateTrialEndDate, calculateSubscriptionPrice, getTrialDaysRemaining } from '../utils/subscription.js';

export const getRestaurantBySubdomain = async (req, res, next) => {
  try {
    const { subdomain } = req.params;
    let { language } = req.query;

    // First, get the restaurant to check defaultLanguage
    const restaurantInfo = await prisma.restaurant.findUnique({
      where: { subdomain },
      select: { defaultLanguage: true }
    });

    if (!restaurantInfo) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Use defaultLanguage if no language is specified
    if (!language) {
      language = restaurantInfo.defaultLanguage;
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { subdomain },
      include: {
        socialLinks: true,
        subscriptions: true,
        languages: {
          where: { isEnabled: true },
          orderBy: { order: 'asc' }
        },
        categories: {
          orderBy: { order: 'asc' },
          include: {
            translations: {
              where: language ? { languageCode: language } : undefined
            },
            dishes: {
              where: { available: true },
              orderBy: { order: 'asc' },
              include: {
                modifiers: true,
                translations: {
                  where: language ? { languageCode: language } : undefined
                }
              }
            }
          }
        }
      }
    });

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Check user subscription (not restaurant subscription)
    const now = new Date();
    
    // Получаем активную подписку владельца ресторана
    const ownerSubscription = await prisma.subscription.findFirst({
      where: {
        userId: restaurant.ownerId,
        OR: [
          {
            status: 'TRIAL',
            trialEndsAt: { gt: now }
          },
          {
            status: 'ACTIVE',
            currentPeriodEnd: { gt: now }
          }
        ]
      },
      include: {
        pricingTier: true
      }
    });

    if (!ownerSubscription) {
      return res.status(403).json({ error: 'Restaurant subscription is not active' });
    }

    // Проверяем, что количество ресторанов владельца не превышает лимит тарифа
    if (ownerSubscription.pricingTier) {
      const ownerRestaurantsCount = await prisma.restaurant.count({
        where: { ownerId: restaurant.ownerId }
      });
      
      const maxRestaurants = ownerSubscription.pricingTier.maxRestaurants;
      
      if (ownerRestaurantsCount > maxRestaurants) {
        return res.status(403).json({ 
          error: 'Subscription limit exceeded',
          message: `Превышен лимит ресторанов для текущей подписки (${maxRestaurants})`
        });
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

    // Map 'image' field to 'imageUrl' for frontend compatibility and apply translations
    const restaurantWithImageUrl = {
      ...restaurant,
      menuCardStyle: restaurant.cardStyle,
      categories: restaurant.categories.map(category => {
        const categoryTranslation = language && category.translations.length > 0 ? category.translations[0] : null;
        return {
          ...category,
          name: categoryTranslation?.name || category.name,
          description: categoryTranslation?.description || category.description,
          dishes: category.dishes.map(dish => {
            const translation = language && dish.translations.length > 0 ? dish.translations[0] : null;
            return {
              ...dish,
              imageUrl: dish.image,
              name: translation?.name || dish.name,
              description: translation?.description || dish.description
            };
          })
        };
      })
    };

    // Раскладываем socialLinks для консистентности с админ-панелью
    const socialLinks = restaurant.socialLinks || {};
    restaurantWithImageUrl.instagram = socialLinks.instagram || '';
    restaurantWithImageUrl.facebook = socialLinks.facebook || '';
    restaurantWithImageUrl.whatsapp = socialLinks.whatsapp || '';
    restaurantWithImageUrl.telegram = socialLinks.telegram || '';

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
      workingHours,
      isTemporarilyClosed,
      closureReason,
      latitude,
      longitude,
      deliveryRadius
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
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        deliveryRadius: deliveryRadius ? parseFloat(deliveryRadius) : null,
        workingHours: workingHours ? JSON.stringify(workingHours) : null,
        isTemporarilyClosed: isTemporarilyClosed || false,
        closureReason: closureReason || null,
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

    console.log('🖼️ Uploading banner:', { filename: req.file.filename, path: req.file.path });

    // Get image URL (Cloudinary returns full URL, local storage returns filename)
    const bannerUrl = req.file.path && req.file.path.startsWith('http') 
      ? req.file.path 
      : `/uploads/${req.file.filename}`;

    console.log('🖼️ Banner URL:', bannerUrl);

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

    console.log('🏢 Uploading logo:', { filename: req.file.filename, path: req.file.path });

    // Get image URL (Cloudinary returns full URL, local storage returns filename)
    const logoUrl = req.file.path && req.file.path.startsWith('http') 
      ? req.file.path 
      : `/uploads/${req.file.filename}`;

    console.log('🏢 Logo URL:', logoUrl);

    const updatedRestaurant = await prisma.restaurant.update({
      where: { id },
      data: { logo: logoUrl }
    });

    console.log('✅ Logo updated successfully');

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

    // Получаем все рестораны пользователя вместе с их подписками
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

    // Подсчитываем рестораны с активными подписками
    const restaurantsWithActiveSubscriptions = userRestaurants.filter(
      restaurant => restaurant.subscriptions.some(sub => 
        (sub.status === 'TRIAL' && new Date(sub.trialEndsAt) > new Date()) ||
        (sub.status === 'ACTIVE' && new Date(sub.currentPeriodEnd) > new Date())
      )
    );

    const existingCount = userRestaurants.length;
    const activeCount = restaurantsWithActiveSubscriptions.length;

    // Если это первый ресторан - разрешаем (TRIAL)
    const isFirstRestaurant = existingCount === 0;
    
    // Проверяем все подписки пользователя
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

    // Получаем активную подписку пользователя для проверки лимита (проверяем СНАЧАЛА)
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
    
    // Если это не первый ресторан, проверяем подписки
    if (!isFirstRestaurant) {
      const newRestaurantCount = existingCount + 1;
      const monthlyPrice = await calculateSubscriptionPrice(newRestaurantCount);

      // Если у пользователя есть активная подписка с тарифным планом - используем его лимит
      if (activeUserSubscription?.pricingTier) {
        // Проверяем лимит из тарифа - эта проверка ниже (строка ~575)
        // Пропускаем старую проверку activeCount
      } else {
        // Старая логика для пользователей без тарифного плана
        // Если нет активной подписки или уже есть ресторан в статусе PENDING
        if (activeCount === 0 || existingCount > activeCount) {
          const trialSubscription = userSubscriptions.find(sub => sub.status === 'TRIAL');
          const trialDaysRemaining = trialSubscription ? getTrialDaysRemaining(trialSubscription) : 0;
          
          return res.status(403).json({
            error: 'Active subscription required',
            message: 'Для создания дополнительного ресторана требуется активная подписка',
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

    // Используем уже полученную подписку из предыдущей проверки
    // (activeUserSubscription уже загружена выше)
    
    // Определяем максимальное количество ресторанов из тарифа подписки
    const maxRestaurants = activeUserSubscription?.pricingTier?.maxRestaurants || 1;
    
    // Дополнительная проверка перед созданием
    // Если у пользователя больше активных ресторанов чем позволяет подписка
    if (existingCount >= maxRestaurants) {
      const trialSubscription = userSubscriptions.find(sub => sub.status === 'TRIAL');
      const trialDaysRemaining = trialSubscription ? getTrialDaysRemaining(trialSubscription) : 0;
      
      return res.status(403).json({
        error: 'Subscription limit reached',
        message: 'Достигнут лимит ресторанов для текущей подписки',
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

    // Создаем ресторан только если все проверки пройдены
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
          message: 'Невозможно удалить пробный ресторан. Сначала создайте новый ресторан с платной подпиской.'
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
                create: dish.modifiers.map(modifier => ({
                  name: modifier.name,
                  type: modifier.type,
                  required: modifier.required,
                  order: modifier.order,
                  options: {
                    create: modifier.options.map(option => ({
                      name: option.name,
                      price: option.price
                    }))
                  }
                }))
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
