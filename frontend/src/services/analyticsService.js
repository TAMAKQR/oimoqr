import api from './api';

export const analyticsService = {
  // Получить статистику ресторана
  async getRestaurantStats(restaurantId) {
    try {
      const response = await api.get(`/analytics/restaurant/${restaurantId}`);
      return response.data;
    } catch (error) {
      const status = error?.response?.status;
      if (status !== 403) {
        console.error('Error fetching restaurant stats:', error);
      }
      const payload = error?.response?.data;
      if (payload && typeof payload === 'object') {
        throw { ...payload, status };
      }
      throw { message: payload || error.message, status };
    }
  },

  // Получить просмотры ресторана
  async getRestaurantViews(restaurantId) {
    try {
      const response = await api.get(`/analytics/restaurant/${restaurantId}/views`);
      return response.data;
    } catch (error) {
      const status = error?.response?.status;
      if (status !== 403) {
        console.error('Error fetching restaurant views:', error);
      }
      const payload = error?.response?.data;
      if (payload && typeof payload === 'object') {
        throw { ...payload, status };
      }
      throw { message: payload || error.message, status };
    }
  }
};
