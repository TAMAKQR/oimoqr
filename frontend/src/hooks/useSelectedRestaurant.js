import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * Hook for managing selectedRestaurantId with localStorage persistence.
 * Auto-selects first restaurant from userData if nothing saved.
 * 
 * @param {Object} userData - User data from useUserData()
 * @returns {{ selectedRestaurantId, setSelectedRestaurantId, allRestaurants, selectedRestaurant }}
 */
export const useSelectedRestaurant = (userData) => {
    const [selectedRestaurantId, setSelectedRestaurantIdState] = useState(() => {
        return localStorage.getItem('selectedRestaurantId') || null;
    });

    // All restaurants (owned + staff)
    const allRestaurants = useMemo(() => {
        if (!userData) return [];
        return [
            ...(userData.restaurants || []),
            ...(userData.restaurantStaff?.map(s => s.restaurant) || [])
        ];
    }, [userData]);

    // Auto-select logic
    useEffect(() => {
        if (!userData) return;

        if (allRestaurants.length > 0) {
            const savedId = localStorage.getItem('selectedRestaurantId');
            const savedExists = savedId && allRestaurants.some(r => r.id === savedId);

            if (savedExists) {
                if (selectedRestaurantId !== savedId) {
                    setSelectedRestaurantIdState(savedId);
                }
            } else if (!selectedRestaurantId || !allRestaurants.some(r => r.id === selectedRestaurantId)) {
                const firstId = allRestaurants[0].id;
                setSelectedRestaurantIdState(firstId);
                localStorage.setItem('selectedRestaurantId', firstId);
            }
        } else {
            setSelectedRestaurantIdState(null);
            localStorage.removeItem('selectedRestaurantId');
        }
    }, [userData, allRestaurants]);

    // Setter that also persists to localStorage
    const setSelectedRestaurantId = useCallback((id) => {
        setSelectedRestaurantIdState(id);
        if (id) {
            localStorage.setItem('selectedRestaurantId', id);
        } else {
            localStorage.removeItem('selectedRestaurantId');
        }
    }, []);

    // Get the full restaurant object for selectedRestaurantId
    const selectedRestaurant = useMemo(() => {
        if (!userData || !selectedRestaurantId) return null;
        const owned = userData.restaurants?.find(r => r.id === selectedRestaurantId);
        if (owned) return owned;
        const staff = userData.restaurantStaff?.find(s => s.restaurant.id === selectedRestaurantId);
        return staff?.restaurant || null;
    }, [userData, selectedRestaurantId]);

    // Check if current user is owner of selected restaurant
    const isOwner = useMemo(() => {
        if (!userData || !selectedRestaurantId) return false;
        return userData.restaurants?.some(r => r.id === selectedRestaurantId) || false;
    }, [userData, selectedRestaurantId]);

    return {
        selectedRestaurantId,
        setSelectedRestaurantId,
        allRestaurants,
        selectedRestaurant,
        isOwner,
    };
};

export default useSelectedRestaurant;
