import api from './api';

const customerService = {
    // ============================================
    // Аутентификация
    // ============================================

    async register(phone, name, password, restaurantId) {
        const response = await api.post('/customers/register', {
            phone,
            name,
            password,
            restaurantId
        });
        if (response.data.token) {
            localStorage.setItem('customer-token', response.data.token);
            localStorage.setItem('customerToken', response.data.token); // legacy key for compatibility
            localStorage.setItem('customer', JSON.stringify(response.data.customer));
        }
        return response.data;
    },

    async login(phone, password, restaurantId) {
        const response = await api.post('/customers/login', {
            phone,
            password,
            restaurantId
        });
        if (response.data.token) {
            localStorage.setItem('customer-token', response.data.token);
            localStorage.setItem('customerToken', response.data.token); // legacy key for compatibility
            localStorage.setItem('customer', JSON.stringify(response.data.customer));
        }
        return response.data;
    },

    logout() {
        localStorage.removeItem('customer-token');
        localStorage.removeItem('customerToken');
        localStorage.removeItem('customer');
    },

    getToken() {
        return localStorage.getItem('customer-token') || localStorage.getItem('customerToken');
    },

    isAuthenticated() {
        return !!this.getToken();
    },

    getCurrentCustomerData() {
        // Try explicit customer cache
        const data = localStorage.getItem('customer');
        if (data) return JSON.parse(data);

        // Fallback to zustand persisted store
        const persisted = localStorage.getItem('customer-auth-storage');
        if (persisted) {
            try {
                const parsed = JSON.parse(persisted);
                return parsed?.state?.customer || null;
            } catch (e) {
                return null;
            }
        }
        return null;
    },

    // ============================================
    // Профиль
    // ============================================

    async getProfile() {
        const response = await api.get('/customers/profile', {
            headers: {
                Authorization: `Bearer ${this.getToken()}`
            }
        });
        localStorage.setItem('customer', JSON.stringify(response.data));
        return response.data;
    },

    async updateProfile(data) {
        const response = await api.put('/customers/profile', data, {
            headers: {
                Authorization: `Bearer ${this.getToken()}`
            }
        });
        localStorage.setItem('customer', JSON.stringify(response.data.customer));
        return response.data;
    },

    async changePassword(currentPassword, newPassword) {
        const response = await api.post('/customers/change-password', {
            currentPassword,
            newPassword
        }, {
            headers: {
                Authorization: `Bearer ${this.getToken()}`
            }
        });
        return response.data;
    },

    // ============================================
    // История заказов
    // ============================================

    async getOrderHistory(limit = 20, offset = 0) {
        const response = await api.get(`/customers/orders?limit=${limit}&offset=${offset}`, {
            headers: {
                Authorization: `Bearer ${this.getToken()}`
            }
        });
        return response.data;
    },

    // ============================================
    // Рестораны клиента
    // ============================================

    async getMyRestaurants() {
        const response = await api.get('/customers/restaurants', {
            headers: {
                Authorization: `Bearer ${this.getToken()}`
            }
        });
        return response.data;
    },

    // ============================================
    // Избранное
    // ============================================

    async getFavorites() {
        const response = await api.get('/customers/favorites', {
            headers: {
                Authorization: `Bearer ${this.getToken()}`
            }
        });
        return response.data;
    },

    async addToFavorites(dishId) {
        const response = await api.post('/customers/favorites', { dishId }, {
            headers: {
                Authorization: `Bearer ${this.getToken()}`
            }
        });
        return response.data;
    },

    async removeFromFavorites(dishId) {
        const response = await api.delete(`/customers/favorites/${dishId}`, {
            headers: {
                Authorization: `Bearer ${this.getToken()}`
            }
        });
        return response.data;
    },

    // ============================================
    // Адреса
    // ============================================

    async addAddress(address) {
        const response = await api.post('/customers/addresses', address, {
            headers: {
                Authorization: `Bearer ${this.getToken()}`
            }
        });
        return response.data;
    },

    async updateAddress(addressId, data) {
        const response = await api.put(`/customers/addresses/${addressId}`, data, {
            headers: {
                Authorization: `Bearer ${this.getToken()}`
            }
        });
        return response.data;
    },

    async deleteAddress(addressId) {
        const response = await api.delete(`/customers/addresses/${addressId}`, {
            headers: {
                Authorization: `Bearer ${this.getToken()}`
            }
        });
        return response.data;
    }
};

export default customerService;
