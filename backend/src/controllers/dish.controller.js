import { prisma } from '../config/prisma.js';

const ensureModifierManagementAllowed = async (selectedRestaurantId) => {
  if (!selectedRestaurantId) {
    return;
  }

  const selectedRestaurant = await prisma.restaurant.findUnique({
    where: { id: selectedRestaurantId },
    select: { id: true, sharedMenuSourceRestaurantId: true }
  });

  if (!selectedRestaurant) {
    const error = new Error('Restaurant not found');
    error.status = 404;
    throw error;
  }

  if (selectedRestaurant.sharedMenuSourceRestaurantId) {
    const error = new Error('Shared template locked');
    error.status = 403;
    error.message = 'Модификаторы филиала наследуются от главного ресторана. Изменяйте их в главном ресторане.';
    throw error;
  }
};

const hasOwnerAccessToRestaurant = (req, restaurantId) => {
  if (!restaurantId) return false;
  return Boolean(
    req.user?.isAdmin ||
    req.user?.restaurants?.some((restaurant) => restaurant.id === restaurantId)
  );
};

const ensureOwnerAccessToRestaurant = (req, res, restaurantId) => {
  if (hasOwnerAccessToRestaurant(req, restaurantId)) {
    return true;
  }

  res.status(403).json({
    error: 'Только главный администратор ресторана может изменять блюда'
  });
  return false;
};

export const getDishes = async (req, res, next) => {
  try {
    const { categoryId } = req.params;

    const dishes = await prisma.dish.findMany({
      where: { categoryId },
      orderBy: { order: 'asc' },
      include: {
        modifiers: {
          include: {
            options: true
          }
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

export const getRestaurantDishes = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    console.log('🍽️ [getRestaurantDishes] Loading dishes for restaurant:', restaurantId);

    const dishes = await prisma.dish.findMany({
      where: {
        category: {
          restaurantId
        }
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        deliveryPrice: true,
        image: true,
        available: true,
        order: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    console.log(`✅ [getRestaurantDishes] Found ${dishes.length} dishes`);
    res.json(dishes);
  } catch (error) {
    console.error('❌ [getRestaurantDishes] Error:', error);
    next(error);
  }
};

export const createDish = async (req, res, next) => {
  try {
    const { name, description, price, deliveryPrice, categoryId, order, allergens, discount, badge } = req.body;
    console.log('Creating dish:', { name, categoryId, price });

    // Validate price
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ error: 'Price must be a number greater than or equal to 0' });
    }

    // Validate deliveryPrice
    let parsedDeliveryPrice = null;
    if (deliveryPrice !== undefined && deliveryPrice !== null && deliveryPrice !== '') {
      parsedDeliveryPrice = parseFloat(deliveryPrice);
      if (isNaN(parsedDeliveryPrice) || parsedDeliveryPrice < 0) {
        return res.status(400).json({ error: 'Delivery price must be a number greater than or equal to 0' });
      }
    }

    // Validate discount if provided
    let parsedDiscount = null;
    if (discount !== undefined && discount !== null && discount !== '') {
      parsedDiscount = parseInt(discount);
      if (isNaN(parsedDiscount) || parsedDiscount < 0 || parsedDiscount > 100) {
        return res.status(400).json({ error: 'Discount must be a number between 0 and 100' });
      }
    }

    // Check if user has access to this category's restaurant
    const category = await prisma.category.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if (!ensureOwnerAccessToRestaurant(req, res, category.restaurantId)) {
      return;
    }

    // ✅ Если order не указан, добавляем блюдо в конец списка
    let dishOrder = order;
    if (!dishOrder && dishOrder !== 0) {
      const lastDish = await prisma.dish.findFirst({
        where: { categoryId },
        orderBy: { order: 'desc' }
      });
      dishOrder = lastDish ? lastDish.order + 1 : 0;
    }

    const dishData = {
      name,
      description,
      price: parsedPrice,
      deliveryPrice: parsedDeliveryPrice,
      categoryId,
      restaurantId: category.restaurantId,
      order: dishOrder,
      allergens: allergens || null,
      discount: parsedDiscount,
      badge: badge || null
    };

    console.log('Saving dish to database:', dishData);
    const dish = await prisma.dish.create({
      data: dishData
    });

    res.status(201).json({
      ...dish,
      imageUrl: dish.image
    });
  } catch (error) {
    console.error('Error creating dish:', error);
    next(error);
  }
};

export const updateDish = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, price, deliveryPrice, order, isActive, allergens, discount, badge } = req.body;

    console.log('📝 Updating dish:', { id, name, price, allergens, discount, badge });

    // Validate price if provided
    let parsedPrice = undefined;
    if (price !== undefined && price !== null) {
      parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ error: 'Price must be a number greater than or equal to 0' });
      }
    }

    // Validate deliveryPrice if provided
    let parsedDeliveryPrice = undefined;
    if (deliveryPrice !== undefined) {
      if (deliveryPrice === null || deliveryPrice === '') {
        parsedDeliveryPrice = null;
      } else {
        parsedDeliveryPrice = parseFloat(deliveryPrice);
        if (isNaN(parsedDeliveryPrice) || parsedDeliveryPrice < 0) {
          return res.status(400).json({ error: 'Delivery price must be a number greater than or equal to 0' });
        }
      }
    }

    // Validate discount if provided
    let parsedDiscount = undefined;
    if (discount !== undefined) {
      if (discount === null || discount === '') {
        parsedDiscount = null;
      } else {
        parsedDiscount = parseInt(discount);
        if (isNaN(parsedDiscount) || parsedDiscount < 0 || parsedDiscount > 100) {
          return res.status(400).json({ error: 'Discount must be a number between 0 and 100' });
        }
      }
    }

    // Check if user has access to this dish's restaurant
    const dish = await prisma.dish.findUnique({
      where: { id },
      include: {
        category: true
      }
    });

    if (!dish) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    if (!ensureOwnerAccessToRestaurant(req, res, dish.category.restaurantId)) {
      return;
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (parsedPrice !== undefined) updateData.price = parsedPrice;
    if (parsedDeliveryPrice !== undefined) updateData.deliveryPrice = parsedDeliveryPrice;
    if (order !== undefined) updateData.order = order;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (allergens !== undefined) updateData.allergens = allergens;
    if (parsedDiscount !== undefined) updateData.discount = parsedDiscount;
    if (badge !== undefined) updateData.badge = badge;
    if (req.body.recommendationIds !== undefined) updateData.recommendationIds = req.body.recommendationIds;

    console.log('📝 Update data:', updateData);

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No data to update' });
    }

    const updatedDish = await prisma.dish.update({
      where: { id },
      data: updateData
    });

    console.log('✅ Dish updated successfully');

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
    console.log('🖼️ [Backend] Upload dish image request received');
    console.log('🖼️ [Backend] Dish ID:', id);
    console.log('🖼️ [Backend] Request file:', req.file);
    console.log('🖼️ [Backend] User:', req.user?.id);

    if (!req.file) {
      console.error('❌ [Backend] No file uploaded in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('🖼️ [Backend] File details:', {
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      destination: req.file.destination
    });

    // Check if user has access to this dish's restaurant
    console.log('🔍 [Backend] Looking for dish...');
    const dish = await prisma.dish.findUnique({
      where: { id },
      include: {
        category: {
          include: {
            restaurant: true
          }
        }
      }
    });

    if (!dish) {
      console.error('❌ [Backend] Dish not found:', id);
      return res.status(404).json({ error: 'Dish not found' });
    }

    console.log('✅ [Backend] Dish found:', {
      dishId: dish.id,
      dishName: dish.name,
      categoryId: dish.category.id,
      restaurantId: dish.category.restaurant.id
    });

    // Check user access
    const restaurantId = dish.category.restaurant.id;
    console.log('🔐 [Backend] Checking user access to restaurant:', restaurantId);
    console.log('🔐 [Backend] User data:', {
      userId: req.user.id,
      ownedRestaurants: req.user.restaurants?.map(r => r.id),
      staffRestaurants: req.user.restaurantStaff?.map(s => s.restaurantId)
    });

    if (!ensureOwnerAccessToRestaurant(req, res, restaurantId)) {
      console.error('❌ [Backend] User does not have owner access to this restaurant');
      console.error('❌ [Backend] Required restaurant:', restaurantId);
      return;
    }

    console.log('✅ [Backend] User has access: as owner');

    // Get image URL (Cloudinary returns full URL, local storage returns filename)
    const imageUrl = req.file.path && req.file.path.startsWith('http')
      ? req.file.path
      : `/uploads/${req.file.filename}`;

    console.log('🖼️ [Backend] Generated image URL:', imageUrl);

    // Update dish with image
    console.log('💾 [Backend] Updating dish with image...');
    const updatedDish = await prisma.dish.update({
      where: { id },
      data: { image: imageUrl }
    });

    console.log('✅ [Backend] Dish updated successfully:', updatedDish);

    res.json({
      message: 'Image uploaded successfully',
      imageUrl,
      dish: {
        ...updatedDish,
        imageUrl: updatedDish.image
      }
    });
  } catch (error) {
    console.error('❌ [Backend] Error uploading dish image:', error);
    console.error('❌ [Backend] Error stack:', error.stack);
    next(error);
  }
};

export const deleteDishImage = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if user has access to this dish's restaurant
    const dish = await prisma.dish.findUnique({
      where: { id },
      include: {
        category: true
      }
    });

    if (!dish) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    if (!ensureOwnerAccessToRestaurant(req, res, dish.category.restaurantId)) {
      return;
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

    // Check if user has access to this dish's restaurant
    const dish = await prisma.dish.findUnique({
      where: { id },
      include: {
        category: true
      }
    });

    if (!dish) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    if (!ensureOwnerAccessToRestaurant(req, res, dish.category.restaurantId)) {
      return;
    }

    // Check if dish is used in any orders
    const ordersCount = await prisma.orderItem.count({
      where: { dishId: id }
    });

    if (ordersCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete dish that has been ordered',
        message: `Это блюдо используется в ${ordersCount} ${ordersCount === 1 ? 'заказе' : 'заказах'}. Удаление невозможно для сохранения истории.\n\n💡 Вместо удаления используйте кнопку ⏸ чтобы скрыть блюдо из меню.`
      });
    }

    await prisma.dish.delete({
      where: { id }
    });

    res.json({ message: 'Dish deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const toggleDishAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if user has access to this dish's restaurant
    const dish = await prisma.dish.findUnique({
      where: { id },
      include: {
        category: true
      }
    });

    if (!dish) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    if (!ensureOwnerAccessToRestaurant(req, res, dish.category.restaurantId)) {
      return;
    }

    // Toggle availability
    const updatedDish = await prisma.dish.update({
      where: { id },
      data: { available: !dish.available },
      include: {
        modifiers: {
          include: {
            options: true
          }
        }
      }
    });

    res.json({
      message: `Dish ${updatedDish.available ? 'available' : 'unavailable'} successfully`,
      dish: {
        ...updatedDish,
        imageUrl: updatedDish.image
      }
    });
  } catch (error) {
    next(error);
  }
};

export const createModifier = async (req, res, next) => {
  try {
    const { dishId } = req.params;
    const { name, price = 0, isRequired, type = "default", restaurantId: selectedRestaurantId } = req.body;

    await ensureModifierManagementAllowed(selectedRestaurantId);

    // Validate price
    let parsedPrice = 0;
    if (price !== undefined && price !== null) {
      parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice)) {
        return res.status(400).json({ error: 'Modifier price must be a number greater than or equal to 0' });
      }
    }

    // Check if user has access to this dish's restaurant
    const dish = await prisma.dish.findUnique({
      where: { id: dishId },
      include: {
        category: true
      }
    });

    if (!dish) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    if (!ensureOwnerAccessToRestaurant(req, res, dish.category.restaurantId)) {
      return;
    }

    // Создаем модификатор вместе с опцией
    const modifier = await prisma.modifier.create({
      data: {
        name,
        type,
        price: parsedPrice,
        isRequired: isRequired || false,
        dishId,
        options: {
          create: {
            name: name, // Опция получает то же имя, что и модификатор
            price: parsedPrice
          }
        }
      },
      include: {
        options: true
      }
    });

    res.status(201).json(modifier);
  } catch (error) {
    console.error('Error creating modifier:', error);
    next(error);
  }
};

export const updateModifier = async (req, res, next) => {
  try {
    const { modifierId: id } = req.params;
    const { name, price, isRequired, restaurantId: selectedRestaurantId } = req.body;

    await ensureModifierManagementAllowed(selectedRestaurantId || req.query.restaurantId);

    // Validate price if provided
    let parsedPrice = undefined;
    if (price !== undefined && price !== null) {
      parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ error: 'Modifier price must be a number greater than or equal to 0' });
      }
    }

    // Check if user has access to this modifier's restaurant
    const modifier = await prisma.modifier.findUnique({
      where: { id },
      include: {
        dish: {
          include: {
            category: true
          }
        }
      }
    });

    if (!modifier) {
      return res.status(404).json({ error: 'Modifier not found' });
    }

    if (!ensureOwnerAccessToRestaurant(req, res, modifier.dish.category.restaurantId)) {
      return;
    }

    const updatedModifier = await prisma.modifier.update({
      where: { id },
      data: {
        name,
        price: parsedPrice,
        isRequired
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

    await ensureModifierManagementAllowed(req.query.restaurantId);

    // Check if user has access to this modifier's restaurant
    const modifier = await prisma.modifier.findUnique({
      where: { id },
      include: {
        dish: {
          include: {
            category: true
          }
        }
      }
    });

    if (!modifier) {
      return res.status(404).json({ error: 'Modifier not found' });
    }

    if (!ensureOwnerAccessToRestaurant(req, res, modifier.dish.category.restaurantId)) {
      return;
    }

    // Use a transaction to delete options first, then the modifier
    await prisma.$transaction([
      prisma.modifierOption.deleteMany({
        where: { modifierId: id },
      }),
      prisma.modifier.delete({
        where: { id },
      }),
    ]);

    res.status(200).json({ message: 'Modifier deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const reorderDishes = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const { dishIds } = req.body;

    // Check if user has access to this category's restaurant
    const category = await prisma.category.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if (!ensureOwnerAccessToRestaurant(req, res, category.restaurantId)) {
      return;
    }

    if (!Array.isArray(dishIds) || dishIds.length === 0) {
      return res.status(400).json({ error: 'Invalid dishIds' });
    }

    // Update order for each dish
    const updates = dishIds.map((id, index) =>
      prisma.dish.update({
        where: { id },
        data: { order: index }
      })
    );

    await Promise.all(updates);

    res.json({ message: 'Dishes reordered successfully' });
  } catch (error) {
    next(error);
  }
};

// ============ MODIFIER OPTIONS CONTROLLERS ============

export const createModifierOption = async (req, res, next) => {
  try {
    const { modifierId } = req.params;
    const { name, price = 0, restaurantId: selectedRestaurantId } = req.body;

    await ensureModifierManagementAllowed(selectedRestaurantId || req.query.restaurantId);

    // Validate price
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ error: 'Option price must be a number greater than or equal to 0' });
    }

    const modifier = await prisma.modifier.findUnique({
      where: { id: modifierId },
      include: {
        dish: {
          include: {
            category: true
          }
        }
      }
    });

    if (!modifier) {
      return res.status(404).json({ error: 'Modifier not found' });
    }

    if (!ensureOwnerAccessToRestaurant(req, res, modifier.dish.category.restaurantId)) {
      return;
    }

    const option = await prisma.modifierOption.create({
      data: {
        modifierId,
        name,
        price: parsedPrice
      }
    });

    res.status(201).json(option);
  } catch (error) {
    console.error('Error creating modifier option:', error);
    next(error);
  }
};

export const updateModifierOption = async (req, res, next) => {
  try {
    const { optionId } = req.params;
    const { name, price, restaurantId: selectedRestaurantId } = req.body;

    await ensureModifierManagementAllowed(selectedRestaurantId || req.query.restaurantId);

    // Validate price if provided
    let parsedPrice = undefined;
    if (price !== undefined && price !== null) {
      parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ error: 'Option price must be a number greater than or equal to 0' });
      }
    }

    // Check if option exists and user has access
    const option = await prisma.modifierOption.findUnique({
      where: { id: optionId },
      include: {
        modifier: {
          include: {
            dish: {
              include: {
                category: true
              }
            }
          }
        }
      }
    });

    if (!option) {
      return res.status(404).json({ error: 'Option not found' });
    }

    if (!ensureOwnerAccessToRestaurant(req, res, option.modifier.dish.category.restaurantId)) {
      return;
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (parsedPrice !== undefined) updateData.price = parsedPrice;

    const updatedOption = await prisma.modifierOption.update({
      where: { id: optionId },
      data: updateData
    });

    res.json(updatedOption);
  } catch (error) {
    next(error);
  }
};

export const deleteModifierOption = async (req, res, next) => {
  try {
    const { optionId } = req.params;

    await ensureModifierManagementAllowed(req.query.restaurantId);

    // Check if option exists and user has access
    const option = await prisma.modifierOption.findUnique({
      where: { id: optionId },
      include: {
        modifier: {
          include: {
            dish: {
              include: {
                category: true
              }
            }
          }
        }
      }
    });

    if (!option) {
      return res.status(404).json({ error: 'Option not found' });
    }

    if (!ensureOwnerAccessToRestaurant(req, res, option.modifier.dish.category.restaurantId)) {
      return;
    }

    await prisma.modifierOption.delete({
      where: { id: optionId }
    });

    res.json({ message: 'Option deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ✅ Upload image for modifier option
export const uploadModifierOptionImage = async (req, res, next) => {
  try {
    const { optionId } = req.params;
    await ensureModifierManagementAllowed(req.query.restaurantId || req.body.restaurantId);
    console.log('📸 [Backend] Upload modifier option image request received');
    console.log('📸 [Backend] Option ID:', optionId);
    console.log('📸 [Backend] Request file:', req.file);
    console.log('📸 [Backend] User:', req.user?.id);

    if (!req.file) {
      console.error('❌ [Backend] No file uploaded in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('📸 [Backend] File details:', {
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    });

    // Check if option exists
    console.log('🔍 [Backend] Looking for modifier option...');
    const option = await prisma.modifierOption.findUnique({
      where: { id: optionId },
      include: {
        modifier: {
          include: {
            dish: {
              include: {
                category: {
                  include: {
                    restaurant: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!option) {
      console.error('❌ [Backend] Modifier option not found:', optionId);
      return res.status(404).json({ error: 'Modifier option not found' });
    }

    console.log('✅ [Backend] Modifier option found:', {
      optionId: option.id,
      optionName: option.name,
      modifierId: option.modifier.id,
      modifierName: option.modifier.name,
      dishId: option.modifier.dish.id,
      dishName: option.modifier.dish.name,
      restaurantId: option.modifier.dish.category.restaurant.id
    });

    // Check user access to restaurant
    const restaurantId = option.modifier.dish.category.restaurant.id;
    console.log('🔐 [Backend] Checking user access to restaurant:', restaurantId);
    console.log('🔐 [Backend] User data:', {
      userId: req.user.id,
      ownedRestaurants: req.user.restaurants?.map(r => r.id),
      staffRestaurants: req.user.restaurantStaff?.map(s => s.restaurantId)
    });

    if (!ensureOwnerAccessToRestaurant(req, res, restaurantId)) {
      console.error('❌ [Backend] User does not have owner access to this restaurant');
      console.error('❌ [Backend] Required restaurant:', restaurantId);
      return;
    }

    console.log('✅ [Backend] User has access: as owner');

    // Get image URL
    const imageUrl = req.file.path && req.file.path.startsWith('http')
      ? req.file.path
      : `/uploads/${req.file.filename}`;

    console.log('📸 [Backend] Generated image URL:', imageUrl);

    // Update option with image
    console.log('💾 [Backend] Updating modifier option with image...');
    const updatedOption = await prisma.modifierOption.update({
      where: { id: optionId },
      data: { image: imageUrl }
    });

    console.log('✅ [Backend] Modifier option updated successfully:', updatedOption);

    res.json({
      message: 'Modifier option image uploaded successfully',
      imageUrl,
      option: updatedOption
    });
  } catch (error) {
    console.error('❌ [Backend] Error uploading modifier option image:', error);
    console.error('❌ [Backend] Error stack:', error.stack);
    next(error);
  }
};

// ✅ Delete image for modifier option
export const deleteModifierOptionImage = async (req, res, next) => {
  try {
    const { optionId } = req.params;

    await ensureModifierManagementAllowed(req.query.restaurantId);

    const option = await prisma.modifierOption.findUnique({
      where: { id: optionId },
      include: {
        modifier: {
          include: {
            dish: {
              include: {
                category: true
              }
            }
          }
        }
      }
    });

    if (!option) {
      return res.status(404).json({ error: 'Modifier option not found' });
    }

    if (!ensureOwnerAccessToRestaurant(req, res, option.modifier.dish.category.restaurantId)) {
      return;
    }

    const updatedOption = await prisma.modifierOption.update({
      where: { id: optionId },
      data: { image: null }
    });

    res.json({
      message: 'Modifier option image deleted successfully',
      option: updatedOption
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// Dish Recommendations
// ========================================

/**
 * Get recommendations for a specific dish
 * Uses hybrid approach:
 * 1. Statistics-based (from order history)
 * 2. Manual recommendations (set by restaurant owner)
 * 3. Category-based fallback (similar dishes)
 */
export const getDishRecommendations = async (req, res, next) => {
  try {
    const { dishId } = req.params;
    const limit = parseInt(req.query.limit) || 4;

    console.log(`🔍 [Recommendations] Getting recommendations for dish: ${dishId}`);

    // Get the dish with safe field selection
    const dish = await prisma.dish.findUnique({
      where: { id: dishId },
      select: {
        id: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            restaurantId: true
          }
        }
      }
    });

    if (!dish) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    // Try to get manual recommendations if field exists
    let manualRecommendationIds = [];
    try {
      const dishWithRecommendations = await prisma.dish.findUnique({
        where: { id: dishId },
        select: { recommendationIds: true }
      });
      manualRecommendationIds = dishWithRecommendations?.recommendationIds || [];
    } catch (err) {
      console.log('⚠️ [Recommendations] recommendationIds field not available yet');
    }

    let recommendations = [];

    // PRIORITY 1: Statistics-based recommendations (dishes often ordered together)
    try {
      const coOrderedDishes = await prisma.$queryRaw`
        SELECT 
          d.id,
          d.name,
          d.description,
          d.price,
          d.image,
          d."categoryId",
          COUNT(*) as order_count
        FROM "Dish" d
        INNER JOIN "OrderItem" oi1 ON d.id = oi1."dishId"
        INNER JOIN "OrderItem" oi2 ON oi1."orderId" = oi2."orderId"
        WHERE oi2."dishId" = ${dishId}
          AND d.id != ${dishId}
          AND d.available = true
        GROUP BY d.id
        HAVING COUNT(*) >= 3
        ORDER BY order_count DESC
        LIMIT ${limit}
      `;

      if (coOrderedDishes && coOrderedDishes.length > 0) {
        recommendations = coOrderedDishes.map(d => ({
          ...d,
          imageUrl: d.image,
          recommendationType: 'statistics'
        }));
      }
    } catch (error) {
      console.log('Statistics-based recommendations failed:', error.message);
    }

    // PRIORITY 2: Manual recommendations (if not enough from statistics)
    if (recommendations.length < limit && manualRecommendationIds.length > 0) {
      const existingIds = recommendations.map(r => r.id);
      const filteredManualIds = manualRecommendationIds.filter(id => !existingIds.includes(id));

      if (filteredManualIds.length > 0) {
        const manualRecommendations = await prisma.dish.findMany({
          where: {
            id: { in: filteredManualIds },
            available: true
          },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            image: true,
            categoryId: true
          },
          take: limit - recommendations.length
        });

        recommendations = [
          ...recommendations,
          ...manualRecommendations.map(d => ({
            ...d,
            imageUrl: d.image,
            recommendationType: 'manual'
          }))
        ];
      }
    }

    // PRIORITY 3: Category-based fallback (similar dishes from same category)
    if (recommendations.length < limit) {
      const categoryDishes = await prisma.dish.findMany({
        where: {
          categoryId: dish.categoryId,
          available: true,
          id: {
            notIn: [dishId, ...recommendations.map(r => r.id)]
          }
        },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          image: true,
          categoryId: true
        },
        take: limit - recommendations.length,
        orderBy: [
          { order: 'asc' },
          { createdAt: 'desc' }
        ]
      });

      recommendations = [
        ...recommendations,
        ...categoryDishes.map(d => ({
          ...d,
          imageUrl: d.image,
          recommendationType: 'category'
        }))
      ];
    }

    // PRIORITY 4: Popular dishes from restaurant (if still not enough)
    if (recommendations.length < limit) {
      const popularDishes = await prisma.dish.findMany({
        where: {
          category: {
            restaurantId: dish.category.restaurantId
          },
          available: true,
          id: {
            notIn: [dishId, ...recommendations.map(r => r.id)]
          }
        },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          image: true,
          categoryId: true
        },
        take: limit - recommendations.length,
        orderBy: [
          { order: 'asc' },
          { createdAt: 'desc' }
        ]
      });

      recommendations = [
        ...recommendations,
        ...popularDishes.map(d => ({
          ...d,
          imageUrl: d.image,
          recommendationType: 'popular'
        }))
      ];
    }

    res.json({
      dishId,
      recommendations: recommendations.slice(0, limit)
    });
  } catch (error) {
    console.error('Error getting dish recommendations:', error);
    next(error);
  }
};
