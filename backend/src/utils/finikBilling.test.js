import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addBillingInterval,
  getWebhookBindingMismatches,
  getMoneyMinorUnits,
  isSupportedBillingInterval,
  isTierCompatibleWithRestaurants,
  validateFinikTransactionDate,
} from './finikBilling.js';

test('converts KGS display amounts to integer minor units without rounding charges', () => {
  assert.equal(getMoneyMinorUnits(1500), 150000);
  assert.equal(getMoneyMinorUnits('1500.25'), 150025);
  assert.equal(getMoneyMinorUnits(1.001), null);
  assert.equal(getMoneyMinorUnits(0), null);
  assert.equal(getMoneyMinorUnits(Number.POSITIVE_INFINITY), null);
});

test('adds calendar billing periods and clamps end-of-month dates', () => {
  assert.equal(
    addBillingInterval('2024-01-31T12:30:00.000Z', 'month').toISOString(),
    '2024-02-29T12:30:00.000Z'
  );
  assert.equal(
    addBillingInterval('2024-02-29T12:30:00.000Z', 'year').toISOString(),
    '2025-02-28T12:30:00.000Z'
  );
  assert.equal(isSupportedBillingInterval('month'), true);
  assert.equal(isSupportedBillingInterval('week'), false);
  assert.throws(() => addBillingInterval(new Date(), 'week'), /Unsupported billing interval/);
});

test('checks a tier against every restaurant business type', () => {
  const restaurants = [{ businessType: 'RESTAURANT' }, { businessType: 'RESTAURANT' }];
  assert.equal(isTierCompatibleWithRestaurants({ businessType: 'RESTAURANT' }, restaurants), true);
  assert.equal(isTierCompatibleWithRestaurants({ businessType: 'HOTEL' }, restaurants), false);
  assert.equal(isTierCompatibleWithRestaurants({ businessType: 'ALL' }, restaurants), true);
});

test('binds a signed webhook to the expected merchant, account, tier and nonce', () => {
  const payment = {
    userId: 'user-1',
    pricingTierId: 'tier-1',
    verificationToken: 'server-random-token',
  };
  const payload = {
    data: { accountId: 'finik-account-1' },
    fields: {
      oimoqrAccountId: 'user-1',
      oimoqrTierId: 'tier-1',
      oimoqrToken: 'server-random-token',
    },
  };

  assert.deepEqual(getWebhookBindingMismatches(payload, payment, 'finik-account-1'), []);
  assert.deepEqual(
    getWebhookBindingMismatches({
      ...payload,
      data: { accountId: 'another-merchant' },
      fields: { ...payload.fields, oimoqrToken: 'forged-token' },
    }, payment, 'finik-account-1'),
    ['accountId', 'verificationToken']
  );
  assert.deepEqual(getWebhookBindingMismatches({}, payment, 'finik-account-1'), [
    'accountId',
    'userId',
    'pricingTierId',
    'verificationToken',
  ]);
});

test('rejects implausible transaction timestamps and distinguishes late payments', () => {
  const window = {
    paymentCreatedAt: '2026-10-14T10:00:00.000Z',
    paymentExpiresAt: '2026-10-14T10:30:00.000Z',
    now: Date.parse('2026-10-14T10:40:00.000Z'),
    toleranceMs: 5 * 60 * 1000,
  };
  assert.equal(validateFinikTransactionDate(
    Date.parse('2026-10-14T10:10:00.000Z'),
    window
  ).valid, true);
  assert.equal(validateFinikTransactionDate(1_760_436_600, window).reason, 'INVALID_TRANSACTION_DATE');
  assert.equal(validateFinikTransactionDate(
    Date.parse('2026-10-14T10:36:00.000Z'),
    window
  ).reason, 'PAYMENT_AFTER_EXPIRY');
  assert.equal(validateFinikTransactionDate(
    Date.parse('2026-10-14T10:46:00.000Z'),
    window
  ).reason, 'INVALID_TRANSACTION_DATE');
});
