import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useCartStore = create(persist((set, get) => ({
  items: [],

  addItem: (dish, modifiers = []) => {
    const items = get().items;
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

  clearCart: () => set({ items: [] }),

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