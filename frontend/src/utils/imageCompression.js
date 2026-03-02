/**
 * Утилита для сжатия изображений перед загрузкой
 */

/**
 * Сжимает изображение до указанного максимального размера
 * @param {File} file - Исходный файл изображения
 * @param {Object} options - Опции сжатия
 * @param {number} options.maxWidth - Максимальная ширина (по умолчанию 1920)
 * @param {number} options.maxHeight - Максимальная высота (по умолчанию 1920)
 * @param {number} options.quality - Качество JPEG (0-1, по умолчанию 0.85)
 * @param {number} options.maxSizeMB - Максимальный размер в МБ (по умолчанию 1)
 * @returns {Promise<File>} - Сжатое изображение
 */
export const compressImage = async (file, options = {}) => {
    const {
        maxWidth = 1920,
        maxHeight = 1920,
        quality = 0.85,
        maxSizeMB = 1,
    } = options;

    const sourceType = (file?.type || '').toLowerCase();
    const hasAlpha = sourceType.includes('png') || sourceType.includes('webp') || sourceType.includes('gif');
    const outputType = hasAlpha ? 'image/webp' : 'image/jpeg';
    const fileExtension = hasAlpha ? 'webp' : 'jpg';

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();

            img.onload = () => {
                // Вычисляем новые размеры с сохранением пропорций
                let { width, height } = img;

                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = Math.floor(width * ratio);
                    height = Math.floor(height * ratio);
                }

                // Создаем canvas для сжатия
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Конвертируем в blob
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Ошибка сжатия изображения'));
                            return;
                        }

                        // Если размер все еще больше maxSizeMB, снижаем качество
                        const currentSizeMB = blob.size / 1024 / 1024;

                        if (currentSizeMB > maxSizeMB && quality > 0.5) {
                            // Рекурсивно сжимаем с меньшим качеством
                            compressImage(file, {
                                ...options,
                                quality: quality * 0.8
                            }).then(resolve).catch(reject);
                            return;
                        }

                        // Создаем новый File из blob
                        const originalBaseName = file.name.replace(/\.[^/.]+$/, '');
                        const compressedFile = new File([blob], `${originalBaseName}.${fileExtension}`, {
                            type: outputType,
                            lastModified: Date.now()
                        });

                        resolve(compressedFile);
                    },
                    outputType,
                    quality
                );
            };

            img.onerror = () => {
                reject(new Error('Ошибка загрузки изображения'));
            };

            img.src = e.target.result;
        };

        reader.onerror = () => {
            reject(new Error('Ошибка чтения файла'));
        };

        reader.readAsDataURL(file);
    });
};

/**
 * Форматирует размер в байтах в читаемый вид
 * @param {number} bytes - Размер в байтах
 * @returns {string} - Форматированный размер
 */
export const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Валидирует изображение
 * @param {File} file - Файл для валидации
 * @param {Object} options - Опции валидации
 * @returns {Object} - Результат валидации {valid: boolean, error: string}
 */
export const validateImage = (file, options = {}) => {
    const {
        maxSizeMB = 10,
        allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    } = options;

    // Проверка типа файла
    if (!allowedTypes.includes(file.type)) {
        return {
            valid: false,
            error: `Неподдерживаемый формат. Разрешены: ${allowedTypes.join(', ')}`
        };
    }

    // Проверка размера
    const sizeMB = file.size / 1024 / 1024;
    if (sizeMB > maxSizeMB) {
        return {
            valid: false,
            error: `Файл слишком большой (${sizeMB.toFixed(2)} МБ). Максимум: ${maxSizeMB} МБ`
        };
    }

    return { valid: true };
};

/**
 * Проверяет, нужно ли сжимать изображение
 * @param {File} file - Файл изображения
 * @param {number} thresholdMB - Порог в МБ (по умолчанию 1)
 * @returns {boolean}
 */
export const shouldCompress = (file, thresholdMB = 1) => {
    const sizeMB = file.size / 1024 / 1024;
    return sizeMB > thresholdMB;
};
