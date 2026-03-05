import api from './api';
import { getFromCache, setToCache, clearCacheByPrefix } from '../utils/cache';

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

  getBySubdomain: async (subdomain, language, options = {}) => {
    const { latitude, longitude, forceRefresh = false } = options;

    // Создаем ключ кэша только по домену/языку (гео-зависимые запросы не кэшируем)
    const cacheKey = `restaurant_${subdomain}_${language || 'default'}`;

    if (!forceRefresh && !latitude && !longitude) {
      const cached = getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const params = { ...(language ? { language } : {}), ...(latitude && longitude ? { latitude, longitude } : {}) };
    const response = await api.get(`/restaurants/${subdomain}`, { params });

    // Кэшируем только если запрос не завязан на гео и не принудительный refresh
    if (!forceRefresh && !latitude && !longitude) {
      setToCache(cacheKey, response.data);
    }

    return response.data;
  },

  updateRestaurant: async (id, data) => {
    const response = await api.put(`/restaurants/${id}`, data);

    // Очищаем кэш при обновлении
    // Не знаем subdomain, поэтому очищаем весь кэш ресторанов
    clearCacheByPrefix('restaurant_');

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

  setSharedMenuSource: async (restaurantId, sourceRestaurantId) => {
    const response = await api.put(`/restaurants/${restaurantId}/shared-menu-source`, {
      sourceRestaurantId: sourceRestaurantId || null
    });
    clearCacheByPrefix('restaurant_');
    return response.data;
  },

  getDishStops: async (restaurantId) => {
    const response = await api.get(`/restaurants/${restaurantId}/dish-stops`);
    return response.data;
  },

  setDishStop: async (restaurantId, dishId, isStopped = true, reason = null) => {
    const response = await api.put(`/restaurants/${restaurantId}/dishes/${dishId}/stop`, {
      isStopped,
      reason: reason || null
    });
    return response.data;
  },

  setModifierOptionStop: async (restaurantId, optionId, isStopped = true, reason = null) => {
    const response = await api.put(`/restaurants/${restaurantId}/modifier-options/${optionId}/stop`, {
      isStopped,
      reason: reason || null
    });
    return response.data;
  },

  deleteRestaurant: async (restaurantId) => {
    const response = await api.delete(`/restaurants/${restaurantId}`);
    return response.data;
  },
};
