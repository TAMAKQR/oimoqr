import { prisma } from '../config/prisma.js';
import { ensureRestaurantAccess, ensureRestaurantOwnerAccess } from '../utils/restaurantAccess.js';
import { getModifierOptionSelect } from '../utils/modifierOptionFields.js';
import { loadModifierOptionStops } from '../utils/modifierOptionStops.js';

export const getCategories = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;

    if (!ensureRestaurantAccess(req, res, restaurantId)) {
      return;
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, sharedMenuSourceRestaurantId: true }
    });

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const menuSourceRestaurantId = restaurant.sharedMenuSourceRestaurantId || restaurant.id;

    let categories;
    try {
      const modifierOptionSelect = await getModifierOptionSelect();
      categories = await prisma.category.findMany({
        where: { restaurantId: menuSourceRestaurantId },
        orderBy: { order: 'asc' },
        include: {
          categoryGroup: true,
          dishes: {
            orderBy: { order: 'asc' },
            include: {
              modifiers: {
                orderBy: { order: 'asc' },
                include: {
                  options: {
                    select: modifierOptionSelect
                  }
                }
              }
            }
          }
        }
      });
    } catch (modifierError) {
      console.error('⚠️ getCategories fallback mode: failed to load modifier options, returning categories without options', modifierError);
      categories = await prisma.category.findMany({
        where: { restaurantId: menuSourceRestaurantId },
        orderBy: { order: 'asc' },
        include: {
          categoryGroup: true,
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
    }
    const effectiveStopRestaurantIds = restaurant.sharedMenuSourceRestaurantId
      ? [restaurant.sharedMenuSourceRestaurantId, restaurantId]
      : [restaurantId];

    const dishStops = await prisma.dishStop.findMany({
      where: {
        restaurantId: { in: effectiveStopRestaurantIds },
        isStopped: true
      },
      select: { dishId: true, reason: true, restaurantId: true }
    });

    const localStoppedDishIds = new Set(
      dishStops.filter((stop) => stop.restaurantId === restaurantId).map((stop) => stop.dishId)
    );
    const sourceStoppedDishIds = new Set(
      dishStops.filter((stop) => stop.restaurantId === menuSourceRestaurantId).map((stop) => stop.dishId)
    );

    const stopByDish = new Map();
    dishStops.forEach((stop) => {
      const existing = stopByDish.get(stop.dishId);
      const isLocalStop = stop.restaurantId === restaurantId;

      if (!existing || isLocalStop) {
        stopByDish.set(stop.dishId, {
          reason: stop.reason || null,
          restaurantId: stop.restaurantId
        });
      }
    });

    const {
      localStoppedOptionIds,
      sourceStoppedOptionIds,
      stopByOption
    } = await loadModifierOptionStops({
      restaurantId,
      menuSourceRestaurantId
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
          const { modifiers = [], ...dishRest } = dish;
          const stopMeta = stopByDish.get(dish.id);
          const isStoppedLocally = localStoppedDishIds.has(dish.id);
          const isStoppedAtMenuSource = sourceStoppedDishIds.has(dish.id);
          const isStopped = isStoppedLocally || isStoppedAtMenuSource;

          const mappedModifiers = modifiers.map((modifier) => {
            const rawOptions = Array.isArray(modifier.options) ? modifier.options : [];
            const mappedOptions = rawOptions.map((option) => {
              const isOptionStoppedLocally = localStoppedOptionIds.has(option.id);
              const isOptionStoppedAtMenuSource = sourceStoppedOptionIds.has(option.id);
              const isOptionStopped = isOptionStoppedLocally || isOptionStoppedAtMenuSource;
              const optionStopMeta = stopByOption.get(option.id);

              return {
                ...option,
                available: !isOptionStopped,
                stoppedAtRestaurant: isOptionStopped,
                stoppedAtLocalRestaurant: isOptionStoppedLocally,
                stoppedAtMenuSource: isOptionStoppedAtMenuSource,
                stopReason: optionStopMeta?.reason || null
              };
            });

            return {
              ...modifier,
              options: mappedOptions,
              hasAvailableOptions: mappedOptions.some((option) => option.available !== false)
            };
          });

          return {
            ...dishRest,
            modifiers: mappedModifiers.map(({ hasAvailableOptions, ...modifierRest }) => modifierRest),
            available: dish.available && !isStopped,
            stoppedAtRestaurant: isStopped,
            stoppedAtLocalRestaurant: isStoppedLocally,
            stoppedAtMenuSource: isStoppedAtMenuSource,
            stopReason: stopMeta?.reason || null,
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

    if (!ensureRestaurantOwnerAccess(req, res, restaurantId)) {
      return;
    }

    console.log('📝 Creating category:', {
      name,
      description,
      restaurantId,
      order: order || 'auto',
      categoryGroupId: categoryGroupId || null
    });

    // ✅ Если order не указан, добавляем категорию в конец списка
    let categoryOrder = order;
    if (!categoryOrder && categoryOrder !== 0) {
      const lastCategory = await prisma.category.findFirst({
        where: { restaurantId },
        orderBy: { order: 'desc' }
      });
      categoryOrder = lastCategory ? lastCategory.order + 1 : 0;
    }

    const category = await prisma.category.create({
      data: {
        name,
        description,
        restaurantId,
        order: categoryOrder,
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

    if (!ensureRestaurantOwnerAccess(req, res, category.restaurantId)) {
      return;
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

    if (!ensureRestaurantOwnerAccess(req, res, category.restaurantId)) {
      return;
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

    if (!ensureRestaurantOwnerAccess(req, res, restaurantId)) {
      return;
    }

    const categories = await prisma.category.findMany({
      where: {
        id: { in: categoryIds },
        restaurantId
      },
      select: { id: true }
    });

    if (categories.length !== categoryIds.length) {
      return res.status(400).json({ error: 'One or more categories do not belong to this restaurant' });
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
