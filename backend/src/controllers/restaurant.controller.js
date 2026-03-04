import { prisma } from '../config/prisma.js';
import { calculateTrialEndDate, calculateSubscriptionPrice, getTrialDaysRemaining } from '../utils/subscription.js';
import { getNetworkRankedDeliveryPoints } from './geolocation.controller.js';
import { getModifierOptionSelect } from '../utils/modifierOptionFields.js';
import { ensureRestaurantAccess } from '../utils/restaurantAccess.js';

const isRestaurantOpen = (restaurant) => {
  if (restaurant.isTemporarilyClosed) return false;

  let workingHours = restaurant.workingHours;
  if (!workingHours) return true;

  if (typeof workingHours === 'string') {
    try {
      workingHours = JSON.parse(workingHours);
    } catch (e) {
      return true;
    }
  }

  if (!Array.isArray(workingHours) || workingHours.length === 0) return true;

  const now = new Date();
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = days[now.getDay()];

  const todaySchedule = workingHours.find(day => day.day === currentDay);

  if (!todaySchedule || !todaySchedule.isOpen) return false;

  if (!todaySchedule.openTime || !todaySchedule.closeTime) return true;

  const currentTime = now.getHours() * 60 + now.getMinutes();
  const [openH, openM] = todaySchedule.openTime.split(':').map(Number);
  const [closeH, closeM] = todaySchedule.closeTime.split(':').map(Number);

  const openTime = openH * 60 + openM;
  const closeTime = closeH * 60 + closeM;

  if (closeTime < openTime) {
    return currentTime >= openTime || currentTime < closeTime;
  }

  return currentTime >= openTime && currentTime < closeTime;
};

const RESTAURANT_SELECT = {
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
  freeDeliveryThreshold: true,
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
  sharedMenuSourceRestaurantId: true,
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
};

export const getRestaurantBySubdomain = async (req, res, next) => {
  try {
    const startTime = Date.now();
    const { subdomain } = req.params;
    let { language, latitude, longitude } = req.query;
    const now = new Date();

    console.log(`⏱️ [Menu Load] Starting for subdomain: ${subdomain}, language: ${language}`);

    // 1) Быстро получаем базовую информацию ресторана (нужно для defaultLanguage)
    const t1 = Date.now();
    let restaurantBase = await prisma.restaurant.findUnique({
      where: { subdomain },
      select: RESTAURANT_SELECT
    });
    console.log(`⏱️ [Menu Load] Restaurant base: ${Date.now() - t1}ms`);

    if (!restaurantBase) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Если переданы координаты, пытаемся найти ближайший ресторан сети
    if (latitude && longitude) {
      const lat = parseFloat(latitude);
      const lon = parseFloat(longitude);

      if (!isNaN(lat) && !isNaN(lon)) {
        try {
          // Ищем рестораны ТОГО ЖЕ владельца (ownerId), сортируем по расстоянию
          const ranked = await getNetworkRankedDeliveryPoints({
            ownerId: restaurantBase.ownerId,
            latitude: lat,
            longitude: lon
          });

          // 1) Ближайший открытый в зоне доставки
          let nearest = ranked.find(r => r.inDeliveryZone && isRestaurantOpen(r));

          // 2) Фолбэк: просто ближайший открытый, даже вне зоны доставки
          if (!nearest) {
            nearest = ranked.find(r => isRestaurantOpen(r));
          }

          // Если нашли ближайший и это не текущий ресторан - переключаемся
          if (nearest && nearest.id !== restaurantBase.id) {
            console.log(`📍 [Menu Load] Switching to nearest open restaurant: ${nearest.name} (${nearest.id})`);

            const nearestRestaurant = await prisma.restaurant.findUnique({
              where: { id: nearest.id },
              select: RESTAURANT_SELECT
            });

            if (nearestRestaurant) {
              restaurantBase = nearestRestaurant;
            }
          }
        } catch (geoError) {
          console.error('Error finding nearest restaurant:', geoError);
        }
      }
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
    const menuSourceRestaurantId = restaurantBase.sharedMenuSourceRestaurantId || restaurantBase.id;
    let categories;
    try {
      const modifierOptionSelect = await getModifierOptionSelect();
      categories = await prisma.category.findMany({
        where: { restaurantId: menuSourceRestaurantId },
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
              deliveryPrice: true,
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
                  options: {
                    orderBy: { createdAt: 'asc' },
                    select: modifierOptionSelect
                  }
                }
              }
            }
          }
        }
      });
    } catch (modifierError) {
      console.error('⚠️ getRestaurantBySubdomain fallback mode: failed to load modifier options, returning menu without option payload', modifierError);
      categories = await prisma.category.findMany({
        where: { restaurantId: menuSourceRestaurantId },
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
              deliveryPrice: true,
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
                orderBy: { order: 'asc' }
              }
            }
          }
        }
      });
    }

    const effectiveStopRestaurantIds = restaurantBase.sharedMenuSourceRestaurantId
      ? [restaurantBase.sharedMenuSourceRestaurantId, restaurantBase.id]
      : [restaurantBase.id];

    const stopList = await prisma.dishStop.findMany({
      where: {
        restaurantId: { in: effectiveStopRestaurantIds },
        isStopped: true
      },
      select: { dishId: true, reason: true, restaurantId: true }
    });

    const localStoppedDishIds = new Set(
      stopList.filter((stop) => stop.restaurantId === restaurantBase.id).map((stop) => stop.dishId)
    );
    const sourceStoppedDishIds = new Set(
      stopList.filter((stop) => stop.restaurantId === menuSourceRestaurantId).map((stop) => stop.dishId)
    );

    const stoppedByDishId = new Map();
    stopList.forEach((stop) => {
      const existing = stoppedByDishId.get(stop.dishId);
      const isLocalStop = stop.restaurantId === restaurantBase.id;

      if (!existing || isLocalStop) {
        stoppedByDishId.set(stop.dishId, {
          reason: stop.reason || null,
          restaurantId: stop.restaurantId
        });
      }
    });

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
            const stopMeta = stoppedByDishId.get(dish.id);
            const isStoppedLocally = localStoppedDishIds.has(dish.id);
            const isStoppedAtMenuSource = sourceStoppedDishIds.has(dish.id);
            const isStopped = isStoppedLocally || isStoppedAtMenuSource;
            return {
              ...dish,
              modifiers: (dish.modifiers || []).map((modifier) => ({
                ...modifier,
                options: Array.isArray(modifier.options) ? modifier.options : []
              })),
              imageUrl: dish.image,
              available: dish.available && !isStopped,
              stoppedAtRestaurant: isStopped,
              stoppedAtLocalRestaurant: isStoppedLocally,
              stoppedAtMenuSource: isStoppedAtMenuSource,
              stopReason: stopMeta?.reason || null,
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
      country,
      city,
      phone,
      description,
      instagram,
      facebook,
      whatsapp,
      telegram,
      deliveryEnabled,
      deliveryFee,
      minOrderAmount,
      freeDeliveryThreshold,
      useTierBonusSettings,
      bonusProgramEnabled,
      bonusAccrualRate,
      bonusExpiryDays,
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

    const existingRestaurant = await prisma.restaurant.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        sharedMenuSourceRestaurantId: true
      }
    });

    if (!existingRestaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    if (existingRestaurant.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Only owner can update restaurant' });
    }

    const isOutlet = Boolean(existingRestaurant.sharedMenuSourceRestaurantId);

    if (bonusAccrualRate !== undefined && bonusAccrualRate !== null) {
      const parsedRate = parseFloat(bonusAccrualRate);
      if (Number.isNaN(parsedRate) || parsedRate < 0 || parsedRate > 1) {
        return res.status(400).json({ error: 'bonusAccrualRate must be between 0 and 1' });
      }
    }

    if (bonusExpiryDays !== undefined && bonusExpiryDays !== null) {
      const parsedDays = parseInt(bonusExpiryDays);
      if (Number.isNaN(parsedDays) || parsedDays < 1) {
        return res.status(400).json({ error: 'bonusExpiryDays must be >= 1' });
      }
    }

    const updateData = {
      name,
      address,
      phone,
      deliveryEnabled,
      deliveryFee: deliveryFee ? parseFloat(deliveryFee) : null,
      minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : null,
      freeDeliveryThreshold: freeDeliveryThreshold ? parseFloat(freeDeliveryThreshold) : null,
      useTierBonusSettings: useTierBonusSettings !== undefined ? Boolean(useTierBonusSettings) : undefined,
      bonusProgramEnabled: bonusProgramEnabled !== undefined ? Boolean(bonusProgramEnabled) : undefined,
      bonusAccrualRate: bonusAccrualRate !== undefined && bonusAccrualRate !== null
        ? parseFloat(bonusAccrualRate)
        : bonusAccrualRate === null
          ? null
          : undefined,
      bonusExpiryDays: bonusExpiryDays !== undefined && bonusExpiryDays !== null
        ? parseInt(bonusExpiryDays)
        : bonusExpiryDays === null
          ? null
          : undefined,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      deliveryRadius: deliveryRadius ? parseFloat(deliveryRadius) : null,
      workingHours: workingHours ? JSON.stringify(workingHours) : null,
      isTemporarilyClosed: isTemporarilyClosed || false,
      closureReason: closureReason || null,
      telegramGroupId: telegramGroupId || null,
    };

    if (!isOutlet) {
      updateData.description = description;
      updateData.country = country !== undefined ? (country || null) : undefined;
      updateData.city = city !== undefined ? (city || null) : undefined;
      updateData.currency = currency;
      updateData.cardStyle = menuCardStyle || 'horizontal';
      updateData.primaryColor = primaryColor || null;
      updateData.themePalette = themePalette || null;
    }

    const restaurant = await prisma.restaurant.update({
      where: { id },
      data: updateData,
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

    const restaurantOwner = await prisma.restaurant.findUnique({
      where: { id },
      select: { ownerId: true, sharedMenuSourceRestaurantId: true }
    });

    if (!restaurantOwner) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    if (restaurantOwner.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Only owner can update restaurant' });
    }

    if (restaurantOwner.sharedMenuSourceRestaurantId) {
      return res.status(403).json({
        error: 'Shared template locked',
        message: 'Этот ресторан наследует оформление от главного. Добавьте баннеры в главном ресторане.'
      });
    }

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

    const restaurantOwner = await prisma.restaurant.findUnique({
      where: { id },
      select: { ownerId: true, sharedMenuSourceRestaurantId: true }
    });

    if (!restaurantOwner) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    if (restaurantOwner.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Only owner can update restaurant' });
    }

    if (restaurantOwner.sharedMenuSourceRestaurantId) {
      return res.status(403).json({
        error: 'Shared template locked',
        message: 'Этот ресторан наследует оформление от главного. Удалять баннеры можно только в главном ресторане.'
      });
    }

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

    const restaurantOwner = await prisma.restaurant.findUnique({
      where: { id },
      select: { ownerId: true, sharedMenuSourceRestaurantId: true }
    });

    if (!restaurantOwner) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    if (restaurantOwner.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Only owner can update restaurant' });
    }

    if (restaurantOwner.sharedMenuSourceRestaurantId) {
      return res.status(403).json({
        error: 'Shared template locked',
        message: 'Этот ресторан наследует оформление от главного. Измените логотип в главном ресторане.'
      });
    }

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

    const restaurantOwner = await prisma.restaurant.findUnique({
      where: { id },
      select: { ownerId: true, sharedMenuSourceRestaurantId: true }
    });

    if (!restaurantOwner) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    if (restaurantOwner.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Only owner can update restaurant' });
    }

    if (restaurantOwner.sharedMenuSourceRestaurantId) {
      return res.status(403).json({
        error: 'Shared template locked',
        message: 'Этот ресторан наследует оформление от главного. Удалить логотип можно только в главном ресторане.'
      });
    }

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

    const restaurantOwner = await prisma.restaurant.findUnique({
      where: { id },
      select: { ownerId: true, sharedMenuSourceRestaurantId: true }
    });

    if (!restaurantOwner) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    if (restaurantOwner.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Only owner can update restaurant' });
    }

    if (restaurantOwner.sharedMenuSourceRestaurantId) {
      return res.status(403).json({
        error: 'Shared template locked',
        message: 'Этот ресторан наследует оформление от главного. Менять стиль карточек нужно в главном ресторане.'
      });
    }

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
    const { name, subdomain: providedSubdomain, businessType } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Restaurant name is required' });
    }

    const normalizedSubdomain = providedSubdomain?.trim();
    let subdomain = normalizedSubdomain;

    // Validate provided subdomain format and uniqueness
    if (subdomain) {
      if (!/^[a-z0-9-]+$/.test(subdomain)) {
        return res.status(400).json({ error: 'Subdomain can only contain lowercase letters, numbers, and hyphens' });
      }

      const existingRestaurant = await prisma.restaurant.findUnique({ where: { subdomain } });
      if (existingRestaurant) {
        return res.status(400).json({ error: 'Subdomain already taken' });
      }
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

    // Choose the earliest created restaurant as the primary source for shared menu/branding.
    const primaryRestaurant = userRestaurants.reduce((earliest, restaurant) => {
      if (!earliest) return restaurant;
      if (earliest.createdAt && restaurant.createdAt && new Date(restaurant.createdAt) < new Date(earliest.createdAt)) {
        return restaurant;
      }
      return earliest;
    }, null);

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

    // Auto-generate subdomain if not provided, based on the primary restaurant's subdomain.
    if (!subdomain) {
      const baseSubdomainFromPrimary = primaryRestaurant?.subdomain || null;

      const normalizeSlug = value => value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/--+/g, '-');

      const ensureUniqueSubdomain = async (base, suffixStart = 2) => {
        let candidate = base;
        let counter = suffixStart;

        // Keep incrementing suffix until we find a free subdomain
        while (await prisma.restaurant.findUnique({ where: { subdomain: candidate } })) {
          candidate = `${base}-${counter}`;
          counter += 1;
        }

        return candidate;
      };

      if (baseSubdomainFromPrimary) {
        subdomain = await ensureUniqueSubdomain(baseSubdomainFromPrimary, 2);
      } else {
        const fallbackBase = normalizeSlug(name) || 'restaurant';
        subdomain = await ensureUniqueSubdomain(fallbackBase, 2);
      }
    }

    const inheritedTemplateData = !isFirstRestaurant && primaryRestaurant
      ? {
        description: primaryRestaurant.description || null,
        country: req.body.country || primaryRestaurant.country || null,
        city: req.body.city || primaryRestaurant.city || null,
        currency: primaryRestaurant.currency || 'RUB',
        logo: primaryRestaurant.logo || null,
        banners: primaryRestaurant.banners || null,
        cardStyle: primaryRestaurant.cardStyle || 'horizontal',
        primaryColor: primaryRestaurant.primaryColor || null,
        themePalette: primaryRestaurant.themePalette || null,
      }
      : {
        description: req.body.description || null,
        country: req.body.country || null,
        city: req.body.city || null,
      };

    // Ð¡Ð¾Ð·Ð´Ð°ÐµÐ¼ Ñ€ÐµÑÑ‚Ð¾Ñ€Ð°Ð½ Ñ‚Ð¾Ð»ÑŒÐºÐ¾ ÐµÑÐ»Ð¸ Ð²ÑÐµ Ð¿Ñ€Ð¾Ð²ÐµÑ€ÐºÐ¸ Ð¿Ñ€Ð¾Ð¹Ð´ÐµÐ½Ñ‹
    const restaurant = await prisma.restaurant.create({
      data: {
        name,
        subdomain,
        businessType: businessType || 'RESTAURANT',
        ...inheritedTemplateData,
        ownerId: req.user.id,
        sharedMenuSourceRestaurantId: isFirstRestaurant ? null : primaryRestaurant?.id || null
      }
    });

    // --- NEW LOGIC FOR SUBSCRIPTION ---
    let subscriptionData;

    if (isFirstRestaurant) {
      // Логика для самого первого ресторана верна: даем триал.
      const trialEndDate = calculateTrialEndDate(parseInt(process.env.TRIAL_PERIOD_DAYS) || 7);
      subscriptionData = {
        plan: 'TRIAL',
        status: 'TRIAL',
        trialEndsAt: trialEndDate,
        currentPeriodStart: new Date(),
        currentPeriodEnd: trialEndDate,
      };
    } else if (activeUserSubscription) {
      // Если это не первый ресторан, но у пользователя есть активная подписка,
      // новый ресторан сразу становится активным в рамках этой подписки.
      subscriptionData = {
        plan: activeUserSubscription.plan,
        status: 'ACTIVE',
        pricingTierId: activeUserSubscription.pricingTierId,
        currentPeriodStart: activeUserSubscription.currentPeriodStart,
        currentPeriodEnd: activeUserSubscription.currentPeriodEnd,
      };
    } else {
      // Запасной вариант: если нет активной подписки (например, триал истек),
      // то новый ресторан требует активации.
      subscriptionData = {
        plan: 'MONTHLY',
        status: 'PENDING',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
      };
    }

    // Create subscription after restaurant is created
    const subscription = await prisma.subscription.create({
      data: {
        userId: req.user.id,
        restaurantId: restaurant.id,
        ...subscriptionData
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

    const targetRestaurant = await prisma.restaurant.findUnique({
      where: { id: targetRestaurantId },
      select: { ownerId: true, sharedMenuSourceRestaurantId: true }
    });

    if (!targetRestaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    if (targetRestaurant.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Only owner can copy menu' });
    }

    if (targetRestaurant.sharedMenuSourceRestaurantId) {
      return res.status(403).json({
        error: 'Shared template locked',
        message: 'Меню этого филиала наследуется от главного ресторана. Редактируйте меню в главном ресторане.'
      });
    }

    // Get source restaurant with category groups, categories and dishes
    const sourceRestaurant = await prisma.restaurant.findUnique({
      where: { id: sourceRestaurantId },
      include: {
        categoryGroups: {
          orderBy: { order: 'asc' }
        },
        categories: {
          orderBy: { order: 'asc' },
          include: {
            dishes: {
              orderBy: { order: 'asc' },
              include: {
                modifiers: {
                  orderBy: { order: 'asc' },
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

    // Delete existing categories and groups in target restaurant
    await prisma.category.deleteMany({
      where: { restaurantId: targetRestaurantId }
    });

    await prisma.categoryGroup.deleteMany({
      where: { restaurantId: targetRestaurantId }
    });

    const groupIdMap = new Map();

    // Copy category groups first (to preserve categoryGroupId links)
    for (const sourceGroup of sourceRestaurant.categoryGroups || []) {
      const createdGroup = await prisma.categoryGroup.create({
        data: {
          name: sourceGroup.name,
          description: sourceGroup.description,
          image: sourceGroup.image,
          order: sourceGroup.order,
          restaurantId: targetRestaurantId
        }
      });

      groupIdMap.set(sourceGroup.id, createdGroup.id);
    }

    // Copy categories and dishes
    for (const sourceCategory of sourceRestaurant.categories) {
      const newCategory = await prisma.category.create({
        data: {
          name: sourceCategory.name,
          description: sourceCategory.description,
          image: sourceCategory.image,
          order: sourceCategory.order,
          categoryGroupId: sourceCategory.categoryGroupId
            ? (groupIdMap.get(sourceCategory.categoryGroupId) || null)
            : null,
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
      categoryGroupsCount: sourceRestaurant.categoryGroups?.length || 0,
      categoriesCount: sourceRestaurant.categories.length,
      dishesCount: sourceRestaurant.categories.reduce((sum, cat) => sum + cat.dishes.length, 0)
    });
  } catch (error) {
    next(error);
  }
};

export const setSharedMenuSource = async (req, res, next) => {
  try {
    const { id: restaurantId } = req.params;
    const { sourceRestaurantId } = req.body;

    const targetRestaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, ownerId: true }
    });

    if (!targetRestaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    if (targetRestaurant.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Only owner can configure shared menu source' });
    }

    if (sourceRestaurantId) {
      const sourceRestaurant = await prisma.restaurant.findUnique({
        where: { id: sourceRestaurantId },
        select: { id: true, ownerId: true }
      });

      if (!sourceRestaurant) {
        return res.status(404).json({ error: 'Source restaurant not found' });
      }

      if (sourceRestaurant.ownerId !== req.user.id) {
        return res.status(403).json({ error: 'Source restaurant must belong to the same owner' });
      }
    }

    if (sourceRestaurantId && sourceRestaurantId === restaurantId) {
      return res.status(400).json({ error: 'Cannot set restaurant as its own source' });
    }

    const updated = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        sharedMenuSourceRestaurantId: sourceRestaurantId || null
      },
      select: {
        id: true,
        name: true,
        sharedMenuSourceRestaurantId: true
      }
    });

    res.json({
      message: sourceRestaurantId
        ? 'Shared menu source configured'
        : 'Shared menu source disabled',
      restaurant: updated
    });
  } catch (error) {
    next(error);
  }
};

export const getDishStops = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const userId = req.user.id;

    const restaurant = await prisma.restaurant.findFirst({
      where: {
        id: restaurantId,
        OR: [
          { ownerId: userId },
          { staff: { some: { userId } } }
        ]
      },
      select: {
        id: true,
        sharedMenuSourceRestaurantId: true
      }
    });

    if (!restaurant) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const menuSourceRestaurantId = restaurant.sharedMenuSourceRestaurantId || restaurant.id;

    const stops = await prisma.dishStop.findMany({
      where: {
        restaurantId,
        isStopped: true,
        dish: { restaurantId: menuSourceRestaurantId }
      },
      include: {
        dish: {
          select: {
            id: true,
            name: true,
            price: true,
            image: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json({
      restaurantId,
      menuSourceRestaurantId,
      stops
    });
  } catch (error) {
    next(error);
  }
};

export const setDishStop = async (req, res, next) => {
  try {
    const { restaurantId, dishId } = req.params;
    const userId = req.user.id;
    const { isStopped = true, reason } = req.body;

    const isOwnerOrAdmin = req.user?.isAdmin || req.user?.restaurants?.some((restaurant) => restaurant.id === restaurantId);
    const hasManagerRole = req.user?.restaurantStaff?.some(
      (staff) => staff.restaurantId === restaurantId && staff.role === 'manager'
    );

    if (!isOwnerOrAdmin && !hasManagerRole) {
      return res.status(403).json({ error: 'Only manager or owner can manage dish stop status' });
    }

    const restaurant = await prisma.restaurant.findFirst({
      where: {
        id: restaurantId,
        OR: [
          { ownerId: userId },
          { staff: { some: { userId, role: 'manager' } } }
        ]
      },
      select: {
        id: true,
        sharedMenuSourceRestaurantId: true
      }
    });

    if (!restaurant) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const menuSourceRestaurantId = restaurant.sharedMenuSourceRestaurantId || restaurant.id;
    const dish = await prisma.dish.findUnique({
      where: { id: dishId },
      select: { id: true, restaurantId: true, name: true }
    });

    if (!dish || dish.restaurantId !== menuSourceRestaurantId) {
      return res.status(400).json({ error: 'Dish is not part of this restaurant shared menu' });
    }

    if (isStopped) {
      const stop = await prisma.dishStop.upsert({
        where: {
          restaurantId_dishId: { restaurantId, dishId }
        },
        create: {
          restaurantId,
          dishId,
          isStopped: true,
          reason: reason || null
        },
        update: {
          isStopped: true,
          reason: reason || null
        }
      });

      return res.json({
        message: 'Dish stopped for this restaurant',
        stop
      });
    }

    await prisma.dishStop.deleteMany({
      where: { restaurantId, dishId }
    });

    res.json({
      message: 'Dish is available for this restaurant',
      restaurantId,
      dishId,
      isStopped: false
    });
  } catch (error) {
    next(error);
  }
};

export const getRestaurantCategories = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;

    if (!ensureRestaurantAccess(req, res, restaurantId)) {
      return;
    }

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
      where: {
        OR: [
          { registeredRestaurantId: restaurantId },
          { orders: { some: { restaurantId } } }
        ]
      },
      include: {
        orders: {
          where: { restaurantId },
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
