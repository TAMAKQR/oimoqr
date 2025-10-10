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
          className="card cursor-pointer hover:shadow-lg transition-shadow"
        >
          <div className="flex gap-4">
            {/* Фото слева */}
            {dish.image && (
              <img
                src={dish.image}
                alt={dish.name}
                className="w-28 h-28 object-cover rounded-lg flex-shrink-0"
              />
            )}
            
            {/* Информация справа */}
            <div className="flex-1 flex flex-col justify-between min-w-0">
              <div>
                <h3 className="text-lg font-semibold mb-1 line-clamp-1">{dish.name}</h3>
                {dish.description && (
                  <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                    {dish.description}
                  </p>
                )}
              </div>
              
              <div className="flex justify-between items-center gap-2">
                <span className="text-xl font-bold text-primary-600 whitespace-nowrap">
                  {parseFloat(dish.price).toFixed(2)} {currency}
                </span>
                <button className="btn-primary text-sm px-3 py-1.5 whitespace-nowrap">
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
        className="card cursor-pointer hover:shadow-lg transition-shadow"
      >
        {dish.image && (
          <img
            src={dish.image}
            alt={dish.name}
            className="w-full h-48 object-cover rounded-t-lg -mt-6 -mx-6 mb-4"
          />
        )}
        <h3 className="text-lg font-semibold mb-2">{dish.name}</h3>
        {dish.description && (
          <p className="text-gray-600 text-sm mb-3 line-clamp-2">
            {dish.description}
          </p>
        )}
        <div className="flex justify-between items-center">
          <span className="text-xl font-bold text-primary-600">
            {parseFloat(dish.price).toFixed(2)} {currency}
          </span>
          <button className="btn-primary text-sm">
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