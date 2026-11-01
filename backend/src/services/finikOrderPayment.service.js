import { config } from '../config/env.js';
import {
  assertFinikConfigured,
  isFinikConfigured,
} from '../config/finik.js';
import { prisma } from '../config/prisma.js';
import telegramService from './telegram.service.js';
import {
  getBillingPaymentStatus,
  getMoneyMinorUnits,
  getOrderWebhookBindingMismatches,
  isFinikAvailableForRestaurant,
  isWithinFinikSettlementWindow,
  validateFinikTransactionDate,
} from '../utils/finikBilling.js';
import { requestFinikPaymentUrl } from './finikRequest.service.js';

const createHttpError = (status, message, code) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

const buildOrderPaymentBody = (payment, order) => ({
  Amount: payment.amountMinor / 100,
  CardType: 'FINIK_QR',
  PaymentId: payment.id,
  RedirectUrl: (() => {
    const url = new URL('/order-payment', `${config.frontendUrl.replace(/\/$/, '')}/`);
    url.searchParams.set('payment_id', payment.id);
    return url.toString();
  })(),
  Lang: 'ru',
  Data: {
    accountId: config.finik.accountId,
    name_en: config.finik.merchantName,
    webhookUrl: config.finik.webhookUrl,
    description: `Заказ ${order.orderNumber}`,
    startDate: payment.createdAt.getTime(),
    endDate: payment.expiresAt.getTime(),
    additionalData: [
      {
        fieldId: 'oimoqrOrderId',
        name: 'OimoQR order',
        isHidden: true,
        value: order.id,
      },
      {
        fieldId: 'oimoqrToken',
        name: 'OimoQR order payment token',
        isHidden: true,
        value: payment.verificationToken,
      },
    ],
  },
});

export const getFinikOrderPaymentAvailability = async (restaurantId) => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { country: true, currency: true },
  });
  if (!restaurant) throw createHttpError(404, 'Ресторан не найден', 'RESTAURANT_NOT_FOUND');

  const locationSupported = isFinikAvailableForRestaurant(restaurant);
  return {
    available: locationSupported && isFinikConfigured(),
    reason: !locationSupported
      ? 'FINIK_KYRGYZSTAN_KGS_ONLY'
      : (!isFinikConfigured() ? 'FINIK_NOT_CONFIGURED' : null),
  };
};

export const createFinikOrderPayment = async (orderId) => {
  assertFinikConfigured();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      restaurant: { select: { country: true, currency: true } },
    },
  });
  const assignedRestaurant = order?.assignedRestaurantId
    ? await prisma.restaurant.findUnique({
      where: { id: order.assignedRestaurantId },
      select: { country: true, currency: true },
    })
    : null;
  if (!order) throw createHttpError(404, 'Заказ не найден', 'ORDER_NOT_FOUND');
  if (
    !isFinikAvailableForRestaurant(order.restaurant)
    || (assignedRestaurant && !isFinikAvailableForRestaurant(assignedRestaurant))
  ) {
    throw createHttpError(
      400,
      'Finik доступен только для ресторанов в Кыргызстане с валютой KGS',
      'FINIK_KYRGYZSTAN_KGS_ONLY'
    );
  }
  if (order.paymentMethod !== 'finik' || order.status !== 'pending_payment') {
    throw createHttpError(409, 'Заказ не ожидает оплату через Finik', 'ORDER_PAYMENT_NOT_PENDING');
  }

  const amountMinor = getMoneyMinorUnits(order.totalAmount);
  if (amountMinor === null) {
    throw createHttpError(400, 'Сумма заказа не поддерживается для оплаты Finik', 'INVALID_ORDER_AMOUNT');
  }
  if (await prisma.orderFinikPayment.findUnique({ where: { orderId }, select: { id: true } })) {
    throw createHttpError(409, 'Для этого заказа уже создана ссылка на оплату', 'ORDER_PAYMENT_ALREADY_EXISTS');
  }

  const payment = await prisma.orderFinikPayment.create({
    data: {
      orderId,
      amountMinor,
      currency: 'KGS',
      status: 'CREATING',
      expiresAt: new Date(Date.now() + config.finik.paymentTtlMinutes * 60 * 1000),
    },
  });

  try {
    const url = await requestFinikPaymentUrl(buildOrderPaymentBody(payment, order));
    await prisma.orderFinikPayment.update({
      where: { id: payment.id },
      data: { status: 'PENDING', paymentUrl: url },
    });
    return { paymentId: payment.id, url, expiresAt: payment.expiresAt };
  } catch (error) {
    await prisma.$transaction([
      prisma.orderFinikPayment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          failureCode: error.code || 'FINIK_PAYMENT_CREATE_FAILED',
          failureMessage: String(error.message || 'Не удалось создать платёж').slice(0, 500),
        },
      }),
      prisma.order.updateMany({
        where: { id: orderId, status: 'pending_payment' },
        data: { status: 'cancelled' },
      }),
    ]);
    throw error;
  }
};

export const getFinikOrderPaymentStatus = async (paymentId) => {
  const payment = await prisma.orderFinikPayment.findUnique({
    where: { id: paymentId },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          deliveryType: true,
          paymentMethod: true,
          tableNumber: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              quantity: true,
              price: true,
              selectedModifiers: true,
              dish: { select: { id: true, name: true, image: true } },
            },
          },
          restaurant: {
            select: {
              id: true,
              name: true,
              subdomain: true,
              currency: true,
            },
          },
        },
      },
    },
  });
  if (!payment) throw createHttpError(404, 'Платёж не найден', 'PAYMENT_NOT_FOUND');

  const status = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`finik-order-payment:${payment.id}`}))`;
    const currentPayment = await tx.orderFinikPayment.findUnique({ where: { id: payment.id } });
    const currentStatus = getBillingPaymentStatus(
      currentPayment,
      new Date(),
      config.finik.settlementGraceMinutes
    );
    if (
      currentStatus === 'EXPIRED'
      && ['CREATING', 'PENDING'].includes(currentPayment?.status)
    ) {
      await tx.orderFinikPayment.update({
        where: { id: payment.id },
        data: {
          status: 'EXPIRED',
          failureCode: 'PAYMENT_LINK_EXPIRED',
          failureMessage: 'Ссылка истекла, подтверждение Finik не получено в течение 24 часов.',
        },
      });
      await tx.order.updateMany({
        where: { id: payment.orderId, status: 'pending_payment' },
        data: { status: 'cancelled' },
      });
    }
    return currentStatus;
  });
  return {
    payment: {
      id: payment.id,
      status,
      url: payment.expiresAt > new Date() ? payment.paymentUrl : null,
      expiresAt: payment.expiresAt,
      paidAt: payment.paidAt,
      failureCode: payment.failureCode,
    },
    order: status === 'PAID' ? payment.order : null,
    currency: payment.order.restaurant?.currency || 'KGS',
  };
};

const flagOrderPaymentForReview = async (payment, reason, payload) => {
  const updated = await prisma.orderFinikPayment.updateMany({
    where: { id: payment.id, status: { not: 'PAID' } },
    data: {
      status: 'REVIEW_REQUIRED',
      failureCode: reason,
      failureMessage: 'Платёж требует ручной проверки.',
      providerPayload: payload,
    },
  });
  if (updated.count === 0) {
    console.error('Signed Finik event conflicts with an already paid order:', {
      paymentId: payment.id,
      orderId: payment.orderId,
      reason,
    });
    return { reviewRequired: true, immutable: true };
  }
  console.error('Finik order payment requires manual review:', {
    paymentId: payment.id,
    orderId: payment.orderId,
    reason,
  });
  return { reviewRequired: true };
};

const notifyRestaurantAboutPaidOrder = async (orderId) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { dish: true } },
      restaurant: { include: { socialLinks: true } },
      customerAddress: true,
    },
  });
  if (!order) throw createHttpError(404, 'Оплаченный заказ не найден', 'ORDER_NOT_FOUND');

  let notificationRestaurant = order.restaurant;
  if (order.assignedRestaurantId) {
    const assignedRestaurant = await prisma.restaurant.findUnique({
      where: { id: order.assignedRestaurantId },
      include: { socialLinks: true },
    });
    if (assignedRestaurant) notificationRestaurant = assignedRestaurant;
  }
  if (notificationRestaurant?.telegramGroupId) {
    telegramService.sendNewOrderNotification(order, notificationRestaurant).catch((error) => {
      console.error('Failed to send Telegram notification for paid Finik order:', error.message);
    });
  }
};

export const processFinikOrderWebhook = async (payload, webhookEventId) => {
  const paymentId = payload?.fields?.paymentId;
  if (typeof paymentId !== 'string') return null;

  const payment = await prisma.orderFinikPayment.findUnique({
    where: { id: paymentId },
  });
  if (!payment) return null;

  const transactionId = typeof payload.transactionId === 'string' && payload.transactionId
    ? payload.transactionId
    : null;
  const operationId = typeof payload.id === 'string' && payload.id ? payload.id : null;
  if (!transactionId && !operationId) {
    return flagOrderPaymentForReview(payment, 'TRANSACTION_ID_MISSING', payload);
  }

  const mismatches = getOrderWebhookBindingMismatches(payload, payment, config.finik.accountId);
  if (mismatches.length) {
    return flagOrderPaymentForReview(payment, 'PAYMENT_CONTEXT_MISMATCH', payload);
  }

  const amountMinor = getMoneyMinorUnits(payload.amount);
  const fieldsAmountMinor = payload.fields?.amount === undefined
    ? amountMinor
    : getMoneyMinorUnits(payload.fields.amount);
  if (amountMinor !== payment.amountMinor || fieldsAmountMinor !== payment.amountMinor) {
    return flagOrderPaymentForReview(payment, 'PAYMENT_AMOUNT_MISMATCH', payload);
  }

  const transactionDate = validateFinikTransactionDate(payload.transactionDate, {
    paymentCreatedAt: payment.createdAt,
    paymentExpiresAt: payment.expiresAt,
    toleranceMs: config.finik.webhookToleranceSeconds * 1000,
  });
  if (!transactionDate.valid) {
    return flagOrderPaymentForReview(payment, transactionDate.reason, payload);
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`finik-order-payment:${payment.id}`}))`;
    const currentPayment = await tx.orderFinikPayment.findUnique({ where: { id: payment.id } });
    if (!currentPayment) return { reviewRequired: true, notify: false };

    if (currentPayment.status === 'PAID') {
      return {
        duplicate: currentPayment.providerTransactionId === transactionId
          && currentPayment.providerOperationId === operationId,
        reviewRequired: currentPayment.providerTransactionId !== transactionId
          || currentPayment.providerOperationId !== operationId,
        notify: false,
      };
    }

    const [transactionConflict, operationConflict, anotherPaidAttempt] = await Promise.all([
      transactionId
        ? tx.orderFinikPayment.findFirst({
          where: { providerTransactionId: transactionId, id: { not: payment.id } },
          select: { id: true },
        })
        : null,
      operationId
        ? tx.orderFinikPayment.findFirst({
          where: { providerOperationId: operationId, id: { not: payment.id } },
          select: { id: true },
        })
        : null,
      tx.orderFinikPayment.findFirst({
        where: { orderId: payment.orderId, status: 'PAID', id: { not: payment.id } },
        select: { id: true },
      }),
    ]);
    if (transactionConflict || operationConflict || anotherPaidAttempt) {
      await tx.orderFinikPayment.update({
        where: { id: payment.id },
        data: {
          status: 'REVIEW_REQUIRED',
          failureCode: 'FINIK_TRANSACTION_CONFLICT',
          failureMessage: 'Платёж требует ручной проверки.',
          providerPayload: payload,
        },
      });
      return { reviewRequired: true, notify: false };
    }

    if (!isWithinFinikSettlementWindow(
      currentPayment.expiresAt,
      new Date(),
      config.finik.settlementGraceMinutes
    )) {
      await tx.orderFinikPayment.update({
        where: { id: payment.id },
        data: {
          status: 'REVIEW_REQUIRED',
          providerTransactionId: transactionId,
          providerOperationId: operationId,
          providerPayload: { ...payload, webhookEventId },
          paidAt: transactionDate.date,
          failureCode: 'LATE_WEBHOOK_AFTER_SETTLEMENT_WINDOW',
          failureMessage: 'Платёж получен после срока автоматической сверки.',
        },
      });
      await tx.order.updateMany({
        where: { id: payment.orderId, status: 'pending_payment' },
        data: { status: 'cancelled' },
      });
      return { reviewRequired: true, notify: false };
    }

    await tx.orderFinikPayment.update({
      where: { id: payment.id },
      data: {
        status: 'PAID',
        providerTransactionId: transactionId,
        providerOperationId: operationId,
        providerPayload: { ...payload, webhookEventId },
        paidAt: transactionDate.date,
        appliedAt: new Date(),
        failureCode: null,
        failureMessage: null,
      },
    });
    await tx.order.update({
      where: { id: payment.orderId },
      data: { status: 'new' },
    });
    return { duplicate: false, reviewRequired: false, notify: true };
  }, { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 30000 });

  if (result.notify) await notifyRestaurantAboutPaidOrder(payment.orderId);
  if (result.reviewRequired) {
    console.error('Finik order payment requires manual review:', {
      paymentId: payment.id,
      orderId: payment.orderId,
      reason: 'FINIK_TRANSACTION_CONFLICT',
    });
  }
  return result;
};
