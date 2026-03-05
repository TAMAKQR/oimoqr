import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useCartStore = create(persist((set, get) => ({
  items: [],
  restaurantId: null,
  restaurantName: null,
  orderMode: null, // 'dine_in' | 'delivery' | null
  tableNumber: null, // номер стола для заказов в зале

  // Установить режим заказа
  setOrderMode: (mode, tableNumber = null) => {
    set({ orderMode: mode, tableNumber });
  },

  // Проверить, принадлежит ли корзина другому ресторану
  isOtherRestaurant: (restaurantId) => {
    const current = get().restaurantId;
    return current && current !== restaurantId && get().items.length > 0;
  },

  // Переключиться на другой ресторан (очищает корзину)
  switchRestaurant: (restaurantId, restaurantName) => {
    set({ items: [], restaurantId, restaurantName, orderMode: null, tableNumber: null });
  },

  // Сверить корзину с меню конкретной обслуживающей точки
  // Удаляет блюда/опции, которых нет в актуальном меню, и пересчитывает цены
  reconcileWithRestaurantMenu: (restaurant) => {
    const state = get();
    const currentItems = Array.isArray(state.items) ? state.items : [];
    const categories = Array.isArray(restaurant?.categories) ? restaurant.categories : [];
    const nextRestaurantId = restaurant?.id || state.restaurantId;
    const nextRestaurantName = restaurant?.name || state.restaurantName;

    const dishMap = new Map();
    categories.forEach((category) => {
      const dishes = Array.isArray(category?.dishes) ? category.dishes : [];
      dishes.forEach((dish) => {
        if (dish?.id) {
          dishMap.set(dish.id, dish);
        }
      });
    });

    let removedItems = 0;
    let updatedItems = 0;

    const reconciled = currentItems
      .map((item) => {
        const itemDishId = item?.dish?.id;
        const menuDish = itemDishId ? dishMap.get(itemDishId) : null;

        if (!menuDish || menuDish.available === false) {
          removedItems += 1;
          return null;
        }

        const optionById = new Map();
        const requiredModifierIds = new Set();

        const modifiers = Array.isArray(menuDish.modifiers) ? menuDish.modifiers : [];
        modifiers.forEach((modifier) => {
          if (modifier?.isRequired) {
            requiredModifierIds.add(modifier.id);
          }
          const options = Array.isArray(modifier?.options) ? modifier.options : [];
          options.forEach((option) => {
            if (option?.id) optionById.set(option.id, option);
          });
        });

        const prevModifiers = Array.isArray(item?.modifiers) ? item.modifiers : [];
        const nextModifiers = prevModifiers
          .map((modifier) => {
            const fresh = optionById.get(modifier?.id);
            if (!fresh) return null;
            return {
              ...modifier,
              name: fresh.name ?? modifier.name,
              price: fresh.price ?? modifier.price,
              image: fresh.image ?? modifier.image
            };
          })
          .filter(Boolean);

        const selectedByModifier = new Map();
        nextModifiers.forEach((modifier) => {
          for (const menuModifier of modifiers) {
            const opts = Array.isArray(menuModifier?.options) ? menuModifier.options : [];
            if (opts.some((opt) => opt?.id === modifier.id)) {
              selectedByModifier.set(menuModifier.id, true);
              break;
            }
          }
        });

        const missingRequired = Array.from(requiredModifierIds).some(
          (requiredId) => !selectedByModifier.get(requiredId)
        );

        if (missingRequired) {
          removedItems += 1;
          return null;
        }

        const basePrice = parseFloat(menuDish.price) || 0;
        const modifiersPrice = nextModifiers.reduce((sum, modifier) => sum + (parseFloat(modifier.price) || 0), 0);
        const totalPrice = parseFloat((basePrice + modifiersPrice).toFixed(2));
        const modifierKey = nextModifiers.map((m) => m.id).sort().join('-');
        const itemId = `${menuDish.id}-${modifierKey}`;

        const prevItemId = item?.itemId;
        const prevTotalPrice = parseFloat(item?.totalPrice) || 0;

        if (prevItemId !== itemId || prevTotalPrice !== totalPrice) {
          updatedItems += 1;
        }

        return {
          ...item,
          dish: menuDish,
          modifiers: nextModifiers,
          itemId,
          totalPrice
        };
      })
      .filter(Boolean);

    const mergedByItemId = new Map();
    reconciled.forEach((item) => {
      const existing = mergedByItemId.get(item.itemId);
      if (!existing) {
        mergedByItemId.set(item.itemId, { ...item });
      } else {
        mergedByItemId.set(item.itemId, {
          ...existing,
          quantity: (existing.quantity || 0) + (item.quantity || 0)
        });
      }
    });

    const nextItems = Array.from(mergedByItemId.values());

    set({
      items: nextItems,
      restaurantId: nextRestaurantId,
      restaurantName: nextRestaurantName
    });

    return {
      removedItems,
      updatedItems,
      totalBefore: currentItems.length,
      totalAfter: nextItems.length
    };
  },

  addItem: (dish, modifiers = [], restaurantId = null, restaurantName = null) => {
    const state = get();
    const items = state.items;

    // Если корзина пуста — запомнить ресторан
    if (items.length === 0 && restaurantId) {
      set({ restaurantId, restaurantName });
    }

    // Защита от undefined/null модификаторов
    const safeModifiers = Array.isArray(modifiers) ? modifiers : [];
    const itemId = `${dish.id}-${safeModifiers.map(m => m.id).join('-')}`;

    const existingItem = items.find(item => item.itemId === itemId);

    if (existingItem) {
      set({
        items: items.map(item =>
          item.itemId === itemId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      });
    } else {
      // Защита от NaN: если цена не задана, используем 0
      const dishPrice = parseFloat(dish.price) || 0;
      const modifiersPrice = safeModifiers.reduce((sum, m) => sum + (parseFloat(m.price) || 0), 0);
      const totalPrice = parseFloat((dishPrice + modifiersPrice).toFixed(2));

      set({
        items: [
          ...items,
          {
            itemId,
            dish,
            modifiers: safeModifiers,
            quantity: 1,
            totalPrice
          }
        ]
      });
    }
  },

  removeItem: (itemId) => {
    set({
      items: get().items.filter(item => item.itemId !== itemId)
    });
  },

  updateQuantity: (itemId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(itemId);
      return;
    }

    set({
      items: get().items.map(item =>
        item.itemId === itemId
          ? { ...item, quantity }
          : item
      )
    });
  },

  clearCart: () => set({ items: [], restaurantId: null, restaurantName: null, orderMode: null, tableNumber: null }),

  getTotal: () => {
    const total = get().items.reduce((sum, item) => {
      const itemTotal = (parseFloat(item.totalPrice) || 0) * (parseInt(item.quantity) || 0);
      return sum + itemTotal;
    }, 0);
    return parseFloat(total.toFixed(2));
  },

  getItemCount: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  }
}), {
  name: 'cart-storage'
}));
