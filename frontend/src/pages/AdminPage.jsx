import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { confirmDialog } from '../utils/confirmDialog';
import DashboardLayout from '../components/DashboardLayout';
import toast from 'react-hot-toast';

const AdminPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [pricingTiers, setPricingTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionForm, setSubscriptionForm] = useState({
    pricingTierId: '',
    durationMonths: 1,
    startDate: '',
    endDate: ''
  });
  const [editForm, setEditForm] = useState({ email: '', password: '' });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Фильтрация пользователей по поисковому запросу
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(
        users.filter(user =>
          user.name?.toLowerCase().includes(query) ||
          user.email?.toLowerCase().includes(query) ||
          user.restaurants?.some(r =>
            r.name?.toLowerCase().includes(query) ||
            r.subdomain?.toLowerCase().includes(query)
          )
        )
      );
    }
  }, [searchQuery, users]);

  const showNotification = (message, type = 'success') => {
    if (type === 'error') toast.error(message);
    else toast.success(message);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const loadData = async () => {
    try {
      const [usersRes, statsRes, pricingRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/stats/subscriptions'),
        api.get('/admin/pricing-tiers')
      ]);

      setUsers(usersRes.data);
      setFilteredUsers(usersRes.data);
      setStats(statsRes.data);
      setPricingTiers(pricingRes.data);
    } catch (err) {
      console.error('Error loading data:', err);
      showNotification('Ошибка загрузки данных', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserSubscription = async (userId, pricingTierId, options = {}) => {
    try {
      const payload = { pricingTierId, ...options };
      await api.put(`/admin/users/${userId}/subscriptions`, payload);
      await loadData();
      showNotification('Подписка пользователя обновлена успешно!');
      setShowSubscriptionModal(false);
    } catch (err) {
      console.error('Error updating user subscription:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Неизвестная ошибка';
      showNotification(`Ошибка обновления подписки: ${errorMessage}`, 'error');
    }
  };

  const handleOpenSubscriptionModal = (user) => {
    setEditingUser(user);
    const today = new Date().toISOString().split('T')[0];
    setSubscriptionForm({
      pricingTierId: user.subscriptions?.[0]?.pricingTierId || '',
      durationMonths: 1,
      startDate: today,
      endDate: ''
    });
    setShowSubscriptionModal(true);
  };

  const handleSubmitSubscription = (e) => {
    e.preventDefault();
    const options = {};

    if (subscriptionForm.durationMonths) {
      options.durationMonths = parseInt(subscriptionForm.durationMonths);
    }
    if (subscriptionForm.startDate) {
      options.startDate = subscriptionForm.startDate;
    }
    if (subscriptionForm.endDate) {
      options.endDate = subscriptionForm.endDate;
    }

    handleUpdateUserSubscription(editingUser.id, subscriptionForm.pricingTierId, options);
  };

  const handleOpenEditModal = (user) => {
    setEditingUser(user);
    setEditForm({ email: user.email, password: '' });
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingUser(null);
    setEditForm({ email: '', password: '' });
  };

  const handleDeactivateUser = async (user) => {
    const confirmed = await confirmDialog(
      `Вы уверены, что хотите деактивировать пользователя ${user.name} и все его подписки?`,
      {
        confirmText: 'Деактивировать',
        cancelText: 'Отмена',
        icon: '⚠️'
      }
    );
    if (!confirmed) {
      return;
    }

    try {
      await api.post(`/admin/users/${user.id}/deactivate`);
      await loadData();
      showNotification('Пользователь успешно деактивирован');
    } catch (err) {
      console.error('Error deactivating user:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Неизвестная ошибка';
      showNotification(`Ошибка деактивации: ${errorMessage}`, 'error');
    }
  };

  const handleDeleteUser = async (user) => {
    const confirmed = await confirmDialog(
      `⚠️ ВНИМАНИЕ! Это действие необратимо!\n\nВы действительно хотите удалить пользователя ${user.name} и все его рестораны?\nВсе данные будут удалены без возможности восстановления.`,
      {
        confirmText: 'Удалить навсегда',
        cancelText: 'Отмена',
        icon: '🗑️',
        duration: 10000
      }
    );
    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/admin/users/${user.id}`);
      await loadData();
      showNotification('Пользователь и все его данные успешно удалены');
    } catch (err) {
      console.error('Error deleting user:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Неизвестная ошибка';
      showNotification(`Ошибка удаления: ${errorMessage}`, 'error');
    }
  };

  const handleUpdateCredentials = async (e) => {
    e.preventDefault();

    if (!editForm.email && !editForm.password) {
      showNotification('Введите email или пароль для изменения', 'error');
      return;
    }

    if (editForm.password && editForm.password.length < 6) {
      showNotification('Пароль должен содержать минимум 6 символов', 'error');
      return;
    }

    try {
      const updateData = {};
      if (editForm.email !== editingUser.email) {
        updateData.email = editForm.email;
      }
      if (editForm.password) {
        updateData.password = editForm.password;
      }

      await api.put(`/admin/users/${editingUser.id}/credentials`, updateData);
      await loadData();
      handleCloseEditModal();
      showNotification('Учетные данные обновлены успешно!');
    } catch (err) {
      console.error('Error updating credentials:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Неизвестная ошибка';
      showNotification(`Ошибка обновления: ${errorMessage}`, 'error');
    }
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

  const getTotalRestaurants = () => {
    return users.reduce((total, user) => total + (user.restaurants?.length || 0), 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Загрузка...</div>
      </div>
    );
  }

  return (
    <DashboardLayout userData={user} selectedRestaurantId={null}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Админ-панель</h1>
          <p className="text-gray-500 text-sm mt-1">Управление платформой</p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-sm text-gray-500 mb-2">Пользователи</p>
              <p className="text-2xl font-bold text-gray-900">{users.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-sm text-gray-500 mb-2">Рестораны</p>
              <p className="text-2xl font-bold text-gray-900">{getTotalRestaurants()}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-sm text-gray-500 mb-2">Активные подписки</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.stats.find(s => s.status === 'ACTIVE')?._count || 0}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-sm text-gray-500 mb-2">Trial период</p>
              <p className="text-2xl font-bold text-blue-600">
                {stats.stats.find(s => s.status === 'TRIAL')?._count || 0}
              </p>
            </div>
          </div>
        )}

        {/* Search and Users Table */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Пользователи ({filteredUsers.length})</h2>
            <div className="w-80">
              <input
                type="text"
                placeholder="🔍 Поиск по имени, email или ресторану..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input w-full"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold">Пользователь</th>
                  <th className="text-left py-3 px-4 font-semibold">Рестораны</th>
                  <th className="text-left py-3 px-4 font-semibold">Тариф</th>
                  <th className="text-left py-3 px-4 font-semibold">Статус</th>
                  <th className="text-left py-3 px-4 font-semibold">Изменить тариф</th>
                  <th className="text-center py-3 px-4 font-semibold">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4">
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-gray-700">
                          {user.restaurants.length} / {user.subscriptions?.[0]?.pricingTier?.maxRestaurants || 1}
                        </div>
                        {user.restaurants.length > 0 && (
                          <details className="text-sm">
                            <summary className="cursor-pointer text-primary-600 hover:text-primary-700">
                              Показать рестораны
                            </summary>
                            <div className="mt-2 space-y-1 pl-4">
                              {user.restaurants.map((restaurant) => (
                                <div key={restaurant.id} className="text-xs text-gray-600">
                                  • {restaurant.name}
                                  <a
                                    href={`/menu/${restaurant.subdomain}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary-500 hover:underline ml-1"
                                  >
                                    ({restaurant.subdomain})
                                  </a>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-medium">
                        {user.subscriptions?.[0]?.pricingTier?.name || 'TRIAL'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(user.subscriptions?.[0]?.status || 'TRIAL')}`}>
                        {user.subscriptions?.[0]?.status || 'TRIAL'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex gap-2">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              handleUpdateUserSubscription(user.id, e.target.value);
                              e.target.value = '';
                            }
                          }}
                          className="text-sm border rounded px-3 py-1.5 min-w-[150px] focus:outline-none focus:ring-2 focus:ring-primary-500"
                          defaultValue=""
                        >
                          <option value="">Выбрать тариф...</option>
                          {pricingTiers.map((tier) => (
                            <option key={tier.id} value={tier.id}>
                              {tier.name} (${tier.price})
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleOpenSubscriptionModal(user)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Расширенные настройки подписки"
                        >
                          ⚙️
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleOpenEditModal(user)}
                          className="p-2 text-primary-600 hover:bg-primary-50 rounded transition-colors"
                          title="Изменить учетные данные"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeactivateUser(user)}
                          className="p-2 text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
                          title="Деактивировать пользователя"
                        >
                          🔒
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Удалить пользователя"
                        >
                          ❌
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {searchQuery ? 'Пользователи не найдены' : 'Нет пользователей'}
            </div>
          )}
        </div>
      </div>

      {/* Edit Credentials Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Изменить учетные данные</h2>
            <p className="text-sm text-gray-600 mb-4">
              Пользователь: <strong>{editingUser?.name}</strong>
            </p>

            <form onSubmit={handleUpdateCredentials} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="input w-full"
                  placeholder="Новый email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Новый пароль
                </label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="input w-full"
                  placeholder="Оставьте пустым, чтобы не менять"
                  minLength={6}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Минимум 6 символов. Оставьте пустым, если не хотите менять пароль.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="flex-1 btn-secondary"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subscription Settings Modal */}
      {showSubscriptionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Настройки подписки</h2>
            <p className="text-sm text-gray-600 mb-4">
              Пользователь: <strong>{editingUser?.name}</strong>
              {editingUser?.restaurants?.[0]?.businessType && (
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${editingUser.restaurants[0].businessType === 'ONLINE_STORE' ? 'bg-purple-100 text-purple-700' :
                    editingUser.restaurants[0].businessType === 'HOTEL' ? 'bg-green-100 text-green-700' :
                      'bg-blue-100 text-blue-700'
                  }`}>
                  {editingUser.restaurants[0].businessType === 'ONLINE_STORE' ? '🛍 Магазин' : editingUser.restaurants[0].businessType === 'HOTEL' ? '🏨 Отель' : '🍽 Ресторан'}
                </span>
              )}
            </p>

            <form onSubmit={handleSubmitSubscription} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Тариф
                </label>
                <select
                  value={subscriptionForm.pricingTierId}
                  onChange={(e) => setSubscriptionForm({ ...subscriptionForm, pricingTierId: e.target.value })}
                  className="input w-full"
                  required
                >
                  <option value="">Выберите тариф</option>
                  {pricingTiers.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.name} (${tier.price}/мес) {tier.businessType === 'ONLINE_STORE' ? '🛍' : tier.businessType === 'HOTEL' ? '🏨' : tier.businessType === 'ALL' ? '📦' : '🍽'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Длительность (месяцев)
                </label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={subscriptionForm.durationMonths}
                  onChange={(e) => setSubscriptionForm({ ...subscriptionForm, durationMonths: e.target.value })}
                  className="input w-full"
                  placeholder="Количество месяцев"
                />
                <p className="text-xs text-gray-500 mt-1">
                  По умолчанию используется 1 месяц если не указаны конкретные даты
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Дата начала
                </label>
                <input
                  type="date"
                  value={subscriptionForm.startDate}
                  onChange={(e) => setSubscriptionForm({ ...subscriptionForm, startDate: e.target.value })}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Дата окончания (опционально)
                </label>
                <input
                  type="date"
                  value={subscriptionForm.endDate}
                  onChange={(e) => setSubscriptionForm({ ...subscriptionForm, endDate: e.target.value })}
                  className="input w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Если указана, длительность игнорируется
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSubscriptionModal(false)}
                  className="flex-1 btn-secondary"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary"
                >
                  Применить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default AdminPage;
