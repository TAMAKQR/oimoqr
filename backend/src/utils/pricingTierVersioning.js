const VERSIONED_PRICING_FIELDS = [
  'price',
  'currency',
  'billingInterval',
  'businessType',
  'maxRestaurants',
];

const REPLACEMENT_COPY_FIELDS = [
  'name',
  'price',
  'currency',
  'billingInterval',
  'onlinePaymentEnabled',
  'description',
  'features',
  'maxRestaurants',
  'includesDelivery',
  'includedSmsCount',
  'smsOveragePrice',
  'maxCustomers',
  'maxStaff',
  'bonusProgramEnabled',
  'bonusAccrualRate',
  'bonusExpiryDays',
  'bonusBronzeLabel',
  'bonusSilverLabel',
  'bonusGoldLabel',
  'bonusSilverFromOrders',
  'bonusGoldFromOrders',
  'businessType',
  'order',
  'isActive',
];

const pricingValuesEqual = (field, currentValue, nextValue) => {
  if (field === 'price') return Number(currentValue) === Number(nextValue);
  return currentValue === nextValue;
};

export const haveVersionedPricingFieldsChanged = (currentTier, nextTier) => (
  VERSIONED_PRICING_FIELDS.some((field) => (
    !pricingValuesEqual(field, currentTier[field], nextTier[field])
  ))
);

export const shouldVersionPricingTier = ({ currentTier, nextTier, hasBillingHistory }) => (
  Boolean(hasBillingHistory) && haveVersionedPricingFieldsChanged(currentTier, nextTier)
);

export const buildReplacementPricingTierData = (currentTier, nextTier) => {
  const data = {};

  for (const field of REPLACEMENT_COPY_FIELDS) {
    if (currentTier[field] !== undefined) data[field] = currentTier[field];
  }

  for (const [field, value] of Object.entries(nextTier)) {
    if (value !== undefined) data[field] = value;
  }

  // Provider identifiers belong to the historical version and must never be
  // reused by the replacement sold to new customers.
  data.externalPriceId = null;
  return data;
};
