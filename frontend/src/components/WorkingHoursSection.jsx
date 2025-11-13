import { useState, useEffect } from 'react';

const WorkingHoursSection = ({ restaurant }) => {
  const [currentStatus, setCurrentStatus] = useState({ isOpen: false, message: '' });
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    checkStatus();
    // Update status every minute
    const interval = setInterval(checkStatus, 60000);
    return () => clearInterval(interval);
  }, [restaurant]);

  const checkStatus = () => {
    if (!restaurant) return;

    // Check if temporarily closed
    if (restaurant.isTemporarilyClosed) {
      setCurrentStatus({
        isOpen: false,
        message: restaurant.closureReason || 'Временно закрыто'
      });
      return;
    }

    // Check working hours
    if (!restaurant.workingHours) {
      setCurrentStatus({ isOpen: true, message: '' });
      return;
    }

    const now = new Date();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = dayNames[now.getDay()];
    const currentTime = now.getHours() * 60 + now.getMinutes(); // Minutes since midnight

    // Check for 24/7 first
    if (restaurant.workingHours[currentDay]?.is247) {
      setCurrentStatus({
        isOpen: true,
        message: 'Круглосуточно'
      });
      return;
    }

    const todaySchedule = restaurant.workingHours[currentDay];

    if (!todaySchedule || !todaySchedule.isOpen) {
      setCurrentStatus({
        isOpen: false,
        message: 'Сегодня выходной'
      });
      return;
    }

    // Parse time strings (HH:MM)
    const [openHour, openMin] = todaySchedule.open.split(':').map(Number);
    const [closeHour, closeMin] = todaySchedule.close.split(':').map(Number);
    const openTime = openHour * 60 + openMin;
    const closeTime = closeHour * 60 + closeMin;

    if (currentTime >= openTime && currentTime <= closeTime) {
      setCurrentStatus({
        isOpen: true,
        message: `Открыто до ${todaySchedule.close}`
      });
    } else if (currentTime < openTime) {
      setCurrentStatus({
        isOpen: false,
        message: `Откроется в ${todaySchedule.open}`
      });
    } else {
      setCurrentStatus({
        isOpen: false,
        message: 'Закрыто'
      });
    }
  };

  if (!restaurant || (!restaurant.workingHours && !restaurant.isTemporarilyClosed)) {
    return null;
  }

  const dayLabels = {
    monday: 'пн',
    tuesday: 'вт',
    wednesday: 'ср',
    thursday: 'чт',
    friday: 'пт',
    saturday: 'сб',
    sunday: 'вс',
  };

  // Get current day info
  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[now.getDay()];
  const todaySchedule = restaurant.workingHours?.[currentDay];

  return (
    <>
      {/* Compact Hours Display */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`text-xs sm:text-sm font-medium cursor-pointer transition-colors ${
          currentStatus.isOpen ? 'text-green-600 hover:text-green-700' : 'text-red-600 hover:text-red-700'
        }`}
      >
        🕐 {todaySchedule?.is247 
            ? 'Круглосуточно' 
            : (todaySchedule && todaySchedule.isOpen ? `${todaySchedule.open}–${todaySchedule.close}` : 'Выходной')
          }
      </button>

      {/* Details Modal */}
      {showDetails && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDetails(false)}
        >
          <div 
            className="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold">Часы работы</h3>
              <button 
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {restaurant.isTemporarilyClosed ? (
              <div className="text-center py-4">
                <p className="text-red-600 font-semibold mb-2">● Временно закрыто</p>
                {restaurant.closureReason && (
                  <p className="text-gray-600 text-sm">{restaurant.closureReason}</p>
                )}
              </div>
            ) : todaySchedule && todaySchedule.isOpen ? (
              <div>
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Сегодня, <span className="capitalize font-medium">{dayLabels[currentDay]}</span></p>
                  <p className="text-lg font-bold">
                    {todaySchedule.is247 
                      ? 'Круглосуточно' 
                      : `${todaySchedule.open} – ${todaySchedule.close}`}
                  </p>
                  <p className={`text-sm font-medium mt-2 ${currentStatus.isOpen ? 'text-green-600' : 'text-red-600'}`}>
                    {currentStatus.isOpen ? '● Открыто' : '● Закрыто'}
                    {currentStatus.message && <span className="font-normal"> • {currentStatus.message}</span>}
                  </p>
                </div>

                {/* All week schedule */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Расписание на неделю</p>
                  {Object.entries(dayLabels).map(([day, label]) => {
                    const schedule = restaurant.workingHours?.[day];
                    const isCurrent = day === currentDay;
                    return (
                      <div 
                        key={day} 
                        className={`flex justify-between text-sm py-1 ${isCurrent ? 'font-semibold' : ''}`}
                      >
                        <span className={`capitalize ${isCurrent ? 'text-primary-600' : 'text-gray-700'}`}>
                          {label}
                        </span>
                        <span className={schedule?.isOpen ? 'text-gray-900' : 'text-red-600'}>
                          {schedule?.isOpen 
                            ? (schedule.is247 ? 'Круглосуточно' : `${schedule.open} – ${schedule.close}`) 
                            : 'Выходной'
                          }
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-red-600 font-semibold">● Сегодня выходной</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default WorkingHoursSection;