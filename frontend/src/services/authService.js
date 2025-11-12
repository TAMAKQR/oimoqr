import api from './api';

export const authService = {
  register: async (data) => {
    try {
      const response = await api.post('/auth/register', data);
      return response.data;
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка регистрации');
      throw error;
    }
  },

  login: async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      return response.data;
    } catch (error) {
      toast.error(error.response?.data?.error || 'Ошибка входа');
      throw error;
    }
  },

  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

import toast from 'react-hot-toast';