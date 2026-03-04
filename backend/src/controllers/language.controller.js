import { prisma } from '../config/prisma.js';
import { ensureRestaurantAccess, ensureRestaurantOwnerAccess } from '../utils/restaurantAccess.js';

const AVAILABLE_LANGUAGES = [
  { code: 'ru', name: 'Русский' },
  { code: 'en', name: 'English' },
  { code: 'kg', name: 'Kyrgyz' },
  { code: 'tr', name: 'Türkçe' }
];

const getLanguageManagementContext = async (restaurantId) => {
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

  const managementRestaurantId = restaurant.sharedMenuSourceRestaurantId || restaurant.id;

  return {
    selectedRestaurantId: restaurant.id,
    managementRestaurantId,
    isInherited: Boolean(restaurant.sharedMenuSourceRestaurantId)
  };
};

export const getAvailableLanguages = async (req, res, next) => {
  try {
    res.json(AVAILABLE_LANGUAGES);
  } catch (error) {
    next(error);
  }
};

export const getRestaurantLanguages = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;

    if (!ensureRestaurantAccess(req, res, restaurantId)) {
      return;
    }

    const context = await getLanguageManagementContext(restaurantId);

    if (!context) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: context.managementRestaurantId },
      select: { defaultLanguage: true }
    });

    const languages = await prisma.restaurantLanguage.findMany({
      where: { restaurantId: context.managementRestaurantId },
      orderBy: { order: 'asc' }
    });

    res.json({
      languages,
      defaultLanguage: restaurant.defaultLanguage,
      isInherited: context.isInherited,
      managementRestaurantId: context.managementRestaurantId
    });
  } catch (error) {
    next(error);
  }
};

export const updateRestaurantLanguages = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const { languages, defaultLanguage } = req.body;

    if (!ensureRestaurantOwnerAccess(req, res, restaurantId)) {
      return;
    }

    const context = await getLanguageManagementContext(restaurantId);

    if (!context) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    if (context.isInherited) {
      return res.status(403).json({
        error: 'Shared template locked',
        message: 'Языки для филиала наследуются от главного ресторана. Измените их в главном ресторане.'
      });
    }

    if (!Array.isArray(languages)) {
      return res.status(400).json({ error: 'Languages must be an array' });
    }

    // Update default language if provided
    if (defaultLanguage) {
      await prisma.restaurant.update({
        where: { id: context.managementRestaurantId },
        data: { defaultLanguage }
      });
    }

    await prisma.restaurantLanguage.deleteMany({
      where: { restaurantId: context.managementRestaurantId }
    });

    const createdLanguages = await Promise.all(
      languages.map((lang, index) =>
        prisma.restaurantLanguage.create({
          data: {
            restaurantId: context.managementRestaurantId,
            languageCode: lang.languageCode || lang.code,
            isEnabled: lang.isEnabled !== false,
            order: lang.order !== undefined ? lang.order : index
          }
        })
      )
    );

    res.json(createdLanguages);
  } catch (error) {
    next(error);
  }
};

export const getDishTranslations = async (req, res, next) => {
  try {
    const { restaurantId, dishId } = req.params;

    if (!ensureRestaurantAccess(req, res, restaurantId)) {
      return;
    }

    const context = await getLanguageManagementContext(restaurantId);

    if (!context) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const translations = await prisma.dishTranslation.findMany({
      where: {
        dishId,
        restaurantId: context.managementRestaurantId
      }
    });

    res.json(translations);
  } catch (error) {
    next(error);
  }
};

export const getAllDishTranslations = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;

    if (!ensureRestaurantAccess(req, res, restaurantId)) {
      return;
    }

    const context = await getLanguageManagementContext(restaurantId);

    if (!context) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const translations = await prisma.dishTranslation.findMany({
      where: { restaurantId: context.managementRestaurantId },
      include: { dish: { select: { id: true, name: true } } }
    });

    res.json(translations);
  } catch (error) {
    next(error);
  }
};

export const createDishTranslation = async (req, res, next) => {
  try {
    const { restaurantId, dishId } = req.params;
    const { languageCode, name, description } = req.body;

    if (!ensureRestaurantOwnerAccess(req, res, restaurantId)) {
      return;
    }

    const context = await getLanguageManagementContext(restaurantId);

    if (!context) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    if (context.isInherited) {
      return res.status(403).json({
        error: 'Shared template locked',
        message: 'Переводы для филиала наследуются от главного ресторана. Редактируйте их в главном ресторане.'
      });
    }

    if (!languageCode || !name) {
      return res.status(400).json({ error: 'Language code and name are required' });
    }

    const dish = await prisma.dish.findUnique({
      where: { id: dishId }
    });

    if (!dish || dish.restaurantId !== context.managementRestaurantId) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    const translation = await prisma.dishTranslation.upsert({
      where: {
        dishId_languageCode: {
          dishId,
          languageCode
        }
      },
      create: {
        dishId,
        restaurantId: context.managementRestaurantId,
        languageCode,
        name,
        description
      },
      update: {
        name,
        description
      }
    });

    res.json(translation);
  } catch (error) {
    next(error);
  }
};

export const updateDishTranslation = async (req, res, next) => {
  try {
    const { translationId } = req.params;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const translation = await prisma.dishTranslation.findUnique({
      where: { id: translationId }
    });

    if (!translation) {
      return res.status(404).json({ error: 'Translation not found' });
    }

    if (!ensureRestaurantOwnerAccess(req, res, translation.restaurantId)) {
      return;
    }

    const updatedTranslation = await prisma.dishTranslation.update({
      where: { id: translationId },
      data: {
        name,
        description
      }
    });

    res.json(updatedTranslation);
  } catch (error) {
    next(error);
  }
};

export const deleteDishTranslation = async (req, res, next) => {
  try {
    const { translationId } = req.params;

    const translation = await prisma.dishTranslation.findUnique({
      where: { id: translationId }
    });

    if (!translation) {
      return res.status(404).json({ error: 'Translation not found' });
    }

    if (!ensureRestaurantOwnerAccess(req, res, translation.restaurantId)) {
      return;
    }

    await prisma.dishTranslation.delete({
      where: { id: translationId }
    });

    res.json({ message: 'Translation deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Category translations
export const getCategoryTranslations = async (req, res, next) => {
  try {
    const { restaurantId, categoryId } = req.params;

    if (!ensureRestaurantAccess(req, res, restaurantId)) {
      return;
    }

    const context = await getLanguageManagementContext(restaurantId);

    if (!context) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const translations = await prisma.categoryTranslation.findMany({
      where: {
        categoryId,
        restaurantId: context.managementRestaurantId
      }
    });

    res.json(translations);
  } catch (error) {
    next(error);
  }
};

export const createCategoryTranslation = async (req, res, next) => {
  try {
    const { restaurantId, categoryId } = req.params;
    const { languageCode, name, description } = req.body;

    if (!ensureRestaurantOwnerAccess(req, res, restaurantId)) {
      return;
    }

    const context = await getLanguageManagementContext(restaurantId);

    if (!context) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    if (context.isInherited) {
      return res.status(403).json({
        error: 'Shared template locked',
        message: 'Переводы для филиала наследуются от главного ресторана. Редактируйте их в главном ресторане.'
      });
    }

    if (!languageCode || !name) {
      return res.status(400).json({ error: 'Language code and name are required' });
    }

    const category = await prisma.category.findUnique({
      where: { id: categoryId }
    });

    if (!category || category.restaurantId !== context.managementRestaurantId) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const translation = await prisma.categoryTranslation.upsert({
      where: {
        categoryId_languageCode: {
          categoryId,
          languageCode
        }
      },
      create: {
        categoryId,
        restaurantId: context.managementRestaurantId,
        languageCode,
        name,
        description
      },
      update: {
        name,
        description
      }
    });

    res.json(translation);
  } catch (error) {
    next(error);
  }
};

export const updateCategoryTranslation = async (req, res, next) => {
  try {
    const { translationId } = req.params;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const translation = await prisma.categoryTranslation.findUnique({
      where: { id: translationId }
    });

    if (!translation) {
      return res.status(404).json({ error: 'Translation not found' });
    }

    if (!ensureRestaurantOwnerAccess(req, res, translation.restaurantId)) {
      return;
    }

    const updatedTranslation = await prisma.categoryTranslation.update({
      where: { id: translationId },
      data: {
        name,
        description
      }
    });

    res.json(updatedTranslation);
  } catch (error) {
    next(error);
  }
};

export const deleteCategoryTranslation = async (req, res, next) => {
  try {
    const { translationId } = req.params;

    const translation = await prisma.categoryTranslation.findUnique({
      where: { id: translationId }
    });

    if (!translation) {
      return res.status(404).json({ error: 'Translation not found' });
    }

    if (!ensureRestaurantOwnerAccess(req, res, translation.restaurantId)) {
      return;
    }

    await prisma.categoryTranslation.delete({
      where: { id: translationId }
    });

    res.json({ message: 'Translation deleted successfully' });
  } catch (error) {
    next(error);
  }
};
