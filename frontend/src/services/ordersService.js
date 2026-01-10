import api from './api';

export const ordersService = {
    async getOrder(orderId) {
        try {
            const response = await api.get(`/orders/${orderId}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching order details:', error);
            throw error.response?.data || error.message;
        }
    },

    async updateStatus(orderId, status) {
        try {
            const response = await api.patch(`/orders/${orderId}/status`, { status });
            return response.data;
        } catch (error) {
            console.error('Error updating order status:', error);
            throw error.response?.data || error.message;
        }
    }
};
