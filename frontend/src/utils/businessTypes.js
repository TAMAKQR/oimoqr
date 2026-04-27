/**
 * Business type configuration
 * Central config for all business type labels, icons, routes, colors
 */

export const BUSINESS_TYPES = {
    RESTAURANT: {
        key: 'RESTAURANT',
        icon: '🍽',
        label: 'Ресторан',
        route: 'menu',
        color: 'blue',
        namePlaceholder: "Пиццерия 'Мамино'",
        subdomainPlaceholder: 'mamino-pizza',
        nameLabel: 'Название ресторана',
        viewLabel: 'Посмотреть меню',
        overviewLabel: 'Обзор вашего ресторана',
        qrLabel: 'QR-код меню',
        qrScanLabel: 'просмотра меню',
        qrDescription: 'QR-коды для вашего меню. Общий — для доставки/самовывоза, по столам — для dine-in.',
        qrMainTitle: 'Общий QR-код',
        qrMainDescription: 'Для доставки и самовывоза — без привязки к столу',
        itemsLabel: 'Блюда',
        popularLabel: 'Популярные блюда',
        tip: '💡 Совет: Добавьте фото к блюдам — это увеличивает конверсию на 30%!',
        hasTableQR: true,
        tableLabel: 'Стол',
    },
    ONLINE_STORE: {
        key: 'ONLINE_STORE',
        icon: '🛍',
        label: 'Магазин',
        route: 'shop',
        color: 'purple',
        namePlaceholder: "Магазин 'Свежесть'",
        subdomainPlaceholder: 'my-store',
        nameLabel: 'Название магазина',
        viewLabel: 'Посмотреть магазин',
        overviewLabel: 'Обзор вашего магазина',
        qrLabel: 'QR-код магазина',
        qrScanLabel: 'перехода в магазин',
        qrDescription: 'QR-код для вашего магазина. Клиенты могут отсканировать его для быстрого перехода.',
        qrMainTitle: 'QR-код магазина',
        qrMainDescription: 'Ссылка на ваш интернет-магазин',
        itemsLabel: 'Товары',
        popularLabel: 'Популярные товары',
        tip: '💡 Совет: Добавьте фото к товарам и укажите акционные цены для привлечения клиентов!',
        hasTableQR: false,
        tableLabel: null,
    },
    HOTEL: {
        key: 'HOTEL',
        icon: '🏨',
        label: 'Отель',
        route: 'menu',
        color: 'green',
        namePlaceholder: "Отель 'Гранд'",
        subdomainPlaceholder: 'grand-hotel',
        nameLabel: 'Название отеля',
        viewLabel: 'Посмотреть меню отеля',
        overviewLabel: 'Обзор вашего отеля',
        qrLabel: 'QR-код отеля',
        qrScanLabel: 'просмотра меню отеля',
        qrDescription: 'QR-коды для рум-сервиса. Общий — для лобби, по номерам — для комнат.',
        qrMainTitle: 'Общий QR-код',
        qrMainDescription: 'Для лобби и общих зон',
        itemsLabel: 'Блюда',
        popularLabel: 'Популярные блюда',
        tip: '💡 Совет: Разместите QR-коды в номерах для быстрого доступа к меню рум-сервиса!',
        hasTableQR: true,
        tableLabel: 'Комната',
    },
};

/**
 * Get business type config, fallback to RESTAURANT
 */
export const getBusinessType = (type) => {
    if (!type || typeof type !== 'string') return BUSINESS_TYPES.RESTAURANT;
    const normalizedType = type.trim().toUpperCase();
    return BUSINESS_TYPES[normalizedType] || BUSINESS_TYPES.RESTAURANT;
};

/**
 * All business type keys
 */
export const BUSINESS_TYPE_KEYS = Object.keys(BUSINESS_TYPES);

/**
 * Business types for selector UI (create restaurant modal, etc.)
 */
// На текущих тарифах разрешаем создавать только рестораны (магазин/отель скрыты)
export const BUSINESS_TYPE_OPTIONS = [
    {
        key: BUSINESS_TYPES.RESTAURANT.key,
        icon: BUSINESS_TYPES.RESTAURANT.icon,
        label: BUSINESS_TYPES.RESTAURANT.label,
        color: BUSINESS_TYPES.RESTAURANT.color,
    }
];
