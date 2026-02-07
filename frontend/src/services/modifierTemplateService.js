import api from './api';

const modifierTemplateService = {
  // Получить все шаблоны ресторана
  getTemplates: async (restaurantId) => {
    const response = await api.get(`/modifiers/restaurant/${restaurantId}/templates`);
    return response.data;
  },

  // Создать шаблон
  createTemplate: async (templateData) => {
    const response = await api.post('/modifiers/templates', templateData);
    return response.data;
  },

  // Обновить шаблон
  updateTemplate: async (id, templateData) => {
    const response = await api.put(`/modifiers/templates/${id}`, templateData);
    return response.data;
  },

  // Удалить шаблон
  deleteTemplate: async (id) => {
    const response = await api.delete(`/modifiers/templates/${id}`);
    return response.data;
  },

  // Применить шаблон к блюду
  applyToDish: async (templateId, dishId) => {
    const response = await api.post('/modifiers/templates/apply', {
      templateId,
      dishId
    });
    return response.data;
  },

  // Синхронизировать все модификаторы с шаблоном
  syncTemplate: async (id) => {
    const response = await api.post(`/modifiers/templates/${id}/sync`);
    return response.data;
  }
};

export default modifierTemplateService;
