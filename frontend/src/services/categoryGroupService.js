import api from './api';

export const categoryGroupService = {
    // Получить все группы категорий для ресторана
    async getCategoryGroups(restaurantId) {
        const response = await api.get(`/restaurants/${restaurantId}/groups`);
        return response.data;
    },

    // Создать группу категорий
    async createCategoryGroup(restaurantId, data) {
        const response = await api.post(`/restaurants/${restaurantId}/groups`, data);
        return response.data;
    },

    // Обновить группу категорий
    async updateCategoryGroup(groupId, data) {
        const response = await api.put(`/restaurants/groups/${groupId}`, data);
        return response.data;
    },

    // Удалить группу категорий
    async deleteCategoryGroup(groupId) {
        const response = await api.delete(`/restaurants/groups/${groupId}`);
        return response.data;
    },

    // Загрузить изображение для группы
    async uploadGroupImage(groupId, file, onProgress) {
        const formData = new FormData();
        formData.append('image', file);

        const response = await api.post(`/restaurants/groups/${groupId}/image`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: (progressEvent) => {
                if (onProgress) {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    onProgress(percentCompleted);
                }
            },
        });

        return response.data;
    }
};
