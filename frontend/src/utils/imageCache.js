/**
 * Добавляет timestamp к URL изображения для обхода кэша браузера
 * @param {string} url - URL изображения
 * @param {boolean} forceRefresh - Принудительно обновить (добавить новый timestamp)
 * @returns {string} - URL с параметром timestamp
 */
export const cacheBustImage = (url, forceRefresh = false) => {
    if (!url) return url;

    // Если это blob URL, возвращаем как есть
    if (url.startsWith('blob:')) return url;

    // Если forceRefresh = true, всегда добавляем новый timestamp
    if (forceRefresh) {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}t=${Date.now()}`;
    }

    // Если URL уже содержит параметр t=, возвращаем как есть
    if (url.includes('?t=') || url.includes('&t=')) {
        return url;
    }

    // Добавляем timestamp только при первой загрузке
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}t=${Date.now()}`;
};

/**
 * Очищает кэш изображения принудительной перезагрузкой
 * @param {string} url - URL изображения
 */
export const refreshImage = (url) => {
    if (!url) return;

    // Создаем новый Image объект для принудительной загрузки
    const img = new Image();
    img.src = cacheBustImage(url, true);
};
