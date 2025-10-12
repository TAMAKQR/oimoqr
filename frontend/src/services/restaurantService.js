import api from './api';

export const restaurantService = {
  getRestaurant: async (subdomain) => {
    const response = await api.get(`/restaurants/${subdomain}`);
    return response.data;
  },

  getBySubdomain: async (subdomain) => {
    const response = await api.get(`/restaurants/${subdomain}`);
    return response.data;
  },

  updateRestaurant: async (id, data) => {
    const response = await api.put(`/restaurants/${id}`, data);
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
};