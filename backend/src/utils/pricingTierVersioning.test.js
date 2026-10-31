import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildReplacementPricingTierData,
  haveVersionedPricingFieldsChanged,
  shouldVersionPricingTier,
} from './pricingTierVersioning.js';

const currentTier = {
  id: 'tier-old',
  name: 'Restaurant',
  price: 10,
  currency: 'kgs',
  billingInterval: 'month',
  externalPriceId: 'legacy-price',
  onlinePaymentEnabled: true,
  description: 'Original description',
  features: '["Feature"]',
  maxRestaurants: 1,
  includesDelivery: true,
  includedSmsCount: 25,
  smsOveragePrice: 0.25,
  maxCustomers: 100,
  maxStaff: 5,
  bonusProgramEnabled: false,
  bonusAccrualRate: 0,
  bonusExpiryDays: 90,
  bonusBronzeLabel: 'Bronze',
  bonusSilverLabel: 'Silver',
  bonusGoldLabel: 'Gold',
  bonusSilverFromOrders: 8,
  bonusGoldFromOrders: 20,
  businessType: 'RESTAURANT',
  order: 1,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  _count: { billingPayments: 1 },
};

test('detects only changes that require a new pricing version', () => {
  assert.equal(haveVersionedPricingFieldsChanged(currentTier, {
    ...currentTier,
    description: 'Updated description',
    onlinePaymentEnabled: false,
  }), false);
  assert.equal(haveVersionedPricingFieldsChanged(currentTier, {
    ...currentTier,
    price: 15,
  }), true);
  assert.equal(haveVersionedPricingFieldsChanged(currentTier, {
    ...currentTier,
    maxRestaurants: 2,
  }), true);
});

test('versions changed financial terms only when billing history exists', () => {
  const nextTier = { ...currentTier, price: 15 };
  assert.equal(shouldVersionPricingTier({
    currentTier,
    nextTier,
    hasBillingHistory: true,
  }), true);
  assert.equal(shouldVersionPricingTier({
    currentTier,
    nextTier,
    hasBillingHistory: false,
  }), false);
});

test('builds a replacement without copying identity or provider references', () => {
  const replacement = buildReplacementPricingTierData(currentTier, {
    name: 'Restaurant Plus',
    price: 15,
    description: undefined,
    maxRestaurants: 2,
  });

  assert.equal(replacement.name, 'Restaurant Plus');
  assert.equal(replacement.price, 15);
  assert.equal(replacement.description, 'Original description');
  assert.equal(replacement.maxRestaurants, 2);
  assert.equal(replacement.includesDelivery, true);
  assert.equal(replacement.includedSmsCount, 25);
  assert.equal(replacement.externalPriceId, null);
  assert.equal('id' in replacement, false);
  assert.equal('createdAt' in replacement, false);
  assert.equal('_count' in replacement, false);
});
