import { createHash } from 'crypto';
import { config } from '../config/env.js';
import {
  assertFinikConfigured,
  getFinikBaseUrl,
  getFinikPrivateKey,
  getFinikPublicKey,
  getFinikWebhookHost,
  isFinikConfigured,
} from '../config/finik.js';
import { prisma } from '../config/prisma.js';
import {
  addBillingInterval,
  getMoneyMinorUnits,
  getWebhookBindingMismatches,
  isSupportedBillingInterval,
  isTierCompatibleWithRestaurants,
  validateFinikTransactionDate,
} from '../utils/finikBilling.js';
import { signFinikRequest, verifyFinikSignature } from '../utils/finikSignature.js';

const ACTIVE_PAYMENT_STATUSES = ['CREATING', 'PENDING'];
const SUCCESS_WEBHOOK_STATUSES = new Set(['success', 'succeeded']);
const BILLING_ISSUE_DECISIONS = new Set([
  'KEEP_CURRENT_STATE',
  'REJECT_UNAPPLIED_PAYMENT',
]);
const CREATING_STALE_AFTER_MS = 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const createHttpError = (status, message, code) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

const sanitizeTier = (tier) => {
  if (!tier) return null;
  const { externalPriceId: _externalPriceId, ...publicTier } = tier;
  return publicTier;
};

const normalizeCurrency = (value) => String(value || '').trim().toUpperCase();

export { addBillingInterval, getMoneyMinorUnits, isTierCompatibleWithRestaurants };

const getPaymentStatus = (payment, now = new Date()) => {
  if (!payment || !ACTIVE_PAYMENT_STATUSES.includes(payment.status) || payment.expiresAt > now) {
    return payment?.status;
  }
  const settlementEndsAt = new Date(
    payment.expiresAt.getTime() + config.finik.settlementGraceMinutes * 60 * 1000
  );
  return settlementEndsAt > now ? payment.status : 'EXPIRED';
};

const serializePayment = (payment, now = new Date()) => {
  if (!payment) return null;
  return {
    id: payment.id,
    provider: payment.provider,
    pricingTierId: payment.pricingTierId,
    pricingTier: sanitizeTier(payment.pricingTier),
    tierName: payment.tierName,
    billingInterval: payment.billingInterval,
    amount: payment.amountMinor / 100,
    currency: payment.currency,
    status: getPaymentStatus(payment, now),
    url: payment.paymentUrl,
    expiresAt: payment.expiresAt,
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
    failureCode: payment.failureCode,
    failureMessage: payment.failureMessage,
  };
};

const serializeBillingSubscription = (billing, now = new Date()) => {
  if (!billing) return null;
  const rawStatus = String(billing.status || 'PENDING').toUpperCase();
  const normalizedStatus = rawStatus === 'TRIALING'
    ? 'TRIAL'
    : (rawStatus === 'CANCELED' ? 'CANCELLED' : rawStatus);
  const periodEnd = normalizedStatus === 'TRIAL'
    ? (billing.trialEndsAt || billing.currentPeriodEnd)
    : billing.currentPeriodEnd;
  const status = ['ACTIVE', 'TRIAL'].includes(normalizedStatus)
    && (!periodEnd || periodEnd <= now)
    ? 'EXPIRED'
    : normalizedStatus;

  return {
    provider: billing.provider || 'MANUAL',
    status,
    currentPeriodStart: billing.currentPeriodStart,
    currentPeriodEnd: billing.currentPeriodEnd,
    trialEndsAt: billing.trialEndsAt,
    pricingTierId: billing.pricingTierId,
    pricingTier: sanitizeTier(billing.pricingTier),
  };
};

const serializeLocalSubscription = (subscription, now = new Date()) => {
  if (!subscription) return null;
  const rawStatus = String(subscription.status || 'PENDING').toUpperCase();
  const normalizedStatus = rawStatus === 'TRIALING'
    ? 'TRIAL'
    : (rawStatus === 'CANCELED' ? 'CANCELLED' : rawStatus);
  const periodEnd = normalizedStatus === 'TRIAL'
    ? (subscription.trialEndsAt || subscription.currentPeriodEnd)
    : subscription.currentPeriodEnd;
  const status = ['ACTIVE', 'TRIAL'].includes(normalizedStatus)
    && (!periodEnd || periodEnd <= now)
    ? 'EXPIRED'
    : normalizedStatus;
  return {
    provider: subscription.source || 'MANUAL',
    status,
    plan: subscription.plan,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    trialEndsAt: subscription.trialEndsAt,
    pricingTierId: subscription.pricingTierId,
    pricingTier: sanitizeTier(subscription.pricingTier),
  };
};

const selectLocalSubscription = (subscriptions, now = new Date()) => {
  const priority = new Map([
    ['ACTIVE', 0],
    ['TRIAL', 1],
    ['PENDING', 2],
    ['EXPIRED', 3],
    ['CANCELLED', 4],
  ]);
  return [...(subscriptions || [])].sort((left, right) => {
    const leftStatus = serializeLocalSubscription(left, now)?.status;
    const rightStatus = serializeLocalSubscription(right, now)?.status;
    const byStatus = (priority.get(leftStatus) ?? 99) - (priority.get(rightStatus) ?? 99);
    if (byStatus !== 0) return byStatus;
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  })[0] || null;
};

const expireStalePayments = async (db, userId = null) => {
  const now = new Date();
  const settlementCutoff = new Date(
    now.getTime() - config.finik.settlementGraceMinutes * 60 * 1000
  );
  await db.billingPayment.updateMany({
    where: {
      ...(userId ? { userId } : {}),
      status: { in: ACTIVE_PAYMENT_STATUSES },
      // Keep the ledger attempt unsettled after the browser link expires so a
      // delayed, valid Finik webhook cannot race a destructive account change.
      expiresAt: { lte: settlementCutoff },
    },
    data: {
      status: 'EXPIRED',
      failureCode: 'PAYMENT_LINK_EXPIRED',
      failureMessage: 'Срок действия ссылки на оплату истёк.',
    },
  });
};

const validateTierForPayment = (tier, restaurants) => {
  if (!tier?.isActive) {
    throw createHttpError(404, 'Тариф не найден', 'PRICING_TIER_NOT_FOUND');
  }
  if (!tier.onlinePaymentEnabled) {
    throw createHttpError(400, 'Для этого тарифа онлайн-оплата отключена', 'TIER_NOT_PURCHASABLE');
  }
  if (normalizeCurrency(tier.currency) !== 'KGS') {
    throw createHttpError(400, 'Finik принимает оплату тарифа только в KGS', 'FINIK_KGS_REQUIRED');
  }
  if (!isSupportedBillingInterval(tier.billingInterval)) {
    throw createHttpError(400, 'Поддерживается оплата тарифа на месяц или год', 'INVALID_BILLING_INTERVAL');
  }
  if (getMoneyMinorUnits(tier.price) === null) {
    throw createHttpError(400, 'У тарифа указана некорректная сумма', 'INVALID_TIER_PRICE');
  }
  if (!isTierCompatibleWithRestaurants(tier, restaurants)) {
    throw createHttpError(400, 'Этот тариф не подходит для типа вашего бизнеса', 'INCOMPATIBLE_TIER');
  }
  if (tier.maxRestaurants !== null && restaurants.length > tier.maxRestaurants) {
    throw createHttpError(
      400,
      `Тариф поддерживает максимум ${tier.maxRestaurants} ресторан(а/ов)`,
      'RESTAURANT_LIMIT_EXCEEDED'
    );
  }
};

const assertNoConflictingActiveTier = (subscriptions, pricingTierId, now = new Date()) => {
  const conflicting = subscriptions.find((subscription) => (
    subscription.status === 'ACTIVE'
    && subscription.currentPeriodEnd
    && subscription.currentPeriodEnd > now
    && subscription.pricingTierId
    && subscription.pricingTierId !== pricingTierId
  ));
  if (conflicting) {
    throw createHttpError(
      409,
      'Смена действующего тарифа через Finik пока недоступна. Обратитесь в поддержку.',
      'ACTIVE_TIER_CHANGE_REQUIRES_SUPPORT'
    );
  }
};

export const withAccountBillingLock = async (userId, operation, timeout = 60000) => (
  prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`billing:${userId}`}))`;
    return operation(tx);
  }, {
    isolationLevel: 'ReadCommitted',
    maxWait: 5000,
    timeout,
  })
);

export const hasUnsettledBillingTransition = async (userId, db = prisma) => {
  await expireStalePayments(db, userId);
  const settlementCutoff = new Date(
    Date.now() - config.finik.settlementGraceMinutes * 60 * 1000
  );
  const [payment, issue] = await Promise.all([
    db.billingPayment.findFirst({
      where: {
        userId,
        status: { in: ACTIVE_PAYMENT_STATUSES },
        expiresAt: { gt: settlementCutoff },
      },
      select: { id: true },
    }),
    db.billingIssue.findFirst({
      where: { userId, status: 'OPEN' },
      select: { id: true },
    }),
  ]);
  return Boolean(payment || issue);
};

export const withBillingLifecycleLock = async (userId, operation) => (
  withAccountBillingLock(userId, async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw createHttpError(404, 'Пользователь не найден', 'USER_NOT_FOUND');
    if (await hasUnsettledBillingTransition(userId, tx)) {
      throw createHttpError(
        409,
        'Сначала завершите открытую оплату Finik или дождитесь её истечения.',
        'BILLING_TRANSITION_PENDING'
      );
    }
    return operation(tx);
  })
);

const buildReturnUrl = (paymentId) => {
  const url = new URL('/pricing', `${config.frontendUrl.replace(/\/$/, '')}/`);
  url.searchParams.set('payment', 'return');
  url.searchParams.set('payment_id', paymentId);
  return url.toString();
};

const buildFinikPaymentBody = (payment) => {
  const startsAt = payment.createdAt.getTime();
  return {
    Amount: payment.amountMinor / 100,
    CardType: 'FINIK_QR',
    PaymentId: payment.id,
    RedirectUrl: buildReturnUrl(payment.id),
    Lang: 'ru',
    Data: {
      accountId: config.finik.accountId,
      name_en: config.finik.merchantName,
      webhookUrl: config.finik.webhookUrl,
      description: `OimoQR — тариф ${payment.tierName}`,
      startDate: startsAt,
      endDate: payment.expiresAt.getTime(),
      additionalData: [
        {
          fieldId: 'oimoqrAccountId',
          name: 'OimoQR account',
          isHidden: true,
          value: payment.userId,
        },
        {
          fieldId: 'oimoqrTierId',
          name: 'OimoQR tariff',
          isHidden: true,
          value: payment.pricingTierId,
        },
        {
          fieldId: 'oimoqrToken',
          name: 'OimoQR payment token',
          isHidden: true,
          value: payment.verificationToken,
        },
      ],
    },
  };
};

const parseUpstreamError = async (response) => {
  const text = await response.text().catch(() => '');
  if (!text) return `HTTP ${response.status}`;
  try {
    const payload = JSON.parse(text);
    return String(payload.ErrorMessage || payload.error || payload.message || `HTTP ${response.status}`);
  } catch {
    return `HTTP ${response.status}`;
  }
};

const validatePaymentUrl = (value) => {
  let url;
  try {
    url = new URL(value, `${getFinikBaseUrl()}/`);
  } catch {
    throw createHttpError(502, 'Finik вернул некорректную ссылку на оплату', 'FINIK_INVALID_PAYMENT_URL');
  }
  const allowedHosts = config.finik.mode === 'beta'
    ? new Set(['beta.qr.finik.kg'])
    : new Set(['qr.finik.kg']);
  if (
    url.protocol !== 'https:'
    || url.username
    || url.password
    || !allowedHosts.has(url.hostname.toLowerCase())
  ) {
    throw createHttpError(502, 'Finik вернул небезопасную ссылку на оплату', 'FINIK_INVALID_PAYMENT_URL');
  }
  return url.toString();
};

const requestFinikPaymentUrl = async (payment) => {
  const baseUrl = getFinikBaseUrl();
  const path = '/v1/payment';
  const timestamp = Date.now().toString();
  const body = buildFinikPaymentBody(payment);
  const requestData = {
    httpMethod: 'POST',
    path,
    headers: {
      Host: new URL(baseUrl).host,
      'x-api-key': config.finik.apiKey,
      'x-api-timestamp': timestamp,
    },
    queryStringParameters: null,
    body,
  };
  const signature = signFinikRequest(requestData, getFinikPrivateKey());

  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.finik.apiKey,
        'x-api-timestamp': timestamp,
        signature,
      },
      body: JSON.stringify(body),
      redirect: 'manual',
      signal: AbortSignal.timeout(config.finik.requestTimeoutMs),
    });
  } catch (error) {
    console.error('Finik create-payment request failed:', error.message);
    throw createHttpError(502, 'Finik временно недоступен. Повторите попытку позже.', 'FINIK_API_ERROR');
  }

  const location = response.headers.get('location');
  if (response.status === 302 && location) {
    return validatePaymentUrl(location);
  }

  if (response.ok) {
    const payload = await response.json().catch(() => null);
    const paymentUrl = payload?.paymentUrl || payload?.url || payload?.redirectUrl || location;
    if (paymentUrl) return validatePaymentUrl(paymentUrl);
  }

  const upstreamMessage = await parseUpstreamError(response);
  console.error('Finik create-payment rejected:', { status: response.status, message: upstreamMessage });
  throw createHttpError(502, 'Finik не смог создать платёж. Повторите попытку позже.', 'FINIK_PAYMENT_CREATE_FAILED');
};

export const createBillingPayment = async (userId, pricingTierId) => {
  assertFinikConfigured();
  if (!pricingTierId || typeof pricingTierId !== 'string') {
    throw createHttpError(400, 'pricingTierId is required', 'PRICING_TIER_REQUIRED');
  }

  const prepared = await withAccountBillingLock(userId, async (tx) => {
    await expireStalePayments(tx, userId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pricing-tier:${pricingTierId}`}))`;
    const [user, pricingTier] = await Promise.all([
      tx.user.findUnique({
        where: { id: userId },
        include: {
          restaurants: { select: { id: true, businessType: true } },
          subscriptions: {
            select: { status: true, pricingTierId: true, currentPeriodEnd: true },
          },
          billingIssues: {
            where: { status: 'OPEN' },
            select: { id: true },
            take: 1,
          },
        },
      }),
      tx.pricingTier.findUnique({ where: { id: pricingTierId } }),
    ]);

    if (!user?.restaurants?.length) {
      throw createHttpError(403, 'Управлять подпиской может только владелец бизнеса', 'BILLING_OWNER_REQUIRED');
    }
    if (user.billingIssues.length) {
      throw createHttpError(
        409,
        'Предыдущая оплата требует проверки поддержкой.',
        'BILLING_REVIEW_REQUIRED'
      );
    }
    validateTierForPayment(pricingTier, user.restaurants);
    assertNoConflictingActiveTier(user.subscriptions, pricingTier.id);

    const settlementCutoff = new Date(
      Date.now() - config.finik.settlementGraceMinutes * 60 * 1000
    );
    const openPayment = await tx.billingPayment.findFirst({
      where: {
        userId,
        status: { in: ACTIVE_PAYMENT_STATUSES },
        expiresAt: { gt: settlementCutoff },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (openPayment) {
      if (openPayment.expiresAt <= new Date()) {
        throw createHttpError(
          409,
          'Предыдущая попытка ещё ожидает возможный webhook Finik. Проверьте статус позже.',
          'PAYMENT_SETTLEMENT_PENDING'
        );
      }
      if (openPayment.pricingTierId === pricingTier.id && openPayment.paymentUrl) {
        return { payment: openPayment, reused: true };
      }
      if (
        openPayment.status === 'CREATING'
        && Date.now() - openPayment.createdAt.getTime() > CREATING_STALE_AFTER_MS
      ) {
        await tx.billingPayment.update({
          where: { id: openPayment.id },
          data: {
            status: 'FAILED',
            failureCode: 'PAYMENT_CREATION_INTERRUPTED',
            failureMessage: 'Создание ссылки было прервано. Создана новая попытка.',
          },
        });
      } else if (openPayment.pricingTierId === pricingTier.id) {
        throw createHttpError(
          409,
          'Ссылка на оплату уже создаётся. Повторите через несколько секунд.',
          'PAYMENT_CREATION_IN_PROGRESS'
        );
      } else {
        throw createHttpError(
          409,
          'У вас уже есть незавершённая оплата другого тарифа.',
          'PAYMENT_ALREADY_PENDING'
        );
      }
    }

    const expiresAt = new Date(Date.now() + config.finik.paymentTtlMinutes * 60 * 1000);
    const payment = await tx.billingPayment.create({
      data: {
        provider: 'FINIK',
        userId,
        pricingTierId: pricingTier.id,
        tierName: pricingTier.name,
        billingInterval: pricingTier.billingInterval,
        amountMinor: getMoneyMinorUnits(pricingTier.price),
        currency: 'KGS',
        status: 'CREATING',
        expiresAt,
      },
    });
    return { payment, reused: false };
  });

  if (prepared.reused) {
    return {
      paymentId: prepared.payment.id,
      url: prepared.payment.paymentUrl,
      expiresAt: prepared.payment.expiresAt,
      reused: true,
    };
  }

  try {
    const url = await requestFinikPaymentUrl(prepared.payment);
    await prisma.billingPayment.updateMany({
      where: { id: prepared.payment.id, status: 'CREATING' },
      data: { status: 'PENDING', paymentUrl: url },
    });
    return {
      paymentId: prepared.payment.id,
      url,
      expiresAt: prepared.payment.expiresAt,
      reused: false,
    };
  } catch (error) {
    await prisma.billingPayment.updateMany({
      where: { id: prepared.payment.id, status: 'CREATING' },
      data: {
        status: 'FAILED',
        failureCode: error.code || 'FINIK_PAYMENT_CREATE_FAILED',
        failureMessage: String(error.message || 'Не удалось создать платёж').slice(0, 500),
      },
    }).catch((updateError) => {
      console.error('Unable to persist Finik payment failure:', updateError.message);
    });
    throw error;
  }
};

const createOrUpdateIssue = async (tx, payment, reason, details) => {
  const existing = await tx.billingIssue.findUnique({
    where: { providerReferenceId: payment.id },
    select: { status: true, details: true },
  });
  const previousEventId = existing?.details
    && typeof existing.details === 'object'
    && !Array.isArray(existing.details)
    ? existing.details.webhookEventId
    : null;

  // Do not reopen an operator-resolved issue for an exact duplicate delivery.
  // A different signed event for the same payment may still require review.
  if (
    existing
    && existing.status === 'RESOLVED'
    && details?.webhookEventId
    && previousEventId === details.webhookEventId
  ) {
    return existing;
  }

  return tx.billingIssue.upsert({
    where: { providerReferenceId: payment.id },
    update: {
      userId: payment.userId,
      provider: 'FINIK',
      reason,
      details,
      status: 'OPEN',
      resolvedAt: null,
    },
    create: {
      userId: payment.userId,
      provider: 'FINIK',
      providerReferenceId: payment.id,
      reason,
      details,
      status: 'OPEN',
    },
  });
};

const getWebhookEventId = (payload) => `finik:${createHash('sha256')
  .update(JSON.stringify(payload ?? null))
  .digest('hex')}`;

const recordVerifiedFinikWebhook = async (payload, metadata = {}) => {
  const eventId = getWebhookEventId(payload);
  const transactionDate = Number(payload?.transactionDate);
  const parsedProviderDate = new Date(transactionDate);
  const providerCreatedAt = Number.isFinite(transactionDate)
    && transactionDate > 0
    && !Number.isNaN(parsedProviderDate.getTime())
    ? parsedProviderDate
    : new Date();

  await prisma.billingWebhookEvent.upsert({
    where: { id: eventId },
    update: {},
    create: {
      id: eventId,
      provider: 'FINIK',
      type: String(payload?.status || 'UNKNOWN').slice(0, 100),
      paymentId: typeof payload?.fields?.paymentId === 'string'
        ? payload.fields.paymentId.slice(0, 200)
        : null,
      providerTransactionId: typeof payload?.transactionId === 'string'
        ? payload.transactionId.slice(0, 500)
        : null,
      providerOperationId: typeof payload?.id === 'string' ? payload.id.slice(0, 500) : null,
      signature: typeof metadata.signature === 'string' ? metadata.signature.slice(0, 2000) : null,
      apiTimestamp: typeof metadata.apiTimestamp === 'string'
        ? metadata.apiTimestamp.slice(0, 100)
        : null,
      payload: payload ?? undefined,
      providerCreatedAt,
    },
  });
  return eventId;
};

const acquirePaymentLocks = async (tx, {
  paymentId,
  userId,
  transactionId,
  operationId,
}) => {
  if (userId) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`billing:${userId}`}))`;
  }
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`finik-payment:${paymentId}`}))`;

  const providerLockKeys = [
    transactionId ? `finik-transaction:${transactionId}` : null,
    operationId ? `finik-operation:${operationId}` : null,
  ].filter(Boolean).sort();
  for (const lockKey of providerLockKeys) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
  }
};

const findProviderIdentityConflicts = async (tx, paymentId, transactionId, operationId) => {
  const [transactionConflict, operationConflict] = await Promise.all([
    transactionId
      ? tx.billingPayment.findFirst({
        where: { providerTransactionId: transactionId, id: { not: paymentId } },
        select: { id: true },
      })
      : null,
    operationId
      ? tx.billingPayment.findFirst({
        where: { providerOperationId: operationId, id: { not: paymentId } },
        select: { id: true },
      })
      : null,
  ]);
  return [
    ...(transactionConflict ? [{ field: 'transactionId', paymentId: transactionConflict.id }] : []),
    ...(operationConflict ? [{ field: 'operationId', paymentId: operationConflict.id }] : []),
  ];
};

const persistPaymentReview = async (tx, payment, {
  reason,
  details,
  payload,
  transactionId,
  operationId,
  paidAt = null,
}) => {
  const identityConflicts = await findProviderIdentityConflicts(
    tx,
    payment.id,
    transactionId,
    operationId
  );
  const effectiveReason = identityConflicts.length ? 'FINIK_TRANSACTION_CONFLICT' : reason;
  const effectiveDetails = identityConflicts.length
    ? { ...details, identityConflicts }
    : details;

  const operatorRejected = payment.status === 'FAILED'
    && payment.failureCode === 'ADMIN_REJECTED';
  // A confirmed ledger entry and an explicitly rejected review are immutable.
  // Later signed anomalies remain auditable without silently changing either.
  if (payment.status !== 'PAID' && !operatorRejected) {
    await tx.billingPayment.update({
      where: { id: payment.id },
      data: {
        status: 'REVIEW_REQUIRED',
        ...(identityConflicts.length ? {} : {
          providerTransactionId: transactionId || payment.providerTransactionId,
          providerOperationId: operationId || payment.providerOperationId,
        }),
        providerPayload: payload,
        ...(paidAt ? { paidAt } : {}),
        failureCode: effectiveReason,
        failureMessage: 'Оплата получена и требует проверки поддержкой.',
      },
    });
  }
  await createOrUpdateIssue(tx, payment, effectiveReason, effectiveDetails);
  return {
    reviewRequired: true,
    immutable: payment.status === 'PAID' || operatorRejected,
    payment,
  };
};

const recordOrphanWebhook = async (payload, reason, details = {}) => {
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(payload ?? null))
    .digest('hex');
  const providerReferenceId = `finik-orphan:${fingerprint}`;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`billing-issue:${providerReferenceId}`}))`;
    const existing = await tx.billingIssue.findUnique({
      where: { providerReferenceId },
      select: { status: true, details: true },
    });
    const previousEventId = existing?.details
      && typeof existing.details === 'object'
      && !Array.isArray(existing.details)
      ? existing.details.webhookEventId
      : null;
    if (
      existing?.status === 'RESOLVED'
      && details?.webhookEventId
      && previousEventId === details.webhookEventId
    ) {
      return;
    }
    await tx.billingIssue.upsert({
      where: { providerReferenceId },
      update: {
        reason,
        details,
        status: 'OPEN',
        resolvedAt: null,
      },
      create: {
        provider: 'FINIK',
        providerReferenceId,
        reason,
        details,
        status: 'OPEN',
      },
    });
  }, { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 30000 });
};

const markPaymentForReview = async ({
  paymentId,
  reason,
  details,
  payload,
  transactionId,
  operationId,
  webhookEventId,
}) => {
  const existing = await prisma.billingPayment.findUnique({
    where: { id: paymentId },
    select: { userId: true },
  });
  if (!existing) {
    await recordOrphanWebhook(payload, 'PAYMENT_NOT_FOUND', { paymentId, webhookEventId });
    return { reviewRequired: true, orphan: true };
  }

  return prisma.$transaction(async (tx) => {
    await acquirePaymentLocks(tx, {
      paymentId,
      userId: existing.userId,
      transactionId,
      operationId,
    });
    const payment = await tx.billingPayment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      await createOrUpdateIssue(tx, {
        id: `finik-orphan:${paymentId}`,
        userId: null,
      }, 'PAYMENT_NOT_FOUND', { paymentId, webhookEventId });
      return { reviewRequired: true, orphan: true };
    }
    return persistPaymentReview(tx, payment, {
      reason,
      details: { ...details, webhookEventId },
      payload,
      transactionId,
      operationId,
    });
  }, { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 30000 });
};

const applySuccessfulPayment = async ({
  paymentId,
  payload,
  transactionId,
  operationId,
  webhookEventId = null,
}) => {
  const existing = await prisma.billingPayment.findUnique({
    where: { id: paymentId },
    select: { userId: true },
  });
  if (!existing) {
    await recordOrphanWebhook(payload, 'PAYMENT_NOT_FOUND', { paymentId, webhookEventId });
    return { reviewRequired: true, orphan: true };
  }

  return prisma.$transaction(async (tx) => {
    await acquirePaymentLocks(tx, {
      paymentId,
      userId: existing.userId,
      transactionId,
      operationId,
    });

    const payment = await tx.billingPayment.findUnique({
      where: { id: paymentId },
      include: { pricingTier: true },
    });
    if (!payment) {
      await createOrUpdateIssue(tx, {
        id: `finik-orphan:${paymentId}`,
        userId: null,
      }, 'PAYMENT_NOT_FOUND', { paymentId, webhookEventId });
      return { reviewRequired: true, orphan: true };
    }

    const bindingMismatches = getWebhookBindingMismatches(
      payload,
      payment,
      config.finik.accountId
    );
    if (bindingMismatches.length) {
      return persistPaymentReview(tx, payment, {
        reason: 'PAYMENT_CONTEXT_MISMATCH',
        details: { mismatchedFields: bindingMismatches, webhookEventId },
        payload,
        transactionId,
        operationId,
      });
    }

    if (!transactionId && !operationId) {
      return persistPaymentReview(tx, payment, {
        reason: 'TRANSACTION_ID_MISSING',
        details: { webhookEventId },
        payload,
        transactionId,
        operationId,
      });
    }

    const amountMinor = getMoneyMinorUnits(payload?.amount);
    const fieldsAmountMinor = payload?.fields?.amount === undefined
      ? amountMinor
      : getMoneyMinorUnits(payload.fields.amount);
    if (amountMinor !== payment.amountMinor || fieldsAmountMinor !== payment.amountMinor) {
      return persistPaymentReview(tx, payment, {
        reason: 'PAYMENT_AMOUNT_MISMATCH',
        details: {
          expectedAmountMinor: payment.amountMinor,
          receivedAmountMinor: amountMinor,
          receivedFieldsAmountMinor: fieldsAmountMinor,
          webhookEventId,
        },
        payload,
        transactionId,
        operationId,
      });
    }

    const identityConflicts = await findProviderIdentityConflicts(
      tx,
      payment.id,
      transactionId,
      operationId
    );
    if (identityConflicts.length) {
      return persistPaymentReview(tx, payment, {
        reason: 'FINIK_TRANSACTION_CONFLICT',
        details: { identityConflicts, webhookEventId },
        payload,
        transactionId,
        operationId,
      });
    }

    if (payment.status === 'PAID') {
      const exactProviderIdentity = payment.providerTransactionId === transactionId
        && payment.providerOperationId === operationId;
      if (exactProviderIdentity) return { duplicate: true, payment };
      return persistPaymentReview(tx, payment, {
        reason: 'PAID_PAYMENT_IDENTITY_CONFLICT',
        details: {
          storedTransactionId: payment.providerTransactionId,
          receivedTransactionId: transactionId,
          storedOperationId: payment.providerOperationId,
          receivedOperationId: operationId,
          webhookEventId,
        },
        payload,
        transactionId,
        operationId,
      });
    }

    if (payment.status === 'FAILED' && payment.failureCode === 'ADMIN_REJECTED') {
      return persistPaymentReview(tx, payment, {
        reason: 'ADMIN_REJECTED_PAYMENT_EVENT',
        details: { webhookEventId },
        payload,
        transactionId,
        operationId,
      });
    }

    const toleranceMs = config.finik.webhookToleranceSeconds * 1000;
    const transactionDate = validateFinikTransactionDate(payload.transactionDate, {
      paymentCreatedAt: payment.createdAt,
      paymentExpiresAt: payment.expiresAt,
      toleranceMs,
    });
    const paidAt = transactionDate.date;
    if (transactionDate.reason === 'INVALID_TRANSACTION_DATE') {
      return persistPaymentReview(tx, payment, {
        reason: 'INVALID_TRANSACTION_DATE',
        details: {
          transactionDate: payload.transactionDate ?? null,
          paymentCreatedAt: payment.createdAt.toISOString(),
          webhookEventId,
        },
        payload,
        transactionId,
        operationId,
      });
    }
    if (transactionDate.reason === 'PAYMENT_AFTER_EXPIRY') {
      return persistPaymentReview(tx, payment, {
        reason: 'PAYMENT_AFTER_EXPIRY',
        details: {
          paidAt: paidAt.toISOString(),
          expiresAt: payment.expiresAt.toISOString(),
          webhookEventId,
        },
        payload,
        transactionId,
        operationId,
        paidAt,
      });
    }

    const restaurants = await tx.restaurant.findMany({
      where: { ownerId: payment.userId },
      select: { id: true, businessType: true },
    });
    const tier = payment.pricingTier;
    let reviewReason = null;
    if (!tier) reviewReason = 'PRICING_TIER_MISSING';
    else if (!restaurants.length) reviewReason = 'BUSINESS_ACCOUNT_MISSING';
    else if (!isTierCompatibleWithRestaurants(tier, restaurants)) reviewReason = 'INCOMPATIBLE_BUSINESS_TYPE';
    else if (tier.maxRestaurants !== null && restaurants.length > tier.maxRestaurants) {
      reviewReason = 'RESTAURANT_LIMIT_EXCEEDED';
    }

    const currentSubscriptions = await tx.subscription.findMany({
      where: { userId: payment.userId },
      select: {
        id: true,
        pricingTierId: true,
        status: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
      },
    });
    const activeDifferentTier = currentSubscriptions.find((subscription) => (
      subscription.status === 'ACTIVE'
      && subscription.currentPeriodEnd
      && subscription.currentPeriodEnd > paidAt
      && subscription.pricingTierId
      && subscription.pricingTierId !== payment.pricingTierId
    ));
    if (!reviewReason && activeDifferentTier) reviewReason = 'ACTIVE_TIER_CHANGED';

    if (reviewReason) {
      return persistPaymentReview(tx, payment, {
        reason: reviewReason,
        details: {
          pricingTierId: payment.pricingTierId,
          restaurantCount: restaurants.length,
          maxRestaurants: tier?.maxRestaurants ?? null,
          businessTypes: restaurants.map((restaurant) => restaurant.businessType),
          webhookEventId,
        },
        payload,
        transactionId,
        operationId,
        paidAt,
      });
    }

    const sameTierActive = currentSubscriptions.filter((subscription) => (
      subscription.status === 'ACTIVE'
      && subscription.pricingTierId === payment.pricingTierId
      && subscription.currentPeriodEnd
      && subscription.currentPeriodEnd > paidAt
    ));
    const latestPeriodEnd = sameTierActive.reduce((latest, subscription) => (
      !latest || subscription.currentPeriodEnd > latest ? subscription.currentPeriodEnd : latest
    ), null);
    const periodStart = latestPeriodEnd || paidAt;
    const periodEnd = addBillingInterval(periodStart, payment.billingInterval);
    const originalPeriodStart = sameTierActive.reduce((earliest, subscription) => {
      if (!subscription.currentPeriodStart) return earliest;
      return !earliest || subscription.currentPeriodStart < earliest
        ? subscription.currentPeriodStart
        : earliest;
    }, null) || paidAt;

    await tx.billingSubscription.upsert({
      where: { userId: payment.userId },
      update: {
        provider: 'FINIK',
        providerSubscriptionId: null,
        externalPriceId: null,
        pricingTierId: tier.id,
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
        currentPeriodStart: originalPeriodStart,
        currentPeriodEnd: periodEnd,
        trialEndsAt: null,
        activatedAt: paidAt,
        providerCreatedAt: paidAt,
        pastDueSince: null,
      },
      create: {
        userId: payment.userId,
        provider: 'FINIK',
        pricingTierId: tier.id,
        status: 'ACTIVE',
        currentPeriodStart: paidAt,
        currentPeriodEnd: periodEnd,
        activatedAt: paidAt,
        providerCreatedAt: paidAt,
      },
    });

    for (const restaurant of restaurants) {
      await tx.subscription.upsert({
        where: {
          userId_restaurantId: {
            userId: payment.userId,
            restaurantId: restaurant.id,
          },
        },
        update: {
          plan: tier.name,
          status: 'ACTIVE',
          source: 'FINIK',
          trialEndsAt: null,
          currentPeriodStart: originalPeriodStart,
          currentPeriodEnd: periodEnd,
          pricingTierId: tier.id,
        },
        create: {
          userId: payment.userId,
          restaurantId: restaurant.id,
          plan: tier.name,
          status: 'ACTIVE',
          source: 'FINIK',
          currentPeriodStart: paidAt,
          currentPeriodEnd: periodEnd,
          pricingTierId: tier.id,
        },
      });
    }

    const updatedPayment = await tx.billingPayment.update({
      where: { id: payment.id },
      data: {
        status: 'PAID',
        providerTransactionId: transactionId || null,
        providerOperationId: operationId || null,
        providerPayload: payload,
        paidAt,
        appliedAt: new Date(),
        failureCode: null,
        failureMessage: null,
      },
    });
    await tx.billingIssue.updateMany({
      where: { providerReferenceId: payment.id, status: 'OPEN' },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
    return { duplicate: false, payment: updatedPayment, periodEnd };
  }, { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 30000 });
};

export const processFinikWebhook = async (payload, metadata = {}) => {
  const webhookEventId = await recordVerifiedFinikWebhook(payload, metadata);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    await recordOrphanWebhook(payload, 'INVALID_WEBHOOK_PAYLOAD', { webhookEventId });
    return { received: true, reviewRequired: true };
  }

  const status = String(payload.status || '').toLowerCase();
  if (!SUCCESS_WEBHOOK_STATUSES.has(status)) {
    return { received: true, ignored: true };
  }

  const paymentId = payload.fields?.paymentId;
  if (!paymentId || typeof paymentId !== 'string' || !UUID_PATTERN.test(paymentId)) {
    const reason = !paymentId || typeof paymentId !== 'string'
      ? 'PAYMENT_ID_MISSING'
      : 'INVALID_PAYMENT_ID';
    await recordOrphanWebhook(payload, reason, {
      webhookEventId,
      transactionId: typeof payload.transactionId === 'string'
        ? payload.transactionId.slice(0, 200)
        : null,
      operationId: typeof payload.id === 'string' ? payload.id.slice(0, 200) : null,
    });
    return { received: true, reviewRequired: true };
  }
  const payment = await prisma.billingPayment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    await recordOrphanWebhook(payload, 'PAYMENT_NOT_FOUND', {
      paymentId: paymentId.slice(0, 200),
      webhookEventId,
    });
    return { received: true, reviewRequired: true };
  }

  const amountMinor = getMoneyMinorUnits(payload.amount);
  const fieldsAmountMinor = payload.fields?.amount === undefined
    ? amountMinor
    : getMoneyMinorUnits(payload.fields.amount);
  const transactionId = typeof payload.transactionId === 'string' && payload.transactionId
    ? payload.transactionId
    : null;
  const operationId = typeof payload.id === 'string' && payload.id ? payload.id : null;

  if (!transactionId && !operationId) {
    await markPaymentForReview({
      paymentId,
      reason: 'TRANSACTION_ID_MISSING',
      details: {},
      payload,
      transactionId,
      operationId,
      webhookEventId,
    });
    return { received: true, reviewRequired: true };
  }

  const bindingMismatches = getWebhookBindingMismatches(
    payload,
    payment,
    config.finik.accountId
  );
  if (bindingMismatches.length) {
    await markPaymentForReview({
      paymentId,
      reason: 'PAYMENT_CONTEXT_MISMATCH',
      details: { mismatchedFields: bindingMismatches },
      payload,
      transactionId,
      operationId,
      webhookEventId,
    });
    return { received: true, reviewRequired: true };
  }

  if (amountMinor !== payment.amountMinor || fieldsAmountMinor !== payment.amountMinor) {
    await markPaymentForReview({
      paymentId,
      reason: 'PAYMENT_AMOUNT_MISMATCH',
      details: {
        expectedAmountMinor: payment.amountMinor,
        receivedAmountMinor: amountMinor,
        receivedFieldsAmountMinor: fieldsAmountMinor,
      },
      payload,
      transactionId,
      operationId,
      webhookEventId,
    });
    return { received: true, reviewRequired: true };
  }

  const result = await applySuccessfulPayment({
    paymentId,
    payload,
    transactionId,
    operationId,
    webhookEventId,
  });
  return {
    received: true,
    duplicate: Boolean(result.duplicate),
    reviewRequired: Boolean(result.reviewRequired),
  };
};

export const verifyFinikWebhook = ({ body, headers, method, path, query }) => {
  if (!isFinikConfigured()) return { valid: false, reason: 'FINIK_NOT_CONFIGURED' };
  const signature = headers.signature;
  const timestampValue = headers['x-api-timestamp'];
  if (typeof signature !== 'string' || typeof timestampValue !== 'string') {
    return { valid: false, reason: 'SIGNATURE_HEADERS_MISSING' };
  }

  const timestamp = Number(timestampValue);
  if (!Number.isFinite(timestamp)) return { valid: false, reason: 'INVALID_TIMESTAMP' };
  const toleranceMs = config.finik.webhookToleranceSeconds * 1000;
  if (Math.abs(Date.now() - timestamp) > toleranceMs) {
    return { valid: false, reason: 'STALE_TIMESTAMP' };
  }

  const expectedPath = new URL(config.finik.webhookUrl).pathname;
  if (path !== expectedPath) return { valid: false, reason: 'WEBHOOK_PATH_MISMATCH' };

  const canonicalHeaders = { Host: getFinikWebhookHost() };
  Object.entries(headers).forEach(([key, value]) => {
    if (key.toLowerCase().startsWith('x-api-') && typeof value === 'string') {
      canonicalHeaders[key.toLowerCase()] = value;
    }
  });
  const canonicalQuery = Object.fromEntries(
    Object.entries(query || {}).map(([key, value]) => [key, String(value ?? '')])
  );
  const valid = verifyFinikSignature({
    httpMethod: method,
    path,
    headers: canonicalHeaders,
    queryStringParameters: Object.keys(canonicalQuery).length ? canonicalQuery : null,
    body,
  }, getFinikPublicKey(), signature);
  return { valid, reason: valid ? null : 'INVALID_SIGNATURE' };
};

export const getBillingStatus = async (userId) => {
  await expireStalePayments(prisma, userId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      billingSubscription: { include: { pricingTier: true } },
      subscriptions: {
        include: { pricingTier: true },
        orderBy: { updatedAt: 'desc' },
      },
      billingPayments: {
        // A CREATING row is intentionally not exposed: until Finik has accepted
        // the request there is no resumable payment and no reason to reveal its UUID.
        where: { status: 'PENDING' },
        include: { pricingTier: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      billingIssues: {
        where: { status: 'OPEN' },
        select: { reason: true, firstSeenAt: true, providerReferenceId: true },
        orderBy: { lastSeenAt: 'desc' },
        take: 1,
      },
    },
  });
  const now = new Date();
  const localSubscription = selectLocalSubscription(user?.subscriptions, now);
  const billingSubscription = serializeBillingSubscription(user?.billingSubscription, now);
  const localSerialized = serializeLocalSubscription(localSubscription, now);
  const subscription = billingSubscription
    && ['ACTIVE', 'TRIAL'].includes(billingSubscription.status)
    ? billingSubscription
    : (localSerialized || billingSubscription);

  return {
    configured: isFinikConfigured(),
    provider: 'FINIK',
    mode: config.finik.mode,
    requiresAction: Boolean(user?.billingIssues?.length),
    billingIssue: user?.billingIssues?.[0] || null,
    pendingPayment: serializePayment(user?.billingPayments?.[0], now),
    subscription,
  };
};

export const getBillingPayment = async (userId, paymentId) => {
  await expireStalePayments(prisma, userId);
  const payment = await prisma.billingPayment.findFirst({
    where: { id: paymentId, userId },
    include: { pricingTier: true },
  });
  if (!payment) throw createHttpError(404, 'Платёж не найден', 'PAYMENT_NOT_FOUND');
  const billing = await getBillingStatus(userId);
  return {
    payment: serializePayment(payment),
    subscription: billing.subscription,
    requiresAction: billing.requiresAction,
    billingIssue: billing.billingIssue,
  };
};

export const listOpenBillingIssues = async () => {
  const issues = await prisma.billingIssue.findMany({
    where: { status: 'OPEN' },
    orderBy: { lastSeenAt: 'asc' },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  });
  const eventIds = issues.map((issue) => (
    issue.details
    && typeof issue.details === 'object'
    && !Array.isArray(issue.details)
    && typeof issue.details.webhookEventId === 'string'
      ? issue.details.webhookEventId
      : null
  )).filter(Boolean);
  const events = eventIds.length
    ? await prisma.billingWebhookEvent.findMany({ where: { id: { in: eventIds } } })
    : [];
  const eventsById = new Map(events.map((event) => [event.id, event]));
  return issues.map((issue) => ({
    ...issue,
    webhookEvent: eventsById.get(issue.details?.webhookEventId) || null,
  }));
};

export const reconcileBillingIssue = async (issueId) => {
  const issue = await prisma.billingIssue.findUnique({ where: { id: issueId } });
  if (!issue) throw createHttpError(404, 'Проблема оплаты не найдена', 'BILLING_ISSUE_NOT_FOUND');
  if (issue.status !== 'OPEN') return { resolved: true };
  if (issue.provider !== 'FINIK') {
    throw createHttpError(409, 'Эта legacy-оплата требует ручной проверки', 'LEGACY_BILLING_ISSUE');
  }
  if ([
    'PAYMENT_AMOUNT_MISMATCH',
    'PAYMENT_AFTER_EXPIRY',
    'PAYMENT_CONTEXT_MISMATCH',
    'FINIK_TRANSACTION_CONFLICT',
    'PAID_PAYMENT_IDENTITY_CONFLICT',
    'INVALID_TRANSACTION_DATE',
    'TRANSACTION_ID_MISSING',
    'PAYMENT_NOT_FOUND',
    'PAYMENT_ID_MISSING',
    'ADMIN_REJECTED_PAYMENT_EVENT',
  ].includes(issue.reason)) {
    throw createHttpError(409, 'Эта оплата требует ручного решения или возврата', 'MANUAL_REVIEW_REQUIRED');
  }

  const payment = await prisma.billingPayment.findUnique({ where: { id: issue.providerReferenceId } });
  if (!payment?.providerPayload) {
    throw createHttpError(409, 'Для повторной проверки нет webhook payload', 'PAYMENT_PAYLOAD_MISSING');
  }
  const result = await applySuccessfulPayment({
    paymentId: payment.id,
    payload: payment.providerPayload,
    transactionId: payment.providerTransactionId || payment.providerPayload?.transactionId || null,
    operationId: payment.providerOperationId || payment.providerPayload?.id || null,
    webhookEventId: getWebhookEventId(payment.providerPayload),
  });
  return {
    resolved: !result.reviewRequired,
    reviewRequired: Boolean(result.reviewRequired),
  };
};

export const resolveBillingIssue = async (issueId, {
  decision,
  note,
  resolvedBy,
}) => {
  const normalizedDecision = String(decision || '').trim().toUpperCase();
  const normalizedNote = String(note || '').trim();
  if (!BILLING_ISSUE_DECISIONS.has(normalizedDecision)) {
    throw createHttpError(400, 'Некорректное решение по оплате', 'INVALID_BILLING_ISSUE_DECISION');
  }
  if (normalizedNote.length < 5 || normalizedNote.length > 2000) {
    throw createHttpError(
      400,
      'Добавьте комментарий администратора длиной от 5 до 2000 символов',
      'BILLING_ISSUE_NOTE_REQUIRED'
    );
  }

  const initialIssue = await prisma.billingIssue.findUnique({ where: { id: issueId } });
  if (!initialIssue) {
    throw createHttpError(404, 'Проблема оплаты не найдена', 'BILLING_ISSUE_NOT_FOUND');
  }

  return prisma.$transaction(async (tx) => {
    if (initialIssue.userId) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`billing:${initialIssue.userId}`}))`;
    }
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`billing-issue:${issueId}`}))`;

    const issue = await tx.billingIssue.findUnique({ where: { id: issueId } });
    if (!issue) {
      throw createHttpError(404, 'Проблема оплаты не найдена', 'BILLING_ISSUE_NOT_FOUND');
    }
    if (issue.status === 'RESOLVED') {
      return { resolved: true, issue };
    }

    const payment = await tx.billingPayment.findUnique({
      where: { id: issue.providerReferenceId },
    });
    if (
      normalizedDecision === 'KEEP_CURRENT_STATE'
      && payment
      && payment.status !== 'PAID'
      && payment.failureCode !== 'ADMIN_REJECTED'
    ) {
      throw createHttpError(
        409,
        'Необработанный платёж нельзя оставить в REVIEW_REQUIRED; отклоните его или выполните reconcile',
        'UNAPPLIED_PAYMENT_REQUIRES_DECISION'
      );
    }
    if (normalizedDecision === 'REJECT_UNAPPLIED_PAYMENT') {
      if (!payment) {
        throw createHttpError(
          409,
          'Неизвестный платёж можно только закрыть без изменения ledger',
          'BILLING_PAYMENT_NOT_FOUND'
        );
      }
      if (payment.status === 'PAID') {
        throw createHttpError(
          409,
          'Подтверждённый PAID ledger нельзя отклонить; используйте KEEP_CURRENT_STATE',
          'PAID_PAYMENT_IMMUTABLE'
        );
      }
      await tx.billingPayment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          failureCode: 'ADMIN_REJECTED',
          failureMessage: normalizedNote.slice(0, 500),
        },
      });
    }

    const previousDetails = issue.details
      && typeof issue.details === 'object'
      && !Array.isArray(issue.details)
      ? issue.details
      : {};
    const decidedAt = new Date();
    const updatedIssue = await tx.billingIssue.update({
      where: { id: issue.id },
      data: {
        status: 'RESOLVED',
        resolvedAt: decidedAt,
        details: {
          ...previousDetails,
          resolution: {
            decision: normalizedDecision,
            note: normalizedNote,
            resolvedBy: String(resolvedBy || 'unknown').slice(0, 200),
            decidedAt: decidedAt.toISOString(),
          },
        },
      },
    });
    return {
      resolved: true,
      issue: updatedIssue,
    };
  }, { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 30000 });
};
