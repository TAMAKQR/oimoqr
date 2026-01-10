import express from 'express';
import {
    registerCustomer,
    loginCustomer,
    getCurrentCustomer
} from '../controllers/customerAuth.controller.js';
import {
    getProfile,
    updateProfile,
    changePassword,
    getOrderHistory,
    addToFavorites,
    removeFromFavorites,
    getFavorites,
    addAddress,
    updateAddress,
    deleteAddress,
    getAddresses,
    createCustomerOrder,
    getMyRestaurants
} from '../controllers/customer.controller.js';
import { authenticateCustomer } from '../middleware/customerAuth.js';

const router = express.Router();

// ============================================
// Публичные роуты (без авторизации)
// ============================================

// Регистрация
router.post('/register', registerCustomer);

// Вход
router.post('/login', loginCustomer);

// ============================================
// Защищенные роуты (требуют авторизации)
// ============================================

// Получить текущего клиента
router.get('/me', authenticateCustomer, getCurrentCustomer);

// Профиль
router.get('/profile', authenticateCustomer, getProfile);
router.put('/profile', authenticateCustomer, updateProfile);
router.post('/change-password', authenticateCustomer, changePassword);

// История заказов
router.get('/orders', authenticateCustomer, getOrderHistory);

// Создание заказа
router.post('/orders', authenticateCustomer, createCustomerOrder);

// Рестораны клиента
router.get('/restaurants', authenticateCustomer, getMyRestaurants);

// Избранное
router.get('/favorites', authenticateCustomer, getFavorites);
router.post('/favorites', authenticateCustomer, addToFavorites);
router.delete('/favorites/:dishId', authenticateCustomer, removeFromFavorites);

// Адреса
router.get('/addresses', authenticateCustomer, getAddresses);
router.post('/addresses', authenticateCustomer, addAddress);
router.put('/addresses/:addressId', authenticateCustomer, updateAddress);
router.delete('/addresses/:addressId', authenticateCustomer, deleteAddress);

export default router;
