import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { updateTelegramSettings, testTelegramConnection } from '../controllers/telegram.controller.js';

const router = express.Router();

// Обновить настройки Telegram
router.put('/restaurants/:id/telegram', authenticate, updateTelegramSettings);

// Тестовое сообщение
router.post('/restaurants/:id/telegram/test', authenticate, testTelegramConnection);

export default router;
