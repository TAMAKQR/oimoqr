import { prisma } from '../config/prisma.js';

const AVAILABLE_LANGUAGES = [
  { code: 'ru', name: 'Русский' },
  { code: 'en', name: 'English' },
  { code: 'kg', name: 'Kyrgyz' },
  { code: 'tr', name: 'Türkçe' }
];

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

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { defaultLanguage: true }
    });

    const languages = await prisma.restaurantLanguage.findMany({
      where: { restaurantId },
      orderBy: { order: 'asc' }
    });

    res.json({
      languages,
      defaultLanguage: restaurant.defaultLanguage
    });
  } catch (error) {
    next(error);
  }
};

export const updateRestaurantLanguages = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const { languages, defaultLanguage } = req.body;

    if (!Array.isArray(languages)) {
      return res.status(400).json({ error: 'Languages must be an array' });
    }

    // Update default language if provided
    if (defaultLanguage) {
      await prisma.restaurant.update({
        where: { id: restaurantId },
        data: { defaultLanguage }
      });
    }

    await prisma.restaurantLanguage.deleteMany({
      where: { restaurantId }
    });

    const createdLanguages = await Promise.all(
      languages.map((lang, index) =>
        prisma.restaurantLanguage.create({
          data: {
            restaurantId,
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

    const translations = await prisma.dishTranslation.findMany({
      where: {
        dishId,
        restaurantId
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

    const translations = await prisma.dishTranslation.findMany({
      where: { restaurantId },
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

    if (!languageCode || !name) {
      return res.status(400).json({ error: 'Language code and name are required' });
    }

    const dish = await prisma.dish.findUnique({
      where: { id: dishId }
    });

    if (!dish || dish.restaurantId !== restaurantId) {
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
        restaurantId,
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

    const translations = await prisma.categoryTranslation.findMany({
      where: {
        categoryId,
        restaurantId
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

    if (!languageCode || !name) {
      return res.status(400).json({ error: 'Language code and name are required' });
    }

    const category = await prisma.category.findUnique({
      where: { id: categoryId }
    });

    if (!category || category.restaurantId !== restaurantId) {
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
        restaurantId,
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

    await prisma.categoryTranslation.delete({
      where: { id: translationId }
    });

    res.json({ message: 'Translation deleted successfully' });
  } catch (error) {
    next(error);
  }
};
