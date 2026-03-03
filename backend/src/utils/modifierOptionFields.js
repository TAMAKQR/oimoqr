import { prisma } from '../config/prisma.js';

let cachedHasDeliveryPrice = null;
let lastCheckedAt = 0;

const CACHE_TTL_MS = 60 * 1000;

export const hasModifierOptionDeliveryPriceColumn = async () => {
    const now = Date.now();
    if (cachedHasDeliveryPrice !== null && now - lastCheckedAt < CACHE_TTL_MS) {
        return cachedHasDeliveryPrice;
    }

    try {
        const result = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ModifierOption'
          AND column_name = 'deliveryPrice'
      ) AS "exists"
    `;

        cachedHasDeliveryPrice = Boolean(result?.[0]?.exists);
    } catch {
        cachedHasDeliveryPrice = false;
    }

    lastCheckedAt = now;
    return cachedHasDeliveryPrice;
};

export const getModifierOptionSelect = async () => {
    const hasDeliveryPrice = await hasModifierOptionDeliveryPriceColumn();

    const baseSelect = {
        id: true,
        name: true,
        price: true,
        image: true,
        modifierId: true,
        createdAt: true,
        updatedAt: true
    };

    if (hasDeliveryPrice) {
        baseSelect.deliveryPrice = true;
    }

    return baseSelect;
};
