import api from './api';

export const billingService = {
  getSubscription: async () => {
    const response = await api.get('/billing/subscription');
    return response.data;
  },

  createPayment: async (pricingTierId) => {
    const response = await api.post('/billing/payments', { pricingTierId });
    return response.data;
  },

  getPayment: async (paymentId) => {
    const response = await api.get(`/billing/payments/${encodeURIComponent(paymentId)}`);
    return response.data;
  },
};
