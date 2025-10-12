import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getCategories = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;

    const categories = await prisma.category.findMany({
      where: { restaurantId },
      orderBy: { order: 'asc' },
      include: {
        dishes: {
          orderBy: { order: 'asc' },
          include: {
            modifiers: {
              orderBy: { order: 'asc' }
            }
          }
        }
      }
    });

    // Map 'image' field to 'imageUrl' for frontend compatibility
    const categoriesWithImageUrl = categories.map(category => {
      const { dishes, ...categoryRest } = category;
      return {
        ...categoryRest,
        dishes: dishes.map(dish => {
          const { modifiers, ...dishRest } = dish;
          return {
            ...dishRest,
            modifiers,
            imageUrl: dish.image || null  // Explicitly set imageUrl from image field
          };
        })
      };
    });

    res.json(categoriesWithImageUrl);
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const { name, description, restaurantId, order } = req.body;

    // Check if user owns this restaurant
    if (req.user.restaurant.id !== restaurantId && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const category = await prisma.category.create({
      data: {
        name,
        description,
        restaurantId,
        order: order || 0
      }
    });

    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, order, isActive } = req.body;

    // Check if user owns this category's restaurant
    const category = await prisma.category.findUnique({
      where: { id },
      include: { restaurant: true }
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if (req.user.restaurant.id !== category.restaurantId && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: {
        name,
        description,
        order,
        isActive
      }
    });

    res.json(updatedCategory);
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if user owns this category's restaurant
    const category = await prisma.category.findUnique({
      where: { id },
      include: { restaurant: true }
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if (req.user.restaurant.id !== category.restaurantId && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.category.delete({
      where: { id }
    });

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
};