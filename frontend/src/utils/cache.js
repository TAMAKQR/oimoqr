/**
 * Простое кэширование для меню ресторанов
 */

const CACHE_DURATION = 5 * 60 * 1000; // 5 минут
const cache = new Map();

/**
 * Получить данные из кэша
 * @param {string} key - ключ кэша
 * @returns {any|null} - данные или null если не найдено/истекло
 */
export const getFromCache = (key) => {
    const item = cache.get(key);

    if (!item) {
        return null;
    }

    // Проверяем не истек ли кэш
    if (Date.now() > item.expiry) {
        cache.delete(key);
        return null;
    }

    console.log(`💾 Cache HIT for ${key}`);
    return item.data;
};

/**
 * Сохранить данные в кэш
 * @param {string} key - ключ кэша
 * @param {any} data - данные для кэширования
 * @param {number} duration - длительность кэша в мс (по умолчанию 5 минут)
 */
export const setToCache = (key, data, duration = CACHE_DURATION) => {
    console.log(`💾 Cache SET for ${key}`);
    cache.set(key, {
        data,
        expiry: Date.now() + duration
    });
};

/**
 * Очистить кэш по ключу
 * @param {string} key - ключ кэша
 */
export const clearCache = (key) => {
    console.log(`💾 Cache CLEAR for ${key}`);
    cache.delete(key);
};

/**
 * Очистить весь кэш
 */
export const clearAllCache = () => {
    console.log('💾 Cache CLEAR ALL');
    cache.clear();
};

/**
 * Получить размер кэша
 * @returns {number} - количество элементов в кэше
 */
export const getCacheSize = () => {
    return cache.size;
};

/**
 * Автоматическая очистка истекших элементов кэша
 */
export const cleanupExpiredCache = () => {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, item] of cache.entries()) {
        if (now > item.expiry) {
            cache.delete(key);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        console.log(`💾 Cache cleaned: ${cleaned} expired items`);
    }
};

// Автоматическая очистка каждые 10 минут
setInterval(cleanupExpiredCache, 10 * 60 * 1000);
