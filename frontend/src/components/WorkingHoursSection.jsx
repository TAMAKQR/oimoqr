import { useState, useEffect } from 'react';

const dayLabels = {
  monday: 'пн',
  tuesday: 'вт',
  wednesday: 'ср',
  thursday: 'чт',
  friday: 'пт',
  saturday: 'сб',
  sunday: 'вс',
};

const normalizeSchedule = (schedule) => {
  if (!schedule || typeof schedule !== 'object') return null;
  return schedule;
};

const getScheduleStatus = (schedule) => {
  if (!schedule) {
    return { isOpen: true, message: '', currentDay: null, todaySchedule: null };
  }

  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[now.getDay()];
  const previousDay = dayNames[(now.getDay() + 6) % 7];
  const currentTime = now.getHours() * 60 + now.getMinutes();
  const todaySchedule = schedule[currentDay];
  const prevSchedule = schedule[previousDay];

  const toMinutes = (value) => {
    if (!value || !String(value).includes(':')) return null;
    const [hours, minutes] = String(value).split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return hours * 60 + minutes;
  };

  const prevOpen = toMinutes(prevSchedule?.open);
  const prevClose = toMinutes(prevSchedule?.close);
  if (prevSchedule?.isOpen && !prevSchedule?.is247 && prevOpen !== null && prevClose !== null && prevClose < prevOpen && currentTime < prevClose) {
    return {
      isOpen: true,
      message: `Открыто до ${prevSchedule.close}`,
      currentDay,
      todaySchedule,
    };
  }

  if (!todaySchedule || !todaySchedule.isOpen) {
    return {
      isOpen: false,
      message: 'Сегодня выходной',
      currentDay,
      todaySchedule,
    };
  }

  if (todaySchedule.is247) {
    return {
      isOpen: true,
      message: 'Круглосуточно',
      currentDay,
      todaySchedule,
    };
  }

  const openTime = toMinutes(todaySchedule.open);
  const closeTime = toMinutes(todaySchedule.close);

  if (openTime === null || closeTime === null) {
    return { isOpen: true, message: '', currentDay, todaySchedule };
  }

  const isOpenNow = closeTime > openTime
    ? currentTime >= openTime && currentTime < closeTime
    : currentTime >= openTime || currentTime < closeTime;

  if (isOpenNow) {
    return {
      isOpen: true,
      message: `Открыто до ${todaySchedule.close}`,
      currentDay,
      todaySchedule,
    };
  }

  if (closeTime > openTime && currentTime < openTime) {
    return {
      isOpen: false,
      message: `Откроется в ${todaySchedule.open}`,
      currentDay,
      todaySchedule,
    };
  }

  return {
    isOpen: false,
    message: 'Закрыто',
    currentDay,
    todaySchedule,
  };
};

const WorkingHoursSection = ({ restaurant }) => {
  const [currentStatus, setCurrentStatus] = useState({ isOpen: false, message: '' });
  const [deliveryStatus, setDeliveryStatus] = useState({ isOpen: false, message: '' });
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    checkStatus();
    // Update status every minute
    const interval = setInterval(checkStatus, 60000);
    return () => clearInterval(interval);
  }, [restaurant]);

  const checkStatus = () => {
    if (!restaurant) return;

    const normalizedWorkingHours = normalizeSchedule(restaurant.workingHours);
    const normalizedDeliveryHours = normalizeSchedule(restaurant.deliveryHours || restaurant.workingHours);

    if (restaurant.isTemporarilyClosed) {
      setCurrentStatus({
        isOpen: false,
        message: restaurant.closureReason || 'Временно закрыто'
      });
      setDeliveryStatus(getScheduleStatus(normalizedDeliveryHours));
      return;
    }

    setCurrentStatus(getScheduleStatus(normalizedWorkingHours));
    setDeliveryStatus(getScheduleStatus(normalizedDeliveryHours));
  };

  if (!restaurant || (!restaurant.workingHours && !restaurant.isTemporarilyClosed)) {
    return null;
  }

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
        className={`text-xs sm:text-sm font-medium cursor-pointer transition-colors ${currentStatus.isOpen ? 'text-green-600 hover:text-green-700' : 'text-red-600 hover:text-red-700'
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

                {restaurant.deliveryEnabled && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-sm text-gray-600 mb-1">Доставка</p>
                    <p className={`text-sm font-medium ${deliveryStatus.isOpen ? 'text-green-600' : 'text-red-600'}`}>
                      {deliveryStatus.isOpen ? '● Принимает заказы' : '● Сейчас не принимает'}
                      {deliveryStatus.message && <span className="font-normal"> • {deliveryStatus.message}</span>}
                    </p>
                  </div>
                )}

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

                {restaurant.deliveryEnabled && restaurant.deliveryHours && (
                  <div className="space-y-2 mt-5">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Доставка на неделю</p>
                    {Object.entries(dayLabels).map(([day, label]) => {
                      const schedule = restaurant.deliveryHours?.[day];
                      const isCurrent = day === currentDay;
                      return (
                        <div
                          key={`delivery-${day}`}
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
                )}
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