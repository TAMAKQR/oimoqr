import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

const AdminPage = () => {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const [restaurants, setRestaurants] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [restaurantsRes, statsRes] = await Promise.all([
        api.get('/admin/restaurants'),
        api.get('/admin/stats/subscriptions')
      ]);
      setRestaurants(restaurantsRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Error loading admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSubscription = async (subscriptionId, plan, status) => {
    try {
      console.log('Updating subscription:', { subscriptionId, plan, status });
      const response = await api.put(`/admin/subscriptions/${subscriptionId}`, { plan, status });
      console.log('Update response:', response.data);
      await loadData();
      alert('Подписка обновлена успешно!');
    } catch (err) {
      console.error('Error updating subscription:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Неизвестная ошибка';
      alert(`Ошибка обновления подписки: ${errorMessage}`);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getStatusBadge = (status) => {
    const colors = {
      TRIAL: 'bg-blue-100 text-blue-800',
      ACTIVE: 'bg-green-100 text-green-800',
      EXPIRED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
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
          <h1 className="text-lg sm:text-2xl font-bold text-primary-600">Админ-панель</h1>
          <button onClick={handleLogout} className="btn-secondary text-sm sm:text-base px-3 sm:px-4 py-1.5 sm:py-2">
            Выход
          </button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-4 sm:py-8">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
            <div className="card p-4 sm:p-6">
              <h3 className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">Всего ресторанов</h3>
              <p className="text-2xl sm:text-3xl font-bold">{restaurants.length}</p>
            </div>
            <div className="card p-4 sm:p-6">
              <h3 className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">Пробный период</h3>
              <p className="text-2xl sm:text-3xl font-bold text-blue-600">
                {stats.stats.find(s => s.status === 'TRIAL')?._count || 0}
              </p>
            </div>
            <div className="card p-4 sm:p-6">
              <h3 className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">Активные</h3>
              <p className="text-2xl sm:text-3xl font-bold text-green-600">
                {stats.stats.find(s => s.status === 'ACTIVE')?._count || 0}
              </p>
            </div>
            <div className="card p-4 sm:p-6">
              <h3 className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">Истекшие</h3>
              <p className="text-2xl sm:text-3xl font-bold text-red-600">
                {stats.stats.find(s => s.status === 'EXPIRED')?._count || 0}
              </p>
            </div>
          </div>
        )}

        {/* Restaurants Table */}
        <div className="card p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Рестораны</h2>
          
          {/* Mobile Cards View */}
          <div className="block md:hidden space-y-4">
            {restaurants.map((restaurant) => (
              <div key={restaurant.id} className="border rounded-lg p-4 bg-gray-50">
                <h3 className="font-bold text-base mb-2 break-words">{restaurant.name}</h3>
                <div className="space-y-1 text-sm">
                  <p className="text-gray-600">
                    <span className="font-medium">Владелец:</span> {restaurant.user.name}
                  </p>
                  <p className="text-gray-600 break-all">
                    <span className="font-medium">Email:</span> {restaurant.user.email}
                  </p>
                  <p>
                    <span className="font-medium">Субдомен:</span>{' '}
                    <a
                      href={`/menu/${restaurant.subdomain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:underline break-all"
                    >
                      {restaurant.subdomain}
                    </a>
                  </p>
                  <p>
                    <span className="font-medium">План:</span> {restaurant.subscription?.plan || '-'}
                  </p>
                  <p>
                    <span className="font-medium">Статус:</span>{' '}
                    <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(restaurant.subscription?.status)}`}>
                      {restaurant.subscription?.status || '-'}
                    </span>
                  </p>
                </div>
                <div className="mt-3">
                  {restaurant.subscription ? (
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          const [plan, status] = e.target.value.split('|');
                          handleUpdateSubscription(restaurant.subscription.id, plan, status);
                          e.target.value = '';
                        }
                      }}
                      className="w-full text-sm border rounded px-3 py-2"
                    >
                      <option value="">Изменить...</option>
                      <option value="MONTHLY|ACTIVE">Активировать Monthly</option>
                      <option value="YEARLY|ACTIVE">Активировать Yearly</option>
                      <option value="TRIAL|EXPIRED">Завершить Trial</option>
                      <option value="ACTIVE|CANCELLED">Отменить</option>
                    </select>
                  ) : (
                    <span className="text-gray-400 text-sm">Нет подписки</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm">Ресторан</th>
                  <th className="text-left py-3 px-4 text-sm">Владелец</th>
                  <th className="text-left py-3 px-4 text-sm">Email</th>
                  <th className="text-left py-3 px-4 text-sm">Субдомен</th>
                  <th className="text-left py-3 px-4 text-sm">План</th>
                  <th className="text-left py-3 px-4 text-sm">Статус</th>
                  <th className="text-left py-3 px-4 text-sm">Действия</th>
                </tr>
              </thead>
              <tbody>
                {restaurants.map((restaurant) => (
                  <tr key={restaurant.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">{restaurant.name}</td>
                    <td className="py-3 px-4 text-sm">{restaurant.user.name}</td>
                    <td className="py-3 px-4 text-sm">{restaurant.user.email}</td>
                    <td className="py-3 px-4 text-sm">
                      <a
                        href={`/menu/${restaurant.subdomain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:underline"
                      >
                        {restaurant.subdomain}
                      </a>
                    </td>
                    <td className="py-3 px-4 text-sm">{restaurant.subscription?.plan}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(restaurant.subscription?.status)}`}>
                        {restaurant.subscription?.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {restaurant.subscription ? (
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              const [plan, status] = e.target.value.split('|');
                              handleUpdateSubscription(restaurant.subscription.id, plan, status);
                              e.target.value = '';
                            }
                          }}
                          className="text-sm border rounded px-2 py-1"
                        >
                          <option value="">Изменить...</option>
                          <option value="MONTHLY|ACTIVE">Активировать Monthly</option>
                          <option value="YEARLY|ACTIVE">Активировать Yearly</option>
                          <option value="TRIAL|EXPIRED">Завершить Trial</option>
                          <option value="ACTIVE|CANCELLED">Отменить</option>
                        </select>
                      ) : (
                        <span className="text-gray-400 text-sm">Нет подписки</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;