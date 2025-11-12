import api from './api';

export const pricingService = {
  getPricingTiers: async () => {
    const response = await api.get('/pricing-tiers');
    return response.data;
  }
};