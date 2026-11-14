import { useEffect, useId, useMemo, useRef, useState } from 'react';

const ROLE_LABELS = {
  OWNER: 'Владелец',
  ADMIN: 'Администратор',
  MANAGER: 'Менеджер',
  STAFF: 'Сотрудник',
  WAITER: 'Официант',
};

const RestaurantSelector = ({ userData, selectedRestaurantId, onSelectRestaurant, placeholderLabel = 'ресторан' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);
  const listboxId = useId();

  const allRestaurants = useMemo(() => {
    const restaurants = [
      ...(userData?.restaurants || []).map((restaurant) => ({ ...restaurant, role: 'OWNER' })),
      ...(userData?.restaurantStaff?.map((staff) => ({ ...staff.restaurant, role: staff.role || 'STAFF' })) || []),
    ];
    return restaurants.filter((restaurant, index, list) => (
      restaurant?.id && list.findIndex((item) => item?.id === restaurant.id) === index
    ));
  }, [userData]);

  const selectedRestaurant = allRestaurants.find((restaurant) => restaurant.id === selectedRestaurantId);
  const placeholderText = selectedRestaurant?.name || `Выберите ${placeholderLabel}`;

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => setIsOpen(false), [selectedRestaurantId]);

  if (allRestaurants.length === 0) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-gray-300 bg-white px-3 py-2 text-left shadow-sm transition-all hover:border-primary-300 hover:bg-gray-50 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-100"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-sm font-bold text-primary-700">
          {selectedRestaurant?.name?.trim()?.charAt(0)?.toUpperCase() || 'З'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-gray-950">{placeholderText}</span>
          {selectedRestaurant && (
            <span className="mt-0.5 block truncate text-xs text-gray-400">
              {ROLE_LABELS[selectedRestaurant.role] || selectedRestaurant.role || 'Заведение'}
            </span>
          )}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Выберите заведение"
          className="absolute left-0 right-0 top-full z-40 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-1.5 shadow-floating animate-fade-in"
        >
          {allRestaurants.map((restaurant) => {
            const isSelected = restaurant.id === selectedRestaurantId;
            return (
              <button
                key={restaurant.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onSelectRestaurant?.(restaurant.id);
                  setIsOpen(false);
                }}
                className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                  isSelected ? 'bg-primary-50 text-primary-800' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                  isSelected ? 'bg-white text-primary-700 shadow-sm' : 'bg-gray-100 text-gray-500'
                }`}>
                  {restaurant.name?.trim()?.charAt(0)?.toUpperCase() || 'З'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{restaurant.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-gray-400">
                    {ROLE_LABELS[restaurant.role] || restaurant.role || 'Заведение'}
                  </span>
                </span>
                {isSelected && (
                  <svg className="h-5 w-5 shrink-0 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RestaurantSelector;
