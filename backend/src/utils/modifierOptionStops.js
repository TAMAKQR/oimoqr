import { prisma } from '../config/prisma.js';

const getEffectiveStopRestaurantIds = (restaurantId, menuSourceRestaurantId) => {
    const sourceId = menuSourceRestaurantId || restaurantId;
    if (sourceId && sourceId !== restaurantId) {
        return [sourceId, restaurantId];
    }
    return [restaurantId];
};

const looksLikeMissingTableError = (error) => {
    const message = String(error?.message || '').toLowerCase();
    return message.includes('modifieroptionstop') && (
        message.includes('does not exist')
        || message.includes('no such table')
        || message.includes('unknown table')
    );
};

export const loadModifierOptionStops = async ({
    restaurantId,
    menuSourceRestaurantId,
    modifierOptionIds
}) => {
    const localStoppedOptionIds = new Set();
    const sourceStoppedOptionIds = new Set();
    const stopByOption = new Map();

    const effectiveStopRestaurantIds = getEffectiveStopRestaurantIds(restaurantId, menuSourceRestaurantId);
    const sourceRestaurantId = menuSourceRestaurantId || restaurantId;

    if (!restaurantId || !sourceRestaurantId) {
        return {
            effectiveStopRestaurantIds,
            localStoppedOptionIds,
            sourceStoppedOptionIds,
            stopByOption
        };
    }

    try {
        const where = {
            restaurantId: { in: effectiveStopRestaurantIds },
            isStopped: true,
            modifierOption: {
                modifier: {
                    dish: {
                        restaurantId: sourceRestaurantId
                    }
                }
            }
        };

        const uniqueOptionIds = Array.isArray(modifierOptionIds)
            ? [...new Set(modifierOptionIds.filter(Boolean))]
            : [];

        if (uniqueOptionIds.length > 0) {
            where.modifierOptionId = { in: uniqueOptionIds };
        }

        const stopRows = await prisma.modifierOptionStop.findMany({
            where,
            select: {
                modifierOptionId: true,
                reason: true,
                restaurantId: true,
                modifierOption: {
                    select: {
                        name: true
                    }
                }
            }
        });

        stopRows.forEach((stop) => {
            const optionId = stop.modifierOptionId;
            const isLocalStop = stop.restaurantId === restaurantId;

            if (isLocalStop) {
                localStoppedOptionIds.add(optionId);
            }
            if (stop.restaurantId === sourceRestaurantId) {
                sourceStoppedOptionIds.add(optionId);
            }

            const existing = stopByOption.get(optionId);
            if (!existing || isLocalStop) {
                stopByOption.set(optionId, {
                    reason: stop.reason || null,
                    restaurantId: stop.restaurantId,
                    name: stop.modifierOption?.name || null
                });
            }
        });
    } catch (error) {
        if (!looksLikeMissingTableError(error)) {
            throw error;
        }
        console.warn('⚠️ ModifierOptionStop table is missing, skipping option stop checks');
    }

    return {
        effectiveStopRestaurantIds,
        localStoppedOptionIds,
        sourceStoppedOptionIds,
        stopByOption
    };
};

