import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getDishes = async (req, res, next) => {
  try {
    const { categoryId } = req.params;

    const dishes = await prisma.dish.findMany({
      where: { categoryId },
      orderBy: { order: 'asc' },
      include: {
        modifiers: {
          orderBy: { order: 'asc' }
        }
      }
    });

    // Map 'image' field to 'imageUrl' for frontend compatibility
    const dishesWithImageUrl = dishes.map(dish => ({
      ...dish,
      imageUrl: dish.image
    }));

    res.json(dishesWithImageUrl);
  } catch (error) {
    next(error);
  }
};

export const createDish = async (req, res, next) => {
  try {
    const { name, description, price, categoryId, order } = req.body;

    // Validate price
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ error: 'Price must be a number greater than or equal to 0' });
    }

    // Check if user owns this category's restaurant
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: { restaurant: true }
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if (req.user.restaurant.id !== category.restaurantId && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const dish = await prisma.dish.create({
      data: {
        name,
        description,
        price: parsedPrice,
        categoryId,
        order: order || 0
      }
    });

    res.status(201).json({
      ...dish,
      imageUrl: dish.image
    });
  } catch (error) {
    next(error);
  }
};

export const updateDish = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, price, order, isActive } = req.body;

    // Validate price if provided
    let parsedPrice = undefined;
    if (price !== undefined && price !== null) {
      parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ error: 'Price must be a number greater than or equal to 0' });
      }
    }

    // Check if user owns this dish's restaurant
    const dish = await prisma.dish.findUnique({
      where: { id },
      include: {
        category: {
          include: { restaurant: true }
        }
      }
    });

    if (!dish) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    if (req.user.restaurant.id !== dish.category.restaurantId && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedDish = await prisma.dish.update({
      where: { id },
      data: {
        name,
        description,
        price: parsedPrice,
        order,
        isActive
      }
    });

    res.json({
      ...updatedDish,
      imageUrl: updatedDish.image
    });
  } catch (error) {
    next(error);
  }
};

export const uploadDishImage = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Check if user owns this dish's restaurant
    const dish = await prisma.dish.findUnique({
      where: { id },
      include: {
        category: {
          include: { restaurant: true }
        }
      }
    });

    if (!dish) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    if (req.user.restaurant.id !== dish.category.restaurantId && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get image URL (Cloudinary returns full URL, local storage returns filename)
    const imageUrl = req.file.path || `/uploads/${req.file.filename}`;

    const updatedDish = await prisma.dish.update({
      where: { id },
      data: { image: imageUrl }
    });

    res.json({
      message: 'Image uploaded successfully',
      imageUrl,
      dish: {
        ...updatedDish,
        imageUrl: updatedDish.image
      }
    });
  } catch (error) {
    next(error);
  }
};

export const deleteDishImage = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if user owns this dish's restaurant
    const dish = await prisma.dish.findUnique({
      where: { id },
      include: {
        category: {
          include: { restaurant: true }
        }
      }
    });

    if (!dish) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    if (req.user.restaurant.id !== dish.category.restaurantId && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update dish to remove image
    const updatedDish = await prisma.dish.update({
      where: { id },
      data: { image: null }
    });

    res.json({ 
      message: 'Image deleted successfully',
      dish: {
        ...updatedDish,
        imageUrl: updatedDish.image
      }
    });
  } catch (error) {
    next(error);
  }
};

export const deleteDish = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if user owns this dish's restaurant
    const dish = await prisma.dish.findUnique({
      where: { id },
      include: {
        category: {
          include: { restaurant: true }
        }
      }
    });

    if (!dish) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    if (req.user.restaurant.id !== dish.category.restaurantId && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.dish.delete({
      where: { id }
    });

    res.json({ message: 'Dish deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const createModifier = async (req, res, next) => {
  try {
    const { dishId } = req.params;
    const { name, price, isRequired, order } = req.body;

    // Validate price
    const parsedPrice = price ? parseFloat(price) : 0;
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ error: 'Modifier price must be a number greater than or equal to 0' });
    }

    // Check if user owns this dish's restaurant
    const dish = await prisma.dish.findUnique({
      where: { id: dishId },
      include: {
        category: {
          include: { restaurant: true }
        }
      }
    });

    if (!dish) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    if (req.user.restaurant.id !== dish.category.restaurantId && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const modifier = await prisma.modifier.create({
      data: {
        name,
        price: parsedPrice,
        isRequired: isRequired || false,
        dishId,
        order: order || 0
      }
    });

    res.status(201).json(modifier);
  } catch (error) {
    next(error);
  }
};

export const updateModifier = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, price, isRequired, order } = req.body;

    // Validate price if provided
    let parsedPrice = undefined;
    if (price !== undefined && price !== null) {
      parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ error: 'Modifier price must be a number greater than or equal to 0' });
      }
    }

    // Check if user owns this modifier's restaurant
    const modifier = await prisma.modifier.findUnique({
      where: { id },
      include: {
        dish: {
          include: {
            category: {
              include: { restaurant: true }
            }
          }
        }
      }
    });

    if (!modifier) {
      return res.status(404).json({ error: 'Modifier not found' });
    }

    if (req.user.restaurant.id !== modifier.dish.category.restaurantId && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedModifier = await prisma.modifier.update({
      where: { id },
      data: {
        name,
        price: parsedPrice,
        isRequired,
        order
      }
    });

    res.json(updatedModifier);
  } catch (error) {
    next(error);
  }
};

export const deleteModifier = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if user owns this modifier's restaurant
    const modifier = await prisma.modifier.findUnique({
      where: { id },
      include: {
        dish: {
          include: {
            category: {
              include: { restaurant: true }
            }
          }
        }
      }
    });

    if (!modifier) {
      return res.status(404).json({ error: 'Modifier not found' });
    }

    if (req.user.restaurant.id !== modifier.dish.category.restaurantId && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.modifier.delete({
      where: { id }
    });

    res.json({ message: 'Modifier deleted successfully' });
  } catch (error) {
    next(error);
  }
};