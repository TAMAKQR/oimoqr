export const formatBillingPrice = (tier, locale = 'ru-RU') => {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: (tier?.currency || 'kgs').toUpperCase(),
    }).format(Number(tier?.price || 0));
  } catch {
    return `${tier?.price ?? 0} ${(tier?.currency || 'kgs').toUpperCase()}`;
  }
};

export const getBillingIntervalLabel = (tier, short = false) => {
  if (tier?.billingInterval === 'year') return short ? 'год' : 'год';
  return short ? 'мес' : 'месяц';
};
