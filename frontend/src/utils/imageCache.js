/**
 * Возвращает URL изображения. Не добавляет timestamp для клиентского меню,
 * чтобы браузер мог использовать кэш и изображения загружались мгновенно.
 * @param {string} url - URL изображения
 * @param {boolean} forceRefresh - Принудительно обновить (добавить новый timestamp)
 * @returns {string} - URL изображения
 */
export const cacheBustImage = (url, forceRefresh = false) => {
    if (!url) return url;

    let options = {};
    let shouldForceRefresh = forceRefresh;

    if (typeof forceRefresh === 'object' && forceRefresh !== null) {
        options = forceRefresh;
        shouldForceRefresh = false;
    }

    const {
        width,
        height,
        quality = 'auto:good',
        format = 'auto'
    } = options;

    // Если это blob URL, возвращаем как есть
    if (url.startsWith('blob:')) return url;

    // Cloudinary optimization (only when URL has no explicit transformation yet)
    let resultUrl = url;
    if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
        const [baseWithoutQuery, queryPart] = url.split('?');
        const uploadMarker = '/upload/';
        const markerIndex = baseWithoutQuery.indexOf(uploadMarker);

        if (markerIndex !== -1) {
            const prefix = baseWithoutQuery.slice(0, markerIndex + uploadMarker.length);
            const suffix = baseWithoutQuery.slice(markerIndex + uploadMarker.length);
            const firstSegment = suffix.split('/')[0] || '';

            const hasTransformations = firstSegment.includes('_') || firstSegment.includes(',');

            if (!hasTransformations) {
                const transformations = [];
                if (format) transformations.push(`f_${format}`);
                if (quality) transformations.push(`q_${quality}`);
                if (width) transformations.push(`w_${width}`);
                if (height) transformations.push(`h_${height}`);
                transformations.push('c_limit');

                const transformedBase = `${prefix}${transformations.join(',')}/${suffix}`;
                resultUrl = queryPart ? `${transformedBase}?${queryPart}` : transformedBase;
            }
        }
    }

    // Если forceRefresh = true, всегда добавляем новый timestamp (для админки после загрузки нового фото)
    if (shouldForceRefresh) {
        const separator = resultUrl.includes('?') ? '&' : '?';
        return `${resultUrl}${separator}t=${Date.now()}`;
    }

    // Не добавляем timestamp — пусть браузер кэширует изображения
    return resultUrl;
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
