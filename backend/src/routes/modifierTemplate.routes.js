import express from 'express';
import {
  getModifierTemplates,
  createModifierTemplate,
  updateModifierTemplate,
  deleteModifierTemplate,
  applyTemplateToDish,
  syncModifiersWithTemplate
} from '../controllers/modifierTemplate.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Все роуты требуют аутентификации
router.use(authenticate);

// Получить все шаблоны модификаторов ресторана
router.get('/restaurant/:restaurantId/templates', getModifierTemplates);

// Создать шаблон модификатора
router.post('/templates', createModifierTemplate);

// Обновить шаблон модификатора
router.put('/templates/:id', updateModifierTemplate);

// Удалить шаблон модификатора
router.delete('/templates/:id', deleteModifierTemplate);

// Применить шаблон к блюду
router.post('/templates/apply', applyTemplateToDish);

// Синхронизировать все модификаторы с шаблоном
router.post('/templates/:id/sync', syncModifiersWithTemplate);

export default router;
