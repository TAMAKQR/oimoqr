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
    console.log('📡 [API Service] uploadDishImage called');
    console.log('📡 [API Service] Dish ID:', dishId);
    console.log('📡 [API Service] File:', file?.name, file?.size, file?.type);

    const formData = new FormData();
    formData.append('image', file);

    console.log('📡 [API Service] FormData created for dish image');
    console.log('📡 [API Service] Sending POST to:', `/dishes/${dishId}/upload-image`);

    try {
      const response = await api.post(`/dishes/${dishId}/upload-image`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            console.log(`📡 [API Service] Dish image upload progress: ${percentCompleted}%`);
            onProgress(percentCompleted);
          }
        },
      });

      console.log('✅ [API Service] Dish image upload successful:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ [API Service] Dish image upload failed:', error);
      console.error('❌ [API Service] Error response:', error.response);
      throw error;
    }
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

  // Modifier Options
  createModifierOption: async (modifierId, data) => {
    const response = await api.post(`/dishes/modifiers/${modifierId}/options`, data);
    return response.data;
  },

  updateModifierOption: async (optionId, data) => {
    const response = await api.put(`/dishes/modifiers/options/${optionId}`, data);
    return response.data;
  },

  deleteModifierOption: async (optionId) => {
    const response = await api.delete(`/dishes/modifiers/options/${optionId}`);
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

  // ✅ Modifier Options - Image upload/delete
  uploadModifierOptionImage: async (optionId, file, onProgress) => {
    console.log('📡 [API Service] uploadModifierOptionImage called');
    console.log('📡 [API Service] Option ID:', optionId);
    console.log('📡 [API Service] File:', file?.name, file?.size, file?.type);

    const formData = new FormData();
    formData.append('image', file);

    console.log('📡 [API Service] FormData created');
    console.log('📡 [API Service] Sending POST to:', `/dishes/modifiers/options/${optionId}/upload-image`);

    try {
      const response = await api.post(`/dishes/modifiers/options/${optionId}/upload-image`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            console.log(`📡 [API Service] Upload progress: ${percentCompleted}%`);
            onProgress(percentCompleted);
          }
        },
      });

      console.log('✅ [API Service] Upload successful:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ [API Service] Upload failed:', error);
      console.error('❌ [API Service] Error response:', error.response);
      throw error;
    }
  },

  deleteModifierOptionImage: async (optionId) => {
    const response = await api.delete(`/dishes/modifiers/options/${optionId}/image`);
    return response.data;
  },
};