import { useState } from 'react';


const RestaurantSelector = ({ userData, selectedRestaurantId, onSelectRestaurant }) => {
  const [isOpen, setIsOpen] = useState(false);

  const allRestaurants = [
    ...(userData?.restaurants || []),
    ...(userData?.restaurantStaff?.map(s => ({ ...s.restaurant, role: s.role })) || [])
  ];

  const selectedRestaurant = allRestaurants.find(r => r.id === selectedRestaurantId);

  if (allRestaurants.length === 0) {
    return null;
  }

  if (allRestaurants.length === 1) {
    return (
      <div className="px-4 py-2 bg-gray-100 rounded text-sm text-gray-700">
        {allRestaurants[0].name}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-left flex justify-between items-center hover:bg-gray-50"
      >
        <span className="font-medium truncate">{selectedRestaurant?.name || 'Выберите ресторан'}</span>
        <span className="text-gray-400 ml-2">▼</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10">
          {allRestaurants.map((restaurant) => (
            <button
              key={restaurant.id}
              onClick={() => {
                onSelectRestaurant(restaurant.id);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 border-b last:border-b-0 flex justify-between items-center ${
                restaurant.id === selectedRestaurantId ? 'bg-primary-50 font-medium' : ''
              }`}
            >
              <span className="truncate">{restaurant.name}</span>
              {restaurant.role && <span className="text-xs text-gray-500 ml-2">({restaurant.role})</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default RestaurantSelector;
