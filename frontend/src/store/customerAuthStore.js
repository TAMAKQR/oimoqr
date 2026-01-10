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
                }
            },

            setRestaurant: (restaurant) => {
                set({ restaurant });
            },

            logout: () => {
                set({ customer: null, token: null, restaurant: null });
                localStorage.removeItem('customer-token');
            },
        }),
        {
            name: 'customer-auth-storage',
        }
    )
);
