const BUSINESS_TYPES = {
    RESTAURANT: {
        key: 'RESTAURANT',
        label: 'Ресторан / кафе',
        tableLabel: 'Стол',
    },
    HOTEL: {
        key: 'HOTEL',
        label: 'Отель',
        tableLabel: 'Комната',
    },
    CAFE: {
        key: 'CAFE',
        label: 'Кафе',
        tableLabel: 'Столик',
    },
    FAST_FOOD: {
        key: 'FAST_FOOD',
        label: 'Фаст-фуд',
        tableLabel: 'Столик',
    },
};

export function getBusinessType(key) {
    return BUSINESS_TYPES[key] || BUSINESS_TYPES.RESTAURANT;
}

export default BUSINESS_TYPES;
