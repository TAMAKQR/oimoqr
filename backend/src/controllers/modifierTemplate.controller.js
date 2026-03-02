import { prisma } from '../config/prisma.js';

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

const getModifierManagementContext = async (restaurantId) => {
  if (!restaurantId) return null;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      id: true,
      sharedMenuSourceRestaurantId: true
    }
  });

  if (!restaurant) {
    return null;
  }

  return {
    selectedRestaurantId: restaurant.id,
    managementRestaurantId: restaurant.sharedMenuSourceRestaurantId || restaurant.id,
    isInherited: Boolean(restaurant.sharedMenuSourceRestaurantId)
  };
};

// Получить все шаблоны модификаторов ресторана
export const getModifierTemplates = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;

    const context = await getModifierManagementContext(restaurantId);

    if (!context) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const templates = await prisma.modifierTemplate.findMany({
      where: { restaurantId: context.managementRestaurantId },
      include: {
        options: true,
        _count: {
          select: { usedInModifiers: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      templates,
      isInherited: context.isInherited,
      managementRestaurantId: context.managementRestaurantId
    });
  } catch (error) {
    next(error);
  }
};

// Создать шаблон модификатора
export const createModifierTemplate = async (req, res, next) => {
  try {
    const { name, type, isRequired, options, restaurantId } = req.body;

    const context = await getModifierManagementContext(restaurantId);

    if (!context) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    if (context.isInherited) {
      return res.status(403).json({
        error: 'Shared template locked',
        message: 'Модификаторы филиала наследуются от главного ресторана. Создавайте шаблоны в главном ресторане.'
      });
    }

    if (!ensureOwnerAccessToRestaurant(req, res, context.managementRestaurantId)) {
      return;
    }

    console.log('📝 Creating modifier template:', { name, type, isRequired, optionsCount: options?.length });

    const template = await prisma.modifierTemplate.create({
      data: {
        name,
        type,
        isRequired: isRequired || false,
        restaurantId: context.managementRestaurantId,
        options: {
          create: options || []
        }
      },
      include: {
        options: true
      }
    });

    console.log('✅ Modifier template created:', template.id);
    res.status(201).json(template);
  } catch (error) {
    console.error('❌ Error creating modifier template:', error);
    next(error);
  }
};

// Обновить шаблон модификатора
export const updateModifierTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, type, isRequired, options, restaurantId } = req.body;

    const templateToUpdate = await prisma.modifierTemplate.findUnique({
      where: { id },
      select: { id: true, restaurantId: true }
    });

    if (!templateToUpdate) {
      return res.status(404).json({ error: 'Шаблон не найден' });
    }

    const contextRestaurantId = restaurantId || templateToUpdate.restaurantId;
    const context = await getModifierManagementContext(contextRestaurantId);

    if (!context) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    if (context.isInherited) {
      return res.status(403).json({
        error: 'Shared template locked',
        message: 'Модификаторы филиала наследуются от главного ресторана. Изменяйте шаблоны в главном ресторане.'
      });
    }

    if (!ensureOwnerAccessToRestaurant(req, res, context.managementRestaurantId)) {
      return;
    }

    console.log('📝 Updating modifier template:', id);

    // Обновляем основные данные шаблона
    const template = await prisma.modifierTemplate.update({
      where: { id },
      data: {
        name,
        type,
        isRequired
      }
    });

    // Если переданы options, обновляем их
    if (options) {
      // Удаляем старые опции
      await prisma.modifierTemplateOption.deleteMany({
        where: { templateId: id }
      });

      // Создаем новые опции
      await prisma.modifierTemplateOption.createMany({
        data: options.map(opt => ({
          ...opt,
          templateId: id
        }))
      });
    }

    // Получаем обновленный шаблон с опциями
    const updatedTemplate = await prisma.modifierTemplate.findUnique({
      where: { id },
      include: {
        options: true
      }
    });

    console.log('✅ Modifier template updated:', id);
    res.json(updatedTemplate);
  } catch (error) {
    console.error('❌ Error updating modifier template:', error);
    next(error);
  }
};

// Удалить шаблон модификатора
export const deleteModifierTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { restaurantId } = req.query;

    const template = await prisma.modifierTemplate.findUnique({
      where: { id },
      select: { id: true, restaurantId: true }
    });

    if (!template) {
      return res.status(404).json({ error: 'Шаблон не найден' });
    }

    const contextRestaurantId = restaurantId || template.restaurantId;
    const context = await getModifierManagementContext(contextRestaurantId);

    if (!context) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    if (context.isInherited) {
      return res.status(403).json({
        error: 'Shared template locked',
        message: 'Модификаторы филиала наследуются от главного ресторана. Удаляйте шаблоны в главном ресторане.'
      });
    }

    if (!ensureOwnerAccessToRestaurant(req, res, context.managementRestaurantId)) {
      return;
    }

    console.log('🗑️ Deleting modifier template:', id);

    // Проверяем, используется ли шаблон
    const usageCount = await prisma.modifier.count({
      where: { templateId: id }
    });

    if (usageCount > 0) {
      return res.status(400).json({
        error: `Этот шаблон используется в ${usageCount} блюдах. Отвяжите его перед удалением.`
      });
    }

    await prisma.modifierTemplate.delete({
      where: { id }
    });

    console.log('✅ Modifier template deleted:', id);
    res.json({ message: 'Шаблон удален успешно' });
  } catch (error) {
    console.error('❌ Error deleting modifier template:', error);
    next(error);
  }
};

// Применить шаблон к блюду
export const applyTemplateToDish = async (req, res, next) => {
  try {
    const { templateId, dishId, restaurantId } = req.body;

    const context = await getModifierManagementContext(restaurantId);

    if (!context) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    if (context.isInherited) {
      return res.status(403).json({
        error: 'Shared template locked',
        message: 'Модификаторы филиала наследуются от главного ресторана. Применяйте шаблоны в главном ресторане.'
      });
    }

    if (!ensureOwnerAccessToRestaurant(req, res, context.managementRestaurantId)) {
      return;
    }

    console.log('🔧 Applying template to dish:', { templateId, dishId });

    // Получаем шаблон с опциями
    const template = await prisma.modifierTemplate.findUnique({
      where: { id: templateId },
      include: { options: true }
    });

    if (!template) {
      return res.status(404).json({ error: 'Шаблон не найден' });
    }

    // Создаем модификатор из шаблона
    const modifier = await prisma.modifier.create({
      data: {
        name: template.name,
        type: template.type,
        isRequired: template.isRequired,
        dishId,
        templateId,
        order: 0,
        options: {
          create: template.options.map(opt => ({
            name: opt.name,
            price: opt.price,
            image: opt.image
          }))
        }
      },
      include: {
        options: true
      }
    });

    console.log('✅ Template applied to dish:', modifier.id);
    res.status(201).json(modifier);
  } catch (error) {
    console.error('❌ Error applying template to dish:', error);
    next(error);
  }
};

// Синхронизировать все модификаторы с шаблоном
export const syncModifiersWithTemplate = async (req, res, next) => {
  try {
    const { id } = req.params; // templateId
    const { restaurantId } = req.body;

    const template = await prisma.modifierTemplate.findUnique({
      where: { id },
      include: { options: true }
    });

    if (!template) {
      return res.status(404).json({ error: 'Шаблон не найден' });
    }

    const contextRestaurantId = restaurantId || template.restaurantId;
    const context = await getModifierManagementContext(contextRestaurantId);

    if (!context) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    if (context.isInherited) {
      return res.status(403).json({
        error: 'Shared template locked',
        message: 'Модификаторы филиала наследуются от главного ресторана. Синхронизацию запускайте в главном ресторане.'
      });
    }

    if (!ensureOwnerAccessToRestaurant(req, res, context.managementRestaurantId)) {
      return;
    }

    console.log('🔄 Syncing modifiers with template:', id);

    // Находим все модификаторы, созданные из этого шаблона
    const modifiers = await prisma.modifier.findMany({
      where: { templateId: id }
    });

    console.log(`📊 Found ${modifiers.length} modifiers to sync`);

    // Обновляем каждый модификатор
    for (const modifier of modifiers) {
      // Обновляем основные данные
      await prisma.modifier.update({
        where: { id: modifier.id },
        data: {
          name: template.name,
          type: template.type,
          isRequired: template.isRequired
        }
      });

      // Удаляем старые опции
      await prisma.modifierOption.deleteMany({
        where: { modifierId: modifier.id }
      });

      // Создаем новые опции из шаблона
      await prisma.modifierOption.createMany({
        data: template.options.map(opt => ({
          name: opt.name,
          price: opt.price,
          image: opt.image,
          modifierId: modifier.id
        }))
      });
    }

    console.log(`✅ Synced ${modifiers.length} modifiers`);
    res.json({
      message: `Обновлено ${modifiers.length} модификаторов`,
      count: modifiers.length
    });
  } catch (error) {
    console.error('❌ Error syncing modifiers:', error);
    next(error);
  }
};
