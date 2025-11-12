import { prisma } from '../config/prisma.js';

export const getDishes = async (req, res, next) => {
  try {
    const { categoryId } = req.params;

    const dishes = await prisma.dish.findMany({
      where: { categoryId },
      orderBy: { order: 'asc' },
      include: {
        modifiers: true
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

    const dishData = {
      name,
      description,
      price: parsedPrice,
      categoryId,
      restaurantId: category.restaurantId,
      order: order || 0,
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

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('📸 Uploading image:', { filename: req.file.filename, path: req.file.path, destination: req.file.destination });

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

    // Get image URL (Cloudinary returns full URL, local storage returns filename)
    const imageUrl = req.file.path && req.file.path.startsWith('http') 
      ? req.file.path 
      : `/uploads/${req.file.filename}`;
    console.log('📸 Image URL:', imageUrl);

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
        modifiers: true
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

    const modifier = await prisma.modifier.create({
      data: {
        name,
        type,
        price: parsedPrice, // Corrected from 'price' to 'parsedPrice'
        isRequired: isRequired || false,
        dishId
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
    const { modifierId: id } = req.params;

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
