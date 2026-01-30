import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useCustomerAuthStore = create(
    persist(
        (set) => ({
            customer: null,
            token: null,
            restaurant: null,

            setAuth: (customer, token, restaurant = null) => {
                set({ customer, token, restaurant });
                if (token) {
                    localStorage.setItem('customer-token', token);
                    // legacy key for compatibility with older parts of the app
                    localStorage.setItem('customerToken', token);
                }
                if (customer) {
                    // cache for services/pages that read directly from localStorage
                    localStorage.setItem('customer', JSON.stringify(customer));
                    // legacy keys used by some older flows
                    localStorage.setItem('customer-data', JSON.stringify(customer));
                    localStorage.setItem('customerData', JSON.stringify(customer));
                }
            },

            setRestaurant: (restaurant) => {
                set({ restaurant });
            },

            logout: () => {
                set({ customer: null, token: null, restaurant: null });
                localStorage.removeItem('customer-token');
                localStorage.removeItem('customerToken');
                localStorage.removeItem('customer');
                localStorage.removeItem('customer-data');
                localStorage.removeItem('customerData');
            },
        }),
        {
            name: 'customer-auth-storage',
        }
    )
);
