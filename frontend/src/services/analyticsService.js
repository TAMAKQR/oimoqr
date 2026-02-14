import api from './api';

export const analyticsService = {
  // Получить статистику ресторана
  async getRestaurantStats(restaurantId) {
    try {
      const response = await api.get(`/analytics/restaurant/${restaurantId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching restaurant stats:', error);
      throw error.response?.data || error.message;
    }
  },

  // Получить просмотры ресторана
  async getRestaurantViews(restaurantId) {
    try {
      const response = await api.get(`/analytics/restaurant/${restaurantId}/views`);
      return response.data;
    } catch (error) {
      console.error('Error fetching restaurant views:', error);
      throw error.response?.data || error.message;
    }
  }
};
