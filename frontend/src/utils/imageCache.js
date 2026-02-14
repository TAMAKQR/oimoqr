/**
 * Возвращает URL изображения. Не добавляет timestamp для клиентского меню,
 * чтобы браузер мог использовать кэш и изображения загружались мгновенно.
 * @param {string} url - URL изображения
 * @param {boolean} forceRefresh - Принудительно обновить (добавить новый timestamp)
 * @returns {string} - URL изображения
 */
export const cacheBustImage = (url, forceRefresh = false) => {
    if (!url) return url;

    // Если это blob URL, возвращаем как есть
    if (url.startsWith('blob:')) return url;

    // Если forceRefresh = true, всегда добавляем новый timestamp (для админки после загрузки нового фото)
    if (forceRefresh) {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}t=${Date.now()}`;
    }

    // Не добавляем timestamp — пусть браузер кэширует изображения
    return url;
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
