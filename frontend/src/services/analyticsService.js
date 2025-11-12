import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Создаём axios instance с автоматической отправкой токена
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Добавляем токен к каждому запросу
api.interceptors.request.use((config) => {
  const authStorage = localStorage.getItem('auth-storage');
  if (authStorage) {
    const { state } = JSON.parse(authStorage);
    if (state?.token) {
      config.headers.Authorization = `Bearer ${state.token}`;
    }
  }
  return config;
});

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
