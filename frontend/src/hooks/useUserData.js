import { useState, useEffect, useCallback } from 'react';
import { create } from 'zustand';
import { authService } from '../services/authService';

// Global cache store — shared across all pages
const useUserDataStore = create((set) => ({
    userData: null,
    lastFetchedAt: 0,
    setUserData: (data) => set({ userData: data, lastFetchedAt: Date.now() }),
    clearUserData: () => set({ userData: null, lastFetchedAt: 0 }),
}));

const CACHE_TTL = 60 * 1000; // 1 minute cache

/**
 * Hook for loading and caching user data (userData from authService.getMe).
 * Caches globally in Zustand — navigating between pages won't re-fetch.
 * Call `refresh()` to force re-fetch after mutations.
 */
export const useUserData = () => {
    const { userData, lastFetchedAt, setUserData: setCachedData } = useUserDataStore();
    const [loading, setLoading] = useState(!userData);
    const [error, setError] = useState(null);

    const fetchUserData = useCallback(async (force = false) => {
        const now = Date.now();
        if (!force && userData && (now - lastFetchedAt) < CACHE_TTL) {
            setLoading(false);
            return userData;
        }

        setLoading(true);
        setError(null);
        try {
            const data = await authService.getMe();
            setCachedData(data);
            return data;
        } catch (err) {
            console.error('Error loading user data:', err);
            setError(err);
            return null;
        } finally {
            setLoading(false);
        }
    }, [userData, lastFetchedAt, setCachedData]);

    useEffect(() => {
        fetchUserData();
    }, []);

    const refresh = useCallback(() => fetchUserData(true), [fetchUserData]);

    return { userData, loading, error, refresh };
};

export default useUserData;
