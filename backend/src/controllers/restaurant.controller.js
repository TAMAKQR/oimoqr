import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getRestaurantBySubdomain = async (req, res, next) => {
  try {
    const { subdomain } = req.params;

    const restaurant = await prisma.restaurant.findUnique({
      where: { subdomain },
      include: {
        subscription: true,
        categories: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
          include: {
            dishes: {
              where: { isActive: true },
              orderBy: { order: 'asc' },
              include: {
                modifiers: {
                  orderBy: { order: 'asc' }
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

    // Check if subscription is active
    const now = new Date();
    const isActive = restaurant.subscription && (
      (restaurant.subscription.status === 'TRIAL' && new Date(restaurant.subscription.trialEndsAt) > now) ||
      (restaurant.subscription.status === 'ACTIVE' && new Date(restaurant.subscription.currentPeriodEnd) > now)
    );

    if (!isActive) {
      return res.status(403).json({ error: 'Restaurant subscription is not active' });
    }

    // Parse banners if it's a JSON string (SQLite compatibility)
    if (restaurant.banners && typeof restaurant.banners === 'string') {
      try {
        restaurant.banners = JSON.parse(restaurant.banners);
      } catch (e) {
        restaurant.banners = [];
      }
    }

    // Map 'image' field to 'imageUrl' for frontend compatibility
    const restaurantWithImageUrl = {
      ...restaurant,
      categories: restaurant.categories.map(category => ({
        ...category,
        dishes: category.dishes.map(dish => ({
          ...dish,
          imageUrl: dish.image
        }))
      }))
    };

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
      deliveryEnabled,
      deliveryFee,
      minOrderAmount,
      currency,
      menuCardStyle
    } = req.body;

    // Check if user owns this restaurant
    if (req.user.restaurant.id !== id && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const restaurant = await prisma.restaurant.update({
      where: { id },
      data: {
        name,
        address,
        phone,
        description,
        instagram,
        facebook,
        whatsapp,
        deliveryEnabled,
        deliveryFee: deliveryFee ? parseFloat(deliveryFee) : null,
        minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : null,
        currency,
        menuCardStyle: menuCardStyle || 'horizontal',
      },
      include: {
        subscription: true
      }
    });

    // Parse banners if it's a JSON string (SQLite compatibility)
    if (restaurant.banners && typeof restaurant.banners === 'string') {
      try {
        restaurant.banners = JSON.parse(restaurant.banners);
      } catch (e) {
        restaurant.banners = [];
      }
    }

    res.json(restaurant);
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

    // Check if user owns this restaurant
    if (req.user.restaurant.id !== id && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get image URL (Cloudinary returns full URL, local storage returns filename)
    const bannerUrl = req.file.path || `/uploads/${req.file.filename}`;

    // Add banner to restaurant
    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
      select: { banners: true }
    });

    // Parse banners if it's a JSON string (SQLite compatibility)
    let currentBanners = restaurant.banners;
    if (typeof currentBanners === 'string') {
      try {
        currentBanners = JSON.parse(currentBanners);
      } catch (e) {
        currentBanners = [];
      }
    }

    const newBanners = [...currentBanners, bannerUrl];

    const updatedRestaurant = await prisma.restaurant.update({
      where: { id },
      data: {
        banners: typeof restaurant.banners === 'string' 
          ? JSON.stringify(newBanners) 
          : newBanners
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

    // Check if user owns this restaurant
    if (req.user.restaurant.id !== id && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
      select: { banners: true }
    });

    // Parse banners if it's a JSON string (SQLite compatibility)
    let currentBanners = restaurant.banners;
    if (typeof currentBanners === 'string') {
      try {
        currentBanners = JSON.parse(currentBanners);
      } catch (e) {
        currentBanners = [];
      }
    }

    const updatedBanners = currentBanners.filter(b => b !== bannerUrl);

    const updatedRestaurant = await prisma.restaurant.update({
      where: { id },
      data: {
        banners: typeof restaurant.banners === 'string' 
          ? JSON.stringify(updatedBanners) 
          : updatedBanners
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

    // Check if user owns this restaurant
    if (req.user.restaurant.id !== id && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get image URL (Cloudinary returns full URL, local storage returns filename)
    const logoUrl = req.file.path || `/uploads/${req.file.filename}`;

    const updatedRestaurant = await prisma.restaurant.update({
      where: { id },
      data: { logo: logoUrl }
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

    // Check if user owns this restaurant
    if (req.user.restaurant.id !== id && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
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

    if (!menuCardStyle || !['horizontal', 'vertical'].includes(menuCardStyle)) {
      return res.status(400).json({ error: 'Invalid menuCardStyle. Must be "horizontal" or "vertical"' });
    }

    if (req.user.restaurant.id !== id && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedRestaurant = await prisma.restaurant.update({
      where: { id },
      data: { menuCardStyle }
    });

    res.json({
      message: 'Menu card style updated successfully',
      menuCardStyle: updatedRestaurant.menuCardStyle,
      restaurant: updatedRestaurant
    });
  } catch (error) {
    next(error);
  }
};