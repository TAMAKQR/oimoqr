import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const data = await authService.getMe();
      setUserData(data);
    } catch (err) {
      console.error('Error loading user data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getSubscriptionStatus = () => {
    if (!userData?.restaurant?.subscription) return 'Нет подписки';
    
    const sub = userData.restaurant.subscription;
    const now = new Date();
    
    if (sub.status === 'TRIAL') {
      const daysLeft = Math.ceil((new Date(sub.trialEndsAt) - now) / (1000 * 60 * 60 * 24));
      return `Пробный период (осталось ${daysLeft} дней)`;
    }
    
    if (sub.status === 'ACTIVE') {
      const daysLeft = Math.ceil((new Date(sub.currentPeriodEnd) - now) / (1000 * 60 * 60 * 24));
      return `Активна (осталось ${daysLeft} дней)`;
    }
    
    return 'Истекла';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-3 sm:py-4 flex justify-between items-center">
          <h1 className="text-xl sm:text-2xl font-bold text-primary-600">OimoQR</h1>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="text-sm sm:text-base text-gray-600 truncate max-w-[120px] sm:max-w-none">{user?.name}</span>
            <button onClick={handleLogout} className="btn-secondary text-sm sm:text-base px-3 sm:px-4 py-1.5 sm:py-2">
              Выход
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-4 sm:py-8">
        <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">Панель управления</h2>

        {/* Subscription Status */}
        <div className="card p-4 sm:p-6 mb-6 sm:mb-8">
          <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Статус подписки</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base sm:text-lg break-words">{getSubscriptionStatus()}</p>
              {userData?.restaurant?.subscription?.status === 'TRIAL' && (
                <p className="text-xs sm:text-sm text-gray-600 mt-2">
                  После окончания пробного периода свяжитесь с администратором для активации подписки
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Restaurant Info */}
        {userData?.restaurant && (
          <div className="card p-4 sm:p-6 mb-6 sm:mb-8">
            <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Информация о ресторане</h3>
            <div className="space-y-2 text-sm sm:text-base">
              <p className="break-words"><strong>Название:</strong> {userData.restaurant.name}</p>
              <p className="break-all"><strong>Субдомен:</strong> {userData.restaurant.subdomain}.oimoqr.com</p>
              <a
                href={`/menu/${userData.restaurant.subdomain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-3 sm:mt-4 btn-primary text-sm sm:text-base w-full sm:w-auto text-center"
              >
                Посмотреть меню
              </a>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="card p-4 sm:p-6 text-center">
            <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">📝</div>
            <h3 className="text-base sm:text-lg font-semibold mb-2">Редактировать меню</h3>
            <p className="text-gray-600 text-xs sm:text-sm mb-3 sm:mb-4">
              Добавляйте категории и блюда
            </p>
            <button onClick={() => navigate('/menu-management')} className="btn-primary w-full text-sm sm:text-base">
              Перейти
            </button>
          </div>

          <div className="card p-4 sm:p-6 text-center">
            <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">🎨</div>
            <h3 className="text-base sm:text-lg font-semibold mb-2">Настройки</h3>
            <p className="text-gray-600 text-xs sm:text-sm mb-3 sm:mb-4">
              Баннеры, соцсети, доставка
            </p>
            <button onClick={() => navigate('/settings')} className="btn-primary w-full text-sm sm:text-base">
              Перейти
            </button>
          </div>

          <div className="card p-4 sm:p-6 text-center">
            <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">📊</div>
            <h3 className="text-base sm:text-lg font-semibold mb-2">Статистика</h3>
            <p className="text-gray-600 text-xs sm:text-sm mb-3 sm:mb-4">
              Просмотры и заказы
            </p>
            <button onClick={() => alert('Статистика будет доступна в следующей версии')} className="btn-primary w-full text-sm sm:text-base">
              Перейти
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="card p-4 sm:p-6 mt-6 sm:mt-8 bg-primary-50 border-primary-200">
          <h3 className="text-base sm:text-lg font-semibold mb-2">💡 Совет</h3>
          <p className="text-gray-700 text-sm sm:text-base">
            Добавьте красивые фотографии блюд и подробные описания, чтобы увеличить количество заказов.
            Не забудьте настроить баннеры для акций и специальных предложений!
          </p>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;