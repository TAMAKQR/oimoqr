import { prisma } from '../config/prisma.js';
import { isFinikAvailableForRestaurant } from '../utils/finikBilling.js';
import {
  completeFinikMerchantConnection,
  disconnectFinikMerchantConnection,
  FINIK_CONNECTION_INSTRUCTIONS_URL,
  serializeFinikMerchantConnection,
  startFinikMerchantConnection,
  testFinikMerchantConnection,
} from '../services/finikMerchantConnection.service.js';

const getOwnedRestaurant = async (restaurantId, userId) => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true, ownerId: true, country: true, currency: true },
  });
  if (!restaurant) {
    const error = new Error('Ресторан не найден');
    error.status = 404;
    error.code = 'RESTAURANT_NOT_FOUND';
    throw error;
  }
  if (restaurant.ownerId !== userId) {
    const error = new Error('Подключать Finik может только владелец ресторана');
    error.status = 403;
    error.code = 'RESTAURANT_OWNER_REQUIRED';
    throw error;
  }
  return restaurant;
};

const assertEligible = (restaurant) => {
  if (isFinikAvailableForRestaurant(restaurant)) return;
  const error = new Error('Finik доступен для ресторанов в Кыргызстане с валютой KGS');
  error.status = 400;
  error.code = 'FINIK_KYRGYZSTAN_KGS_ONLY';
  throw error;
};

const sendConnection = (res, connection, extra = {}) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ connection, ...extra });
};

export const getFinikConnectionStatus = async (req, res, next) => {
  try {
    const restaurant = await getOwnedRestaurant(req.params.restaurantId, req.user.id);
    const connection = await prisma.finikMerchantConnection.findUnique({
      where: { ownerId: restaurant.ownerId },
    });
    const includePublicKey = connection && ['DRAFT', 'VERIFYING', 'ERROR'].includes(connection.status);
    return sendConnection(
      res,
      serializeFinikMerchantConnection(connection, { includePublicKey }),
      {
        eligible: isFinikAvailableForRestaurant(restaurant),
        instructionsUrl: FINIK_CONNECTION_INSTRUCTIONS_URL,
      }
    );
  } catch (error) {
    return next(error);
  }
};

export const startFinikConnection = async (req, res, next) => {
  try {
    const restaurant = await getOwnedRestaurant(req.params.restaurantId, req.user.id);
    assertEligible(restaurant);
    const result = await startFinikMerchantConnection(restaurant.ownerId);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({ ...result, eligible: true });
  } catch (error) {
    return next(error);
  }
};

export const completeFinikConnection = async (req, res, next) => {
  try {
    const restaurant = await getOwnedRestaurant(req.params.restaurantId, req.user.id);
    assertEligible(restaurant);
    const connection = await completeFinikMerchantConnection(restaurant.ownerId, {
      accountId: req.body?.accountId,
      apiKey: req.body?.apiKey,
      merchantName: req.body?.merchantName || restaurant.name,
    });
    return sendConnection(res, connection, { eligible: true });
  } catch (error) {
    return next(error);
  }
};

export const testFinikConnection = async (req, res, next) => {
  try {
    const restaurant = await getOwnedRestaurant(req.params.restaurantId, req.user.id);
    assertEligible(restaurant);
    const connection = await testFinikMerchantConnection(restaurant.ownerId);
    return sendConnection(res, connection, { eligible: true });
  } catch (error) {
    return next(error);
  }
};

export const disconnectFinikConnection = async (req, res, next) => {
  try {
    const restaurant = await getOwnedRestaurant(req.params.restaurantId, req.user.id);
    const disconnected = await disconnectFinikMerchantConnection(restaurant.ownerId);
    return sendConnection(
      res,
      serializeFinikMerchantConnection(disconnected),
      { eligible: isFinikAvailableForRestaurant(restaurant) }
    );
  } catch (error) {
    return next(error);
  }
};
