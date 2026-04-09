const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const toMinutes = (value) => {
    if (!value || typeof value !== 'string' || !value.includes(':')) return null;

    const [hours, minutes] = value.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

    return hours * 60 + minutes;
};

const normalizeEntry = (entry) => {
    if (!entry || typeof entry !== 'object') return null;

    return {
        open: entry.open || entry.openTime || '',
        close: entry.close || entry.closeTime || '',
        isOpen: Boolean(entry.isOpen),
        is247: Boolean(entry.is247)
    };
};

export const normalizeSchedule = (schedule) => {
    if (!schedule) return null;

    let parsed = schedule;

    if (typeof parsed === 'string') {
        try {
            parsed = JSON.parse(parsed);
        } catch {
            return null;
        }
    }

    if (Array.isArray(parsed)) {
        return parsed.reduce((accumulator, item) => {
            if (!item?.day) return accumulator;
            accumulator[item.day] = normalizeEntry(item);
            return accumulator;
        }, {});
    }

    if (typeof parsed !== 'object') return null;

    return Object.entries(parsed).reduce((accumulator, [day, entry]) => {
        accumulator[day] = normalizeEntry(entry);
        return accumulator;
    }, {});
};

const getDayKey = (date) => DAY_KEYS[date.getDay()];

const getPreviousDayKey = (date) => DAY_KEYS[(date.getDay() + 6) % 7];

const isEntryOpenAt = (entry, currentMinutes) => {
    if (!entry?.isOpen) return false;
    if (entry.is247) return true;

    const openMinutes = toMinutes(entry.open);
    const closeMinutes = toMinutes(entry.close);

    if (openMinutes === null || closeMinutes === null) return true;
    if (openMinutes === closeMinutes) return true;

    if (closeMinutes > openMinutes) {
        return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
    }

    return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
};

const getOvernightPreviousDayEntry = (schedule, now) => {
    const previousDayKey = getPreviousDayKey(now);
    const previousDayEntry = schedule?.[previousDayKey];

    if (!previousDayEntry?.isOpen || previousDayEntry?.is247) return null;

    const openMinutes = toMinutes(previousDayEntry.open);
    const closeMinutes = toMinutes(previousDayEntry.close);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    if (openMinutes === null || closeMinutes === null) return null;
    if (closeMinutes >= openMinutes) return null;

    if (currentMinutes < closeMinutes) {
        return {
            day: previousDayKey,
            entry: previousDayEntry
        };
    }

    return null;
};

export const getScheduleStatus = (schedule, options = {}) => {
    const {
        now = new Date(),
        temporarilyClosed = false,
        closedMessage = 'Временно закрыто',
        defaultOpen = true
    } = options;

    if (temporarilyClosed) {
        return {
            isOpen: false,
            message: closedMessage,
            currentDay: getDayKey(now),
            todaySchedule: null,
            isConfigured: Boolean(schedule)
        };
    }

    const normalizedSchedule = normalizeSchedule(schedule);
    if (!normalizedSchedule || Object.keys(normalizedSchedule).length === 0) {
        return {
            isOpen: defaultOpen,
            message: '',
            currentDay: getDayKey(now),
            todaySchedule: null,
            isConfigured: false
        };
    }

    const currentDay = getDayKey(now);
    const todaySchedule = normalizedSchedule[currentDay] || null;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const previousDayOvernight = getOvernightPreviousDayEntry(normalizedSchedule, now);

    if (previousDayOvernight && isEntryOpenAt(previousDayOvernight.entry, currentMinutes)) {
        return {
            isOpen: true,
            message: previousDayOvernight.entry.is247 ? 'Круглосуточно' : `Открыто до ${previousDayOvernight.entry.close}`,
            currentDay,
            todaySchedule,
            activeScheduleDay: previousDayOvernight.day,
            isConfigured: true
        };
    }

    if (!todaySchedule?.isOpen) {
        return {
            isOpen: false,
            message: 'Сегодня выходной',
            currentDay,
            todaySchedule,
            isConfigured: true
        };
    }

    if (todaySchedule.is247) {
        return {
            isOpen: true,
            message: 'Круглосуточно',
            currentDay,
            todaySchedule,
            activeScheduleDay: currentDay,
            isConfigured: true
        };
    }

    const openMinutes = toMinutes(todaySchedule.open);
    const closeMinutes = toMinutes(todaySchedule.close);

    if (openMinutes === null || closeMinutes === null) {
        return {
            isOpen: true,
            message: '',
            currentDay,
            todaySchedule,
            activeScheduleDay: currentDay,
            isConfigured: true
        };
    }

    if (isEntryOpenAt(todaySchedule, currentMinutes)) {
        return {
            isOpen: true,
            message: `Открыто до ${todaySchedule.close}`,
            currentDay,
            todaySchedule,
            activeScheduleDay: currentDay,
            isConfigured: true
        };
    }

    if (closeMinutes > openMinutes && currentMinutes < openMinutes) {
        return {
            isOpen: false,
            message: `Откроется в ${todaySchedule.open}`,
            currentDay,
            todaySchedule,
            isConfigured: true
        };
    }

    return {
        isOpen: false,
        message: 'Сейчас закрыто',
        currentDay,
        todaySchedule,
        isConfigured: true
    };
};

export const getEffectiveDeliverySchedule = (restaurant) => restaurant?.deliveryHours || restaurant?.workingHours || null;

export const getRestaurantOpenStatus = (restaurant, now = new Date()) => getScheduleStatus(restaurant?.workingHours, {
    now,
    temporarilyClosed: Boolean(restaurant?.isTemporarilyClosed),
    closedMessage: restaurant?.closureReason || 'Временно закрыто'
});

export const getRestaurantDeliveryStatus = (restaurant, now = new Date()) => getScheduleStatus(getEffectiveDeliverySchedule(restaurant), {
    now,
    defaultOpen: true
});