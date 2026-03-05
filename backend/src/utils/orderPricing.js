import { prisma } from '../config/prisma.js';
import { getModifierOptionSelect } from './modifierOptionFields.js';

const roundCurrency = (value) => Number((Number(value) || 0).toFixed(2));

const isDeliveryLike = (deliveryType) => String(deliveryType || '').toLowerCase() !== 'dine_in';

export const calculateDeliveryFee = ({ deliveryType, itemsSubtotal, restaurantPricing }) => {
    if (String(deliveryType || '').toLowerCase() !== 'delivery') {
        return 0;
    }

    const deliveryFee = Number(restaurantPricing?.deliveryFee || 0);
    const freeDeliveryThreshold = Number(restaurantPricing?.freeDeliveryThreshold || 0);

    if (freeDeliveryThreshold > 0 && itemsSubtotal >= freeDeliveryThreshold) {
        return 0;
    }

    return Number.isFinite(deliveryFee) && deliveryFee > 0 ? roundCurrency(deliveryFee) : 0;
};

export const buildTrustedOrderItems = async ({ items, menuSourceRestaurantId, deliveryType }) => {
    const validItems = Array.isArray(items) ? items.filter((item) => item && item.id) : [];
    if (validItems.length === 0) {
        return { ok: false, error: 'Order must contain at least one valid dish item' };
    }

    const dishIds = [...new Set(validItems.map((item) => item.id))];
    const dishes = await prisma.dish.findMany({
        where: {
            id: { in: dishIds },
            restaurantId: menuSourceRestaurantId
        },
        select: {
            id: true,
            price: true,
            deliveryPrice: true
        }
    });

    if (dishes.length !== dishIds.length) {
        const foundIds = new Set(dishes.map((dish) => dish.id));
        const notFoundIds = dishIds.filter((id) => !foundIds.has(id));
        return { ok: false, error: `One or more dishes not found: ${notFoundIds.join(', ')}` };
    }

    const dishById = new Map(dishes.map((dish) => [dish.id, dish]));

    const allModifierIds = [...new Set(validItems.flatMap((item) => {
        if (!Array.isArray(item.selectedModifiers)) return [];
        const malformed = item.selectedModifiers.some((modifier) => !modifier || !modifier.id);
        if (malformed) {
            return ['__invalid_modifier__'];
        }
        return item.selectedModifiers.map((modifier) => modifier.id);
    }))];

    if (allModifierIds.includes('__invalid_modifier__')) {
        return { ok: false, error: 'Selected modifiers payload is invalid' };
    }

    const modifierOptionIds = allModifierIds.filter(Boolean);
    const modifierOptionSelect = await getModifierOptionSelect();
    const modifierOptions = modifierOptionIds.length > 0
        ? await prisma.modifierOption.findMany({
            where: {
                id: { in: modifierOptionIds }
            },
            select: {
                ...modifierOptionSelect,
                modifier: {
                    select: {
                        dishId: true
                    }
                }
            }
        })
        : [];

    if (modifierOptions.length !== modifierOptionIds.length) {
        const foundModifierIds = new Set(modifierOptions.map((option) => option.id));
        const notFoundModifierIds = modifierOptionIds.filter((id) => !foundModifierIds.has(id));
        return { ok: false, error: `Invalid modifier options: ${notFoundModifierIds.join(', ')}` };
    }

    const optionById = new Map(modifierOptions.map((option) => [option.id, option]));

    const trustedItems = [];
    let itemsSubtotal = 0;

    for (const item of validItems) {
        const dish = dishById.get(item.id);
        if (!dish) {
            return { ok: false, error: `Dish not found: ${item.id}` };
        }

        const quantity = parseInt(item.quantity, 10);
        if (!Number.isFinite(quantity) || quantity <= 0) {
            return { ok: false, error: `Invalid quantity for dish: ${item.id}` };
        }

        const basePrice = isDeliveryLike(deliveryType) && dish.deliveryPrice !== null && dish.deliveryPrice !== undefined
            ? Number(dish.deliveryPrice)
            : Number(dish.price);

        if (!Number.isFinite(basePrice) || basePrice < 0) {
            return { ok: false, error: `Invalid dish price for dish: ${item.id}` };
        }

        const selectedModifierIds = Array.isArray(item.selectedModifiers)
            ? [...new Set(item.selectedModifiers.map((modifier) => modifier?.id).filter(Boolean))]
            : [];

        const trustedModifiers = [];
        let modifiersTotal = 0;

        for (const modifierId of selectedModifierIds) {
            const option = optionById.get(modifierId);
            if (!option || option.modifier?.dishId !== dish.id) {
                return { ok: false, error: `Modifier option ${modifierId} does not belong to dish ${dish.id}` };
            }

            const optionPrice = isDeliveryLike(deliveryType)
                ? Number((Object.prototype.hasOwnProperty.call(option, 'deliveryPrice') ? option.deliveryPrice : null) ?? option.price ?? 0)
                : Number(option.price || 0);
            modifiersTotal += Number.isFinite(optionPrice) ? optionPrice : 0;
            trustedModifiers.push({
                id: option.id,
                name: option.name,
                price: roundCurrency(optionPrice)
            });
        }

        const unitPrice = roundCurrency(basePrice + modifiersTotal);
        itemsSubtotal += unitPrice * quantity;

        trustedItems.push({
            dishId: dish.id,
            quantity,
            price: unitPrice,
            selectedModifiers: trustedModifiers.length > 0 ? trustedModifiers : undefined
        });
    }

    return {
        ok: true,
        trustedItems,
        itemsSubtotal: roundCurrency(itemsSubtotal),
        dishIds,
        modifierOptionIds
    };
};
