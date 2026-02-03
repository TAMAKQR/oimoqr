import api from './api';
import { getFromCache, setToCache, clearCache } from '../utils/cache';

export const restaurantService = {
  createRestaurant: async (data) => {
    try {
      const response = await api.post(`/restaurants`, data);
      return response.data;
    } catch (error) {
      // Если сервер вернул ошибку с деталями, возвращаем их
      if (error.response?.data) {
        return error.response.data;
      }
      // Иначе выбрасываем общую ошибку
      throw new Error(error.message || 'Ошибка при создании ресторана');
    }
  },

  getRestaurant: async (subdomain) => {
    const response = await api.get(`/restaurants/${subdomain}`);
    return response.data;
  },

  getBySubdomain: async (subdomain, language) => {
    // Создаем уникальный ключ кэша
    const cacheKey = `restaurant_${subdomain}_${language || 'default'}`;

    // Проверяем кэш
    const cached = getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Если нет в кэше, делаем запрос
    console.log(`🌐 Loading restaurant from API: ${subdomain}`);
    const params = language ? { language } : {};
    const response = await api.get(`/restaurants/${subdomain}`, { params });

    // Сохраняем в кэш (5 минут)
    setToCache(cacheKey, response.data);

    return response.data;
  },

  updateRestaurant: async (id, data) => {
    const response = await api.put(`/restaurants/${id}`, data);

    // Очищаем кэш при обновлении
    // Не знаем subdomain, поэтому очищаем весь кэш ресторанов
    clearCache(`restaurant_*`);

    return response.data;
  },

  uploadBanner: async (restaurantId, file, onProgress) => {
    const formData = new FormData();
    formData.append('banner', file);
    const response = await api.post(`/restaurants/${restaurantId}/upload-banner`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });
    return response.data;
  },

  deleteBanner: async (restaurantId, bannerUrl) => {
    const response = await api.delete(`/restaurants/${restaurantId}/delete-banner`, {
      data: { bannerUrl }
    });
    return response.data;
  },

  uploadLogo: async (restaurantId, file, onProgress) => {
    const formData = new FormData();
    formData.append('logo', file);
    const response = await api.post(`/restaurants/${restaurantId}/upload-logo`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });
    return response.data;
  },

  deleteLogo: async (restaurantId) => {
    const response = await api.delete(`/restaurants/${restaurantId}/delete-logo`);
    return response.data;
  },

  copyMenu: async (targetRestaurantId, sourceRestaurantId) => {
    const response = await api.post(`/restaurants/${targetRestaurantId}/copy-menu`, {
      sourceRestaurantId
    });
    return response.data;
  },

  deleteRestaurant: async (restaurantId) => {
    const response = await api.delete(`/restaurants/${restaurantId}`);
    return response.data;
  },
};