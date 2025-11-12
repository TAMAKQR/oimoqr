import api from './api';

export const menuService = {
  // Categories
  getCategories: async (restaurantId) => {
    const response = await api.get(`/restaurants/${restaurantId}/categories`);
    return response.data;
  },

  createCategory: async (data) => {
    const response = await api.post('/categories', data);
    return response.data;
  },

  updateCategory: async (id, data) => {
    const response = await api.put(`/categories/${id}`, data);
    return response.data;
  },

  deleteCategory: async (id) => {
    const response = await api.delete(`/categories/${id}`);
    return response.data;
  },

  // Dishes
  getDishes: async (categoryId) => {
    const response = await api.get(`/categories/${categoryId}/dishes`);
    return response.data;
  },

  createDish: async (data) => {
    const response = await api.post('/dishes', data);
    return response.data;
  },

  updateDish: async (id, data) => {
    const response = await api.put(`/dishes/${id}`, data);
    return response.data;
  },

  deleteDish: async (id) => {
    const response = await api.delete(`/dishes/${id}`);
    return response.data;
  },

  uploadDishImage: async (dishId, file, onProgress) => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post(`/dishes/${dishId}/upload-image`, formData, {
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
  
  deleteDishImage: async (dishId) => {
    const response = await api.delete(`/dishes/${dishId}/image`);
    return response.data;
  },

  toggleDishAvailability: async (dishId) => {
    const response = await api.patch(`/dishes/${dishId}/toggle-availability`);
    return response.data;
  },

  // Modifiers
  createModifier: async (dishId, data) => {
    const response = await api.post(`/dishes/${dishId}/modifiers`, data);
    return response.data;
  },

  updateModifier: async (modifierId, data) => {
    const response = await api.put(`/dishes/modifiers/${modifierId}`, data);
    return response.data;
  },

  deleteModifier: async (modifierId) => {
    const response = await api.delete(`/dishes/modifiers/${modifierId}`);
    return response.data;
  },

  reorderCategories: async (restaurantId, categoryIds) => {
    const response = await api.post(`/categories/${restaurantId}/reorder`, { categoryIds });
    return response.data;
  },

  reorderDishes: async (categoryId, dishIds) => {
    const response = await api.post(`/dishes/category/${categoryId}/reorder`, { dishIds });
    return response.data;
  },
};