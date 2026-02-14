import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token (prioritize customer token for /customers*)
api.interceptors.request.use(
  (config) => {
    const url = config.url || '';
    // Only treat paths starting with /customers as customer-facing endpoints
    // Admin endpoint /restaurants/:id/customers should use admin token
    const isCustomerEndpoint = /^\/customers(\?|\/|$)/.test(url);

    if (isCustomerEndpoint) {
      const customerToken = localStorage.getItem('customer-token') || localStorage.getItem('customerToken');
      if (customerToken) {
        config.headers.Authorization = `Bearer ${customerToken}`;
      } else {
        delete config.headers.Authorization;
      }
    } else {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const { state } = JSON.parse(authStorage);
        if (state.token) {
          config.headers.Authorization = `Bearer ${state.token}`;
        }
      }

      if (!config.headers.Authorization) {
        const customerToken = localStorage.getItem('customer-token') || localStorage.getItem('customerToken');
        if (customerToken) {
          config.headers.Authorization = `Bearer ${customerToken}`;
        }
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      // Only treat paths starting with /customers as customer-facing endpoints
      const isCustomerEndpoint = /^\/customers(\?|\/|$)/.test(url);
      const isCustomerAuth = url.includes('/customers/login') || url.includes('/customers/register');

      if (isCustomerEndpoint) {
        // clear customer storages
        localStorage.removeItem('customer-token');
        localStorage.removeItem('customerToken');
        localStorage.removeItem('customer');
        localStorage.removeItem('customer-auth-storage');

        // do not redirect on auth endpoints (let UI show error)
        if (!isCustomerAuth) {
          window.location.href = '/customer/login';
        }
      } else {
        // admin/default flow
        localStorage.removeItem('auth-storage');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;