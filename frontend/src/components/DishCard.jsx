import { useState } from 'react';
import DishModal from './DishModal';

const DishCard = ({ dish, currency = '₽', style = 'horizontal' }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Горизонтальный стиль (фото слева)
  if (style === 'horizontal') {
    return (
      <>
        <div
          onClick={() => setIsModalOpen(true)}
          className="card cursor-pointer hover:shadow-lg transition-all duration-200 active:scale-98"
        >
          <div className="flex gap-3 sm:gap-4">
            {/* Фото слева */}
            {dish.image && (
              <img
                src={dish.image}
                alt={dish.name}
                className="w-20 h-20 sm:w-28 sm:h-28 object-cover rounded-lg flex-shrink-0"
              />
            )}
            
            {/* Информация справа */}
            <div className="flex-1 flex flex-col justify-between min-w-0">
              <div>
                <h3 className="text-base sm:text-lg font-semibold mb-1 line-clamp-2 break-words">{dish.name}</h3>
                {dish.description && (
                  <p className="text-gray-600 text-xs sm:text-sm mb-2 line-clamp-2 break-words">
                    {dish.description}
                  </p>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <span className="text-lg sm:text-xl font-bold text-primary-600 whitespace-nowrap">
                  {parseFloat(dish.price).toFixed(2)} {currency}
                </span>
                <button className="btn-primary text-xs sm:text-sm px-3 py-1.5 whitespace-nowrap w-full sm:w-auto">
                  Добавить
                </button>
              </div>
            </div>
          </div>
        </div>

        <DishModal
          dish={dish}
          currency={currency}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </>
    );
  }

  // Вертикальный стиль (фото сверху)
  return (
    <>
      <div
        onClick={() => setIsModalOpen(true)}
        className="card cursor-pointer hover:shadow-lg transition-all duration-200 active:scale-98"
      >
        {dish.image && (
          <img
            src={dish.image}
            alt={dish.name}
            className="w-full h-40 sm:h-48 object-cover rounded-t-lg -mt-6 -mx-6 mb-4"
          />
        )}
        <h3 className="text-base sm:text-lg font-semibold mb-2 break-words">{dish.name}</h3>
        {dish.description && (
          <p className="text-gray-600 text-xs sm:text-sm mb-3 line-clamp-2 break-words">
            {dish.description}
          </p>
        )}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
          <span className="text-lg sm:text-xl font-bold text-primary-600 whitespace-nowrap">
            {parseFloat(dish.price).toFixed(2)} {currency}
          </span>
          <button className="btn-primary text-xs sm:text-sm w-full sm:w-auto">
            Добавить
          </button>
        </div>
      </div>

      <DishModal
        dish={dish}
        currency={currency}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
};

export default DishCard;