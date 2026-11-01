import api from './api';

export const finikOrderPaymentService = {
  getAvailability: async (restaurantId) => {
    const response = await api.get(
      `/orders/finik/availability/${encodeURIComponent(restaurantId)}`
    );
    return response.data;
  },

  getPayment: async (paymentId) => {
    const response = await api.get(
      `/orders/finik/payments/${encodeURIComponent(paymentId)}`
    );
    return response.data;
  },
};
