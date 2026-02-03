import { prisma } from '../config/prisma.js';

export const getCategories = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;

    const categories = await prisma.category.findMany({
      where: { restaurantId },
      orderBy: { order: 'asc' },
      include: {
        categoryGroup: true, // Включаем информацию о группе категорий
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
    });

    // Debug: log modifiers data
    categories.forEach(cat => {
      cat.dishes.forEach(dish => {
        if (dish.modifiers && dish.modifiers.length > 0) {
          console.log(`📦 Dish "${dish.name}" modifiers:`, JSON.stringify(dish.modifiers, null, 2));
        }
      });
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
    const { name, description, restaurantId, order, categoryGroupId } = req.body;

    console.log('📝 Creating category:', {
      name,
      description,
      restaurantId,
      order: order || 0,
      categoryGroupId: categoryGroupId || null
    });

    const category = await prisma.category.create({
      data: {
        name,
        description,
        restaurantId,
        order: order || 0,
        categoryGroupId: categoryGroupId || null
      }
    });

    console.log('✅ Category created successfully:', category);
    res.status(201).json(category);
  } catch (error) {
    console.error('❌ Error creating category:', error);
    next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, order, isActive, categoryGroupId } = req.body;

    console.log('📝 Updating category:', {
      id,
      name,
      description,
      order,
      isActive,
      categoryGroupId: categoryGroupId || null
    });

    // Check if user has access to this category's restaurant
    const category = await prisma.category.findUnique({
      where: { id }
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: {
        name,
        description,
        order,
        isActive,
        categoryGroupId: categoryGroupId || null
      }
    });

    console.log('✅ Category updated successfully:', updatedCategory);
    res.json(updatedCategory);
  } catch (error) {
    console.error('❌ Error updating category:', error);
    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if user has access to this category's restaurant
    const category = await prisma.category.findUnique({
      where: { id }
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    await prisma.category.delete({
      where: { id }
    });

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const reorderCategories = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const { categoryIds } = req.body;

    console.log('Reorder categories:', { restaurantId, categoryIds, userId: req.user.id });

    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      return res.status(400).json({ error: 'Invalid categoryIds' });
    }

    // Update order for each category sequentially
    for (let i = 0; i < categoryIds.length; i++) {
      await prisma.category.update({
        where: { id: categoryIds[i] },
        data: { order: i }
      });
    }

    res.json({ message: 'Categories reordered successfully' });
  } catch (error) {
    console.error('Error reordering categories:', error);
    next(error);
  }
};