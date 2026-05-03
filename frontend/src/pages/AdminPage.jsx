import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { confirmDialog } from '../utils/confirmDialog';
import DashboardLayout from '../components/DashboardLayout';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

const BUSINESS_TYPE_LABELS = {
  RESTAURANT: { label: 'Ресторан', icon: '🍽', badge: 'bg-blue-100 text-blue-700' },
  ONLINE_STORE: { label: 'Магазин', icon: '🛍', badge: 'bg-purple-100 text-purple-700' },
  HOTEL: { label: 'Отель', icon: '🏨', badge: 'bg-green-100 text-green-700' },
  ALL: { label: 'Универсальный', icon: '📦', badge: 'bg-gray-100 text-gray-700' }
};

const getBusinessTypeMeta = (businessType) => (
  BUSINESS_TYPE_LABELS[businessType] || BUSINESS_TYPE_LABELS.RESTAURANT
);

const getPrimaryBusinessType = (user) => {
  const restaurantTypes = user?.restaurants?.map((restaurant) => restaurant.businessType).filter(Boolean) || [];
  const uniqueTypes = [...new Set(restaurantTypes)];

  if (uniqueTypes.length === 1) {
    return uniqueTypes[0];
  }

  return uniqueTypes.length > 1 ? 'ALL' : 'RESTAURANT';
};

const getCompatiblePricingTiers = (pricingTiers, businessType) => (
  pricingTiers.filter((tier) => {
    const tierBusinessType = tier.businessType || 'RESTAURANT';
    return tierBusinessType === 'ALL' || (businessType !== 'ALL' && tierBusinessType === businessType);
  })
);

const AdminPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
      showNotification(t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserSubscription = async (userId, pricingTierId, options = {}) => {
    try {
      const payload = { pricingTierId, ...options };
      await api.put(`/admin/users/${userId}/subscriptions`, payload);
      await loadData();
      showNotification(t('admin.messages.subscriptionUpdated'));
      setShowSubscriptionModal(false);
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || t('common.error');
      showNotification(`${t('common.error')}: ${errorMessage}`, 'error');
    }
  };

  const handleOpenSubscriptionModal = (user) => {
    setEditingUser(user);
    const today = new Date().toISOString().split('T')[0];
    const businessType = getPrimaryBusinessType(user);
    const currentPricingTierId = user.subscriptions?.[0]?.pricingTierId || '';
    const compatibleTiers = getCompatiblePricingTiers(pricingTiers, businessType);
    const pricingTierId = compatibleTiers.some((tier) => tier.id === currentPricingTierId)
      ? currentPricingTierId
      : '';

    setSubscriptionForm({
      pricingTierId,
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
      t('admin.messages.confirmDeactivate', { name: user.name }),
      {
        confirmText: t('common.yes'),
        cancelText: t('common.cancel'),
        icon: '⚠️'
      }
    );
    if (!confirmed) {
      return;
    }

    try {
      await api.post(`/admin/users/${user.id}/deactivate`);
      await loadData();
      showNotification(t('admin.messages.userDeactivated'));
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || t('common.error');
      showNotification(`${t('common.error')}: ${errorMessage}`, 'error');
    }
  };

  const handleDeleteUser = async (user) => {
    const confirmed = await confirmDialog(
      t('admin.messages.confirmDelete', { name: user.name }),
      {
        confirmText: t('common.delete'),
        cancelText: t('common.cancel'),
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
      showNotification(t('admin.messages.userDeleted'));
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || t('common.error');
      showNotification(`${t('common.error')}: ${errorMessage}`, 'error');
    }
  };

  const handleUpdateCredentials = async (e) => {
    e.preventDefault();

    if (!editForm.email && !editForm.password) {
      showNotification(t('auth.fillAllFields'), 'error');
      return;
    }

    if (editForm.password && editForm.password.length < 6) {
      showNotification(t('auth.passwordMismatch'), 'error'); // Using existing error or add new one
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
      showNotification(t('admin.messages.credentialsUpdated'));
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || t('common.error');
      showNotification(`${t('common.error')}: ${errorMessage}`, 'error');
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
        <div className="text-xl">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <DashboardLayout userData={user} selectedRestaurantId={null}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.title')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('admin.subtitle')}</p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-sm text-gray-500 mb-2">{t('admin.users')}</p>
              <p className="text-2xl font-bold text-gray-900">{users.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-sm text-gray-500 mb-2">{t('admin.restaurants')}</p>
              <p className="text-2xl font-bold text-gray-900">{getTotalRestaurants()}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-sm text-gray-500 mb-2">{t('admin.activeSubscriptions')}</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.stats.find(s => s.status === 'ACTIVE')?._count || 0}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-sm text-gray-500 mb-2">{t('admin.trialPeriod')}</p>
              <p className="text-2xl font-bold text-blue-600">
                {stats.stats.find(s => s.status === 'TRIAL')?._count || 0}
              </p>
            </div>
          </div>
        )}

        {/* Search and Users Table */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">{t('admin.users')} ({filteredUsers.length})</h2>
            <div className="w-80">
              <input
                type="text"
                placeholder={t('admin.searchPlaceholder')}
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
                  <th className="text-left py-3 px-4 font-semibold">{t('admin.table.user')}</th>
                  <th className="text-left py-3 px-4 font-semibold">{t('admin.table.restaurants')}</th>
                  <th className="text-left py-3 px-4 font-semibold">{t('admin.table.pricing')}</th>
                  <th className="text-left py-3 px-4 font-semibold">{t('admin.table.status')}</th>
                  <th className="text-left py-3 px-4 font-semibold">{t('admin.table.changePricing')}</th>
                  <th className="text-center py-3 px-4 font-semibold">{t('admin.table.actions')}</th>
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
                              {t('admin.table.showRestaurants')}
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
                          <option value="">{t('admin.table.selectPricing')}</option>
                          {getCompatiblePricingTiers(pricingTiers, getPrimaryBusinessType(user)).map((tier) => (
                            <option key={tier.id} value={tier.id}>
                              {tier.name} (${tier.price}) {getBusinessTypeMeta(tier.businessType || 'RESTAURANT').icon}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleOpenSubscriptionModal(user)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title={t('admin.modals.subscriptionTitle')}
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
                          title={t('admin.actions.editCredentials')}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeactivateUser(user)}
                          className="p-2 text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
                          title={t('admin.actions.deactivate')}
                        >
                          🔒
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title={t('admin.actions.delete')}
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
              {searchQuery ? t('common.noData') : t('common.noData')}
            </div>
          )}
        </div>
      </div>

      {/* Edit Credentials Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">{t('admin.modals.editCredentialsTitle')}</h2>
            <p className="text-sm text-gray-600 mb-4">
              {t('admin.table.user')}: <strong>{editingUser?.name}</strong>
            </p>

            <form onSubmit={handleUpdateCredentials} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('auth.email')}
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
                  {t('admin.modals.newPassword')}
                </label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="input w-full"
                  placeholder=""
                  minLength={6}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('admin.modals.passwordHint')}
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="flex-1 btn-secondary"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary"
                >
                  {t('common.save')}
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
            <h2 className="text-xl font-bold mb-4">{t('admin.modals.subscriptionTitle')}</h2>
            <p className="text-sm text-gray-600 mb-4">
              {t('admin.table.user')}: <strong>{editingUser?.name}</strong>
              {editingUser?.restaurants?.length > 0 && (() => {
                const businessType = getPrimaryBusinessType(editingUser);
                const meta = getBusinessTypeMeta(businessType);

                return (
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${meta.badge}`}>
                    {meta.icon} {businessType === 'ALL' ? 'Несколько типов' : meta.label}
                  </span>
                );
              })()}
            </p>

            {editingUser?.restaurants?.length > 0 && getCompatiblePricingTiers(pricingTiers, getPrimaryBusinessType(editingUser)).length === 0 && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mb-4">
                Для этого типа бизнеса нет активных тарифов. Создайте тариф в разделе управления тарифами.
              </p>
            )}
            {editingUser?.restaurants?.length > 1 && getPrimaryBusinessType(editingUser) === 'ALL' && (
              <p className="text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-md px-3 py-2 mb-4">
                У пользователя несколько типов бизнеса, поэтому доступны только универсальные тарифы.
              </p>
            )}

            <form onSubmit={handleSubmitSubscription} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.table.pricing')}
                </label>
                <select
                  value={subscriptionForm.pricingTierId}
                  onChange={(e) => setSubscriptionForm({ ...subscriptionForm, pricingTierId: e.target.value })}
                  className="input w-full"
                  required
                >
                  <option value="">{t('admin.table.selectPricing')}</option>
                  {getCompatiblePricingTiers(pricingTiers, getPrimaryBusinessType(editingUser)).map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.name} (${tier.price}/мес) {getBusinessTypeMeta(tier.businessType || 'RESTAURANT').icon}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.modals.duration')}
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
                  {t('admin.modals.durationHint')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.modals.startDate')}
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
                  {t('admin.modals.endDate')}
                </label>
                <input
                  type="date"
                  value={subscriptionForm.endDate}
                  onChange={(e) => setSubscriptionForm({ ...subscriptionForm, endDate: e.target.value })}
                  className="input w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('admin.modals.endDateHint')}
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSubscriptionModal(false)}
                  className="flex-1 btn-secondary"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary"
                >
                  {t('admin.actions.apply')}
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
