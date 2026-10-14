const SUPPORTED_INTERVALS = new Set(['month', 'year']);

export const isSupportedBillingInterval = (value) => SUPPORTED_INTERVALS.has(value);

export const getMoneyMinorUnits = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const scaled = numeric * 100;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > 1e-7 || rounded > 2_147_483_647) return null;
  return rounded;
};

export const addBillingInterval = (value, interval) => {
  if (!isSupportedBillingInterval(interval)) {
    throw new Error(`Unsupported billing interval: ${interval}`);
  }

  const result = new Date(value);
  if (Number.isNaN(result.getTime())) throw new Error('Invalid billing period start');

  const day = result.getUTCDate();
  const months = interval === 'year' ? 12 : 1;
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(
    result.getUTCFullYear(),
    result.getUTCMonth() + 1,
    0
  )).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
};

export const isTierCompatibleWithRestaurants = (tier, restaurants = []) => {
  const tierBusinessType = tier?.businessType || 'RESTAURANT';
  return tierBusinessType === 'ALL' || restaurants.every(
    (restaurant) => (restaurant.businessType || 'RESTAURANT') === tierBusinessType
  );
};

export const getWebhookBindingMismatches = (payload, payment, accountId) => {
  const fields = payload?.fields && typeof payload.fields === 'object' ? payload.fields : {};
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};
  const expected = {
    accountId: String(accountId || ''),
    userId: String(payment?.userId || ''),
    pricingTierId: String(payment?.pricingTierId || ''),
    verificationToken: String(payment?.verificationToken || ''),
  };
  const received = {
    accountId: String(data.accountId || ''),
    userId: String(fields.oimoqrAccountId || ''),
    pricingTierId: String(fields.oimoqrTierId || ''),
    verificationToken: String(fields.oimoqrToken || ''),
  };

  return Object.keys(expected).filter((key) => !expected[key] || received[key] !== expected[key]);
};

export const validateFinikTransactionDate = (value, {
  paymentCreatedAt,
  paymentExpiresAt,
  now = Date.now(),
  toleranceMs,
}) => {
  const numeric = Number(value);
  const createdAt = new Date(paymentCreatedAt);
  const expiresAt = new Date(paymentExpiresAt);
  const date = new Date(numeric);
  if (
    !Number.isFinite(numeric)
    || numeric <= 0
    || !Number.isFinite(toleranceMs)
    || toleranceMs < 0
    || Number.isNaN(createdAt.getTime())
    || Number.isNaN(expiresAt.getTime())
    || Number.isNaN(date.getTime())
    || date.getTime() > Number(now) + toleranceMs
    || date.getTime() < createdAt.getTime() - toleranceMs
  ) {
    return { valid: false, reason: 'INVALID_TRANSACTION_DATE', date: null };
  }
  if (date.getTime() > expiresAt.getTime() + toleranceMs) {
    return { valid: false, reason: 'PAYMENT_AFTER_EXPIRY', date };
  }
  return { valid: true, reason: null, date };
};
