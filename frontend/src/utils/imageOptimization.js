/**
 * Утилиты для оптимизации загрузки изображений
 */

/**
 * Генерирует srcset для responsive изображений
 * @param {string} baseUrl - базовый URL изображения
 * @param {number[]} widths - массив ширин для генерации
 * @returns {string} srcset строка
 */
export const generateSrcSet = (baseUrl, widths = [320, 640, 960, 1280]) => {
    return widths.map(width => `${baseUrl}?w=${width} ${width}w`).join(', ');
};

/**
 * Генерирует sizes атрибут для изображения
 * @param {Object} breakpoints - объект с брейкпоинтами
 * @returns {string} sizes строка
 */
export const generateSizes = (breakpoints = {
    mobile: '100vw',
    tablet: '50vw',
    desktop: '33vw'
}) => {
    return `
    (max-width: 640px) ${breakpoints.mobile || '100vw'},
    (max-width: 1024px) ${breakpoints.tablet || '50vw'},
    ${breakpoints.desktop || '33vw'}
  `.trim();
};

/**
 * Предзагружает изображение
 * @param {string} src - URL изображения
 * @returns {Promise<void>}
 */
export const preloadImage = (src) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
};

/**
 * Предзагружает массив изображений
 * @param {string[]} sources - массив URL изображений
 * @returns {Promise<void[]>}
 */
export const preloadImages = (sources) => {
    return Promise.all(sources.map(preloadImage));
};

/**
 * Определяет оптимальный формат изображения для браузера
 * @returns {string} - формат изображения (webp, avif, или jpg)
 */
export const getSupportedImageFormat = () => {
    const canvas = document.createElement('canvas');
    if (canvas.getContext && canvas.getContext('2d')) {
        // Проверка поддержки WebP
        if (canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0) {
            return 'webp';
        }
    }
    return 'jpg';
};

/**
 * Добавляет параметры оптимизации к URL изображения
 * @param {string} url - URL изображения
 * @param {Object} options - опции оптимизации
 * @returns {string} оптимизированный URL
 */
export const optimizeImageUrl = (url, options = {}) => {
    const {
        width,
        height,
        quality = 80,
        format = 'auto'
    } = options;

    if (!url) return '';

    // Если это Cloudinary URL, добавляем параметры трансформации
    if (url.includes('cloudinary.com')) {
        const transformations = [];
        if (width) transformations.push(`w_${width}`);
        if (height) transformations.push(`h_${height}`);
        transformations.push(`q_${quality}`);
        if (format !== 'auto') transformations.push(`f_${format}`);
        transformations.push('c_limit'); // Ограничиваем размер, сохраняя пропорции

        const transformString = transformations.join(',');
        return url.replace('/upload/', `/upload/${transformString}/`);
    }

    return url;
};

/**
 * Создает placeholder для изображения (base64)
 * @param {number} width - ширина
 * @param {number} height - высота
 * @param {string} color - цвет в hex
 * @returns {string} data URL
 */
export const createPlaceholder = (width = 10, height = 10, color = '#f3f4f6') => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    return canvas.toDataURL();
};

/**
 * Intersection Observer опции для lazy loading
 */
export const lazyLoadOptions = {
    root: null,
    rootMargin: '50px', // Загружаем за 50px до видимости
    threshold: 0.01
};
