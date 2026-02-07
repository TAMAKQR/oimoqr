import { prisma } from '../config/prisma.js';

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

    const dishes = await prisma.dish.findMany({
      where: {
        category: {
          restaurantId
        }
      },
      orderBy: { name: 'asc' },
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    res.json(dishes);
  } catch (error) {
    next(error);
  }
};

export const createDish = async (req, res, next) => {
  try {
    const { name, description, price, categoryId, order, allergens, discount, badge } = req.body;
    console.log('Creating dish:', { name, categoryId, price });

    // Validate price
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ error: 'Price must be a number greater than or equal to 0' });
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
    const { name, description, price, order, isActive, allergens, discount, badge } = req.body;

    console.log('📝 Updating dish:', { id, name, price, allergens, discount, badge });

    // Validate price if provided
    let parsedPrice = undefined;
    if (price !== undefined && price !== null) {
      parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ error: 'Price must be a number greater than or equal to 0' });
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

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (parsedPrice !== undefined) updateData.price = parsedPrice;
    if (order !== undefined) updateData.order = order;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (allergens !== undefined) updateData.allergens = allergens;
    if (parsedDiscount !== undefined) updateData.discount = parsedDiscount;
    if (badge !== undefined) updateData.badge = badge;

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

    // Check if user owns this restaurant or is staff member
    const isOwner = req.user.restaurants?.some(r => r.id === restaurantId);
    const isStaff = req.user.restaurantStaff?.some(s => s.restaurantId === restaurantId);

    if (!isOwner && !isStaff) {
      console.error('❌ [Backend] User does not have access to this restaurant');
      console.error('❌ [Backend] Required restaurant:', restaurantId);
      return res.status(403).json({ error: 'Access denied to this restaurant' });
    }

    console.log('✅ [Backend] User has access:', isOwner ? 'as owner' : 'as staff');

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
    const { name, price = 0, isRequired, type = "default" } = req.body;

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
    const { name, price, isRequired } = req.body;

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
    const { name, price = 0 } = req.body;

    // Validate price
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ error: 'Option price must be a number greater than or equal to 0' });
    }

    // Check if modifier exists and user has access
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
    const { name, price } = req.body;

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

    // Check if user owns this restaurant or is staff member
    const isOwner = req.user.restaurants?.some(r => r.id === restaurantId);
    const isStaff = req.user.restaurantStaff?.some(s => s.restaurantId === restaurantId);

    if (!isOwner && !isStaff) {
      console.error('❌ [Backend] User does not have access to this restaurant');
      console.error('❌ [Backend] Required restaurant:', restaurantId);
      return res.status(403).json({ error: 'Access denied to this restaurant' });
    }

    console.log('✅ [Backend] User has access:', isOwner ? 'as owner' : 'as staff');

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

    const option = await prisma.modifierOption.findUnique({
      where: { id: optionId }
    });

    if (!option) {
      return res.status(404).json({ error: 'Modifier option not found' });
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
