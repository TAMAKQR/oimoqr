import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { restaurantService } from '../services/restaurantService';
import { pricingService } from '../services/pricingService';
import { analyticsService } from '../services/analyticsService';
import RestaurantSelector from '../components/RestaurantSelector';
import DashboardLayout from '../components/DashboardLayout';
import { ordersService } from '../services/ordersService';
import toast from 'react-hot-toast';

const getCurrencySymbol = (currencyCode) => {
  const currencySymbols = {
    RUB: '₽',
    KZT: '₸',
    USD: '$',
    EUR: '€',
    GBP: '£',
    UAH: '₴',
    TRY: '₺',
    AMD: '֏',
    GEL: '₾',
    UZS: "so'm",
    KGS: 'с',
    VND: '₫',
    // JPY: '¥', // JPY не было в списке, но я оставлю на всякий случай
  };
  return currencySymbols[currencyCode] || '₽'; // По умолчанию используем ₽
};

const DashboardPage = () => {
  const [pricingTiers, setPricingTiers] = useState([]);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [userData, setUserData] = useState(null);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRestaurant, setNewRestaurant] = useState({ name: '', subdomain: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [views, setViews] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isOrderLoading, setIsOrderLoading] = useState(false);
  const lastOrderIdRef = useRef(null);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  const ORDER_STATUSES = [
    { value: 'new', label: 'Новый' },
    { value: 'confirmed', label: 'Подтвержден' },
    { value: 'preparing', label: 'Готовится' },
    { value: 'ready', label: 'Готов' },
    { value: 'delivered', label: 'Доставлен' },
    { value: 'completed', label: 'Выполнен' },
    { value: 'cancelled', label: 'Отменен' }
  ];

  useEffect(() => {
    loadUserData();
    loadPricingTiers();
  }, []);

  useEffect(() => {
    // Redirect admin to admin panel
    if (userData?.isAdmin) {
      navigate('/admin');
    }
  }, [userData, navigate]);

  const loadPricingTiers = async () => {
    try {
      const tiers = await pricingService.getPricingTiers();
      setPricingTiers(tiers);
    } catch (err) {
      console.error('Error loading pricing tiers:', err);
    }
  };

  useEffect(() => {
    if (userData) {
      const allRestaurants = [
        ...(userData.restaurants || []),
        ...(userData.restaurantStaff?.map(s => s.restaurant) || [])
      ];

      if (allRestaurants.length > 0) {
        // Проверяем, существует ли текущий выбранный ресторан в обновленных данных
        const currentSelectedRestaurantExists = allRestaurants.some(r => r.id === selectedRestaurantId);

        // Если ресторан не выбран или выбранный ресторан больше не существует,
        // выбираем первый доступный ресторан
        if (!selectedRestaurantId || !currentSelectedRestaurantExists) {
          setSelectedRestaurantId(allRestaurants[0].id);
        }
      } else {
        // Если ресторанов нет, очищаем выбранный ID
        setSelectedRestaurantId(null);
      }
    }
  }, [userData, selectedRestaurantId]); // selectedRestaurantId теперь в зависимостях

  // Загрузка статистики при выборе ресторана
  useEffect(() => {
    if (selectedRestaurantId) {
      loadStats();
      loadUserData(); // Перезагружаем данные пользователя (и ресторана) при смене
    }
  }, [selectedRestaurantId]);

  useEffect(() => {
    if (!selectedRestaurantId) return undefined;

    const intervalId = setInterval(() => {
      checkForNewOrders();
    }, 15000);

    return () => clearInterval(intervalId);
  }, [selectedRestaurantId]);

  const loadStats = async () => {
    if (!selectedRestaurantId) return;

    setLoadingStats(true);
    try {
      const [statsData, viewsData] = await Promise.all([
        analyticsService.getRestaurantStats(selectedRestaurantId),
        analyticsService.getRestaurantViews(selectedRestaurantId)
      ]);
      setStats(statsData);
      setViews(viewsData);
      if (statsData?.recentOrders?.[0]?.id) {
        lastOrderIdRef.current = statsData.recentOrders[0].id;
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const checkForNewOrders = async () => {
    if (!selectedRestaurantId) return;

    try {
      const statsData = await analyticsService.getRestaurantStats(selectedRestaurantId);
      const latestId = statsData?.recentOrders?.[0]?.id;

      if (latestId) {
        if (lastOrderIdRef.current && lastOrderIdRef.current !== latestId) {
          const latestOrder = statsData.recentOrders[0];
          toast.success(`Новый заказ ${latestOrder.orderNumber || ''}`.trim());
        }
        lastOrderIdRef.current = latestId;
      }

      setStats(statsData);
    } catch (err) {
      console.error('Error polling orders:', err);
    }
  };

  const openOrderDetails = async (orderId) => {
    setIsOrderLoading(true);
    try {
      const order = await ordersService.getOrder(orderId);
      setSelectedOrder(order);
      setIsOrderModalOpen(true);
    } catch (err) {
      console.error('Error loading order details:', err);
      const errorMessage = typeof err === 'string' ? err : err?.error || err?.message || 'Не удалось загрузить заказ';
      toast.error(errorMessage);
    } finally {
      setIsOrderLoading(false);
    }
  };

  const closeOrderModal = () => {
    setIsOrderModalOpen(false);
    setSelectedOrder(null);
  };

  const handleUpdateOrderStatus = async (orderId, status) => {
    if (!status) return;
    setUpdatingStatusId(orderId);
    try {
      await ordersService.updateStatus(orderId, status);
      toast.success('Статус заказа обновлен');
      await loadStats();

      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status } : prev));
      }
    } catch (err) {
      console.error('Error updating order status:', err);
      const errorMessage = typeof err === 'string' ? err : err?.error || err?.message || 'Не удалось изменить статус';
      toast.error(errorMessage);
    } finally {
      setUpdatingStatusId(null);
    }
  };

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

  const getSelectedRestaurant = () => {
    if (!userData || !selectedRestaurantId) return null;

    const owned = userData.restaurants?.find(r => r.id === selectedRestaurantId);
    if (owned) return owned;

    const staff = userData.restaurantStaff?.find(s => s.restaurant.id === selectedRestaurantId);
    return staff?.restaurant || null;
  };

  // Проверка: является ли пользователь владельцем выбранного ресторана
  const isOwner = () => {
    return userData?.restaurants?.some(r => r.id === selectedRestaurantId) || false;
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleCreateRestaurant = async () => {
    if (!newRestaurant.name.trim() || !newRestaurant.subdomain.trim()) {
      setError('Название и субдомен обязательны');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const restaurantData = {
        ...newRestaurant,
        ownerId: userData.id, // Добавляем ID владельца
      };
      const response = await restaurantService.createRestaurant(restaurantData);

      // Проверяем только на настоящие ошибки (не requiresPayment - это просто информация)
      if (response.error) {
        let errorMessage = response.message || '';
        if (response.pricing?.monthlyPrice) {
          const currency = response.pricing?.currency || 'USD';
          const maxRestaurants = response.pricing?.maxRestaurants || response.pricing?.totalRestaurants;
          if (maxRestaurants) {
            errorMessage += `\n\nТребуемый тариф: $${response.pricing.monthlyPrice.toFixed(2)}/${currency === 'USD' ? 'мес' : 'мес'} за ${maxRestaurants} ${maxRestaurants === 1 ? 'ресторан' : 'ресторанов'}`;
          }
        }
        if (response.trial?.daysRemaining && response.trial.daysRemaining > 0) {
          errorMessage += `\n\nПробный период: осталось ${response.trial.daysRemaining} дней`;
        }
        setError(`⚠️ ${errorMessage}`);
        console.error('Cannot create restaurant:', response);
        return;
      }

      // Проверяем, что получили данные ресторана
      if (!response.restaurant?.id) {
        setError('⚠️ Ошибка при создании ресторана: неверный ответ от сервера');
        console.error('Invalid server response:', response);
        return;
      }

      setNewRestaurant({ name: '', subdomain: '' });
      setShowCreateModal(false);
      await loadUserData();
      setSelectedRestaurantId(response.restaurant.id);
    } catch (err) {
      setError(err.message || 'Ошибка при создании ресторана');
    } finally {
      setCreating(false);
    }
  };

  const getSubscriptionStatus = () => {
    // Подписка привязана к пользователю, а не к ресторану
    if (userData?.isAdmin) {
      return { status: 'Администратор платформы', details: 'Перенаправление в админ-панель...' };
    }

    if (!userData?.subscriptions || userData.subscriptions.length === 0) {
      return { status: 'Trial версия (7 дней)', details: null };
    }

    const sub = userData.subscriptions[0];
    const now = new Date();

    if (sub.status === 'TRIAL') {
      const daysLeft = Math.ceil((new Date(sub.trialEndsAt) - now) / (1000 * 60 * 60 * 24));
      return {
        status: `Trial версия (осталось ${Math.max(0, daysLeft)} дней)`,
        details: null
      };
    }

    if (sub.status === 'ACTIVE') {
      const endDate = new Date(sub.currentPeriodEnd);
      const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
      const maxRestaurants = sub.pricingTier?.maxRestaurants || 1;
      const currentRestaurantCount = userData?.restaurants?.length || 0;

      // Форматируем дату окончания
      const formattedEndDate = endDate.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      return {
        status: `Активная подписка: ${sub.pricingTier?.name || sub.plan}`,
        details: `Использовано ${currentRestaurantCount} из ${maxRestaurants} ${maxRestaurants === 1 ? 'ресторана' : 'ресторанов'}`,
        endDate: `Действует до ${formattedEndDate} (осталось ${daysLeft} ${daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'})`
      };
    }

    return { status: 'Подписка истекла', details: null };
  };

  const formatOrderAddress = (order) => {
    if (!order) return '—';
    if (order.customerAddress) {
      const { city, street, house, entrance, floor, apartment, comment } = order.customerAddress;
      const main = [city, street, house].filter(Boolean).join(', ');
      const details = [entrance && `подъезд ${entrance}`, floor && `${floor} этаж`, apartment && `кв. ${apartment}`]
        .filter(Boolean)
        .join(', ');
      const commentText = comment ? ` (${comment})` : '';
      return [main, details].filter(Boolean).join(' | ') + commentText;
    }

    return order.deliveryAddress || (order.deliveryType === 'pickup' ? 'Самовывоз' : '—');
  };

  const parseModifiers = (modifiers) => {
    if (!modifiers) return [];
    if (Array.isArray(modifiers)) return modifiers;

    if (typeof modifiers === 'string') {
      try {
        const parsed = JSON.parse(modifiers);
        return Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        return [];
      }
    }

    return [];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Загрузка...</div>
      </div>
    );
  }

  // Проверка: есть ли у пользователя рестораны
  const hasRestaurants = userData?.restaurants?.length > 0 || userData?.restaurantStaff?.length > 0;

  // Если нет ресторанов и пользователь не админ, показываем приглашение создать ресторан
  if (!hasRestaurants && !userData?.isAdmin) {
    return (
      <DashboardLayout userData={userData} selectedRestaurantId={null}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center py-12">
            <div className="text-6xl mb-6">🏪</div>
            <h2 className="text-3xl font-bold mb-4">Создайте свой первый ресторан</h2>
            <p className="text-gray-600 mb-8">У вас ещё нет ресторанов. Создайте первый ресторан, чтобы начать работу с платформой.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary text-lg px-8 py-4"
            >
              + Создать ресторан
            </button>
          </div>

          {/* Create Restaurant Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-md w-full p-6 sm:p-8">
                <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Создать новый ресторан</h2>

                {error && (
                  <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">
                    {error}
                  </div>
                )}

                <div className="space-y-4 mb-6 sm:mb-8">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Название ресторана</label>
                    <input
                      type="text"
                      value={newRestaurant.name}
                      onChange={(e) => setNewRestaurant({ ...newRestaurant, name: e.target.value })}
                      placeholder="Например: Пиццерия 'Мамино'"
                      className="input-field w-full"
                      disabled={creating}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Субдомен</label>
                    <div className="flex items-center">
                      <input
                        type="text"
                        value={newRestaurant.subdomain}
                        onChange={(e) => setNewRestaurant({ ...newRestaurant, subdomain: e.target.value.toLowerCase() })}
                        placeholder="mamino-pizza"
                        className="input-field flex-1"
                        disabled={creating}
                      />
                      <span className="ml-2 text-gray-500 text-sm">.oimoqr.com</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Только буквы, цифры и дефисы
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 sm:gap-4">
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setError('');
                    }}
                    className="btn-secondary flex-1"
                    disabled={creating}
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleCreateRestaurant}
                    className="btn-primary flex-1"
                    disabled={creating}
                  >
                    {creating ? 'Создание...' : 'Создать'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout userData={userData} selectedRestaurantId={selectedRestaurantId}>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold">Панель управления</h2>
          <button onClick={handleLogout} className="btn-secondary text-red-600 hover:bg-red-50">
            Выйти
          </button>
        </div>

        {/* Restaurant Selector */}
        {userData && (
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Выберите ресторан</label>
              {/* Кнопка создания ресторана видна только владельцам, не менеджерам */}
              {(userData?.restaurants?.length > 0 || (userData?.restaurantStaff?.length === 0 && !userData?.restaurants)) && (
                <button
                  onClick={() => {
                    const currentRestaurantCount = userData?.restaurants?.length || 0;

                    // Проверяем активную подписку
                    const activeSubscription = userData?.subscriptions?.find(sub => sub.status === 'ACTIVE');

                    if (currentRestaurantCount === 0) {
                      // Первый ресторан - всегда разрешаем создание (trial)
                      setShowCreateModal(true);
                      setError('');
                      return;
                    }

                    if (!activeSubscription) {
                      // Для админа эта логика не нужна, он может создавать рестораны без подписки
                      if (userData?.isAdmin) {
                        setShowCreateModal(true);
                        return;
                      }
                      const pricingMessage = pricingTiers.length > 0
                        ? `\n\nДоступные тарифы:\n${pricingTiers.map(tier => {
                          const tierInfo = `${tier.name} - $${tier.price.toFixed(2)}/мес`;
                          const restaurantInfo = tier.maxRestaurants ? ` (до ${tier.maxRestaurants} ресторанов)` : '';
                          return tierInfo + restaurantInfo;
                        }).join('\n')}`
                        : '';

                      setError(`Для создания дополнительных ресторанов требуется активная подписка.${pricingMessage}\n\nСвяжитесь с администратором для активации подписки.`);
                      setShowCreateModal(false);
                      return;
                    }

                    // Есть активная подписка - проверяем лимит
                    const maxRestaurants = activeSubscription.pricingTier?.maxRestaurants || 1;

                    if (currentRestaurantCount >= maxRestaurants) {
                      setError(`Достигнут лимит ресторанов для текущего тарифа "${activeSubscription.pricingTier?.name || activeSubscription.plan}" (${maxRestaurants} ${maxRestaurants === 1 ? 'ресторан' : 'ресторанов'}).\n\nДля создания дополнительных ресторанов обновите тариф или свяжитесь с администратором.`);
                      setShowCreateModal(false);
                    } else {
                      // Есть место в рамках тарифа
                      setShowCreateModal(true);
                      setError('');
                    }
                  }}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  + Добавить ресторан
                </button>
              )}
            </div>
            {error && !showCreateModal && (
              <div className="bg-red-50 text-red-700 p-3 rounded mb-4">
                <h4 className="font-medium mb-2">⚠️ Требуется подписка</h4>
                {error.split('\n').map((line, index) => (
                  <p key={index} className={`text-sm ${line.includes('тарифы:') ? 'font-medium mt-2' : 'mt-1'}`}>
                    {line}
                  </p>
                ))}
              </div>
            )}
            <RestaurantSelector
              userData={userData}
              selectedRestaurantId={selectedRestaurantId}
              onSelectRestaurant={setSelectedRestaurantId}
            />
          </div>
        )}

        {/* Subscription Status */}
        {(() => {
          const subscriptionInfo = getSubscriptionStatus();
          const subscription = userData?.subscriptions?.[0];
          const pricingTier = subscription?.pricingTier;

          // Безопасный парсинг features
          let features = [];
          if (pricingTier?.features) {
            if (typeof pricingTier.features === 'string') {
              try {
                // Пытаемся парсить как JSON
                features = JSON.parse(pricingTier.features);
              } catch (e) {
                // Если не JSON, используем как обычную строку (разбиваем по запятой или оставляем как массив из одной строки)
                features = pricingTier.features.split(',').map(f => f.trim()).filter(Boolean);
              }
            } else if (Array.isArray(pricingTier.features)) {
              features = pricingTier.features;
            }
          }

          return (
            <div className="card p-4 sm:p-6 mb-6 sm:mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg sm:text-xl font-semibold">Ваша подписка</h3>
                {subscription?.status === 'TRIAL' && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                    ПРОБНЫЙ ПЕРИОД
                  </span>
                )}
                {subscription?.status === 'ACTIVE' && (
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    АКТИВНА
                  </span>
                )}
              </div>

              <div className="space-y-4">
                {/* Тариф */}
                <div>
                  <p className="text-base sm:text-lg font-medium break-words">{subscriptionInfo.status}</p>
                  {subscriptionInfo.details && (
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">
                      {subscriptionInfo.details}
                    </p>
                  )}
                  {subscriptionInfo.endDate && (
                    <p className="text-xs sm:text-sm text-orange-600 font-medium mt-1">
                      ⏰ {subscriptionInfo.endDate}
                    </p>
                  )}
                </div>

                {/* Возможности тарифа */}
                {pricingTier && features.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Возможности вашего тарифа:</p>
                    <ul className="space-y-1">
                      {features.map((feature, index) => (
                        <li key={index} className="text-xs sm:text-sm text-gray-600 flex items-start gap-2">
                          <span className="text-green-500 mt-0.5">✓</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-gray-500">
                        💰 Стоимость: <span className="font-medium">${pricingTier.price}/месяц</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        🏢 Максимум ресторанов: <span className="font-medium">{pricingTier.maxRestaurants}</span>
                      </p>
                    </div>
                  </div>
                )}

                {/* Сообщение для триальных пользователей */}
                {subscription?.status === 'TRIAL' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs sm:text-sm text-blue-800">
                      💡 После окончания пробного периода свяжитесь с администратором для активации платной подписки
                    </p>
                  </div>
                )}

                {/* Кнопка просмотра тарифов */}
                {subscription?.status === 'TRIAL' && (
                  <button
                    onClick={() => navigate('/pricing')}
                    className="btn-primary w-full sm:w-auto"
                  >
                    📋 Посмотреть тарифы
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {/* Restaurant Info */}
        {getSelectedRestaurant() && (
          <div className="card p-4 sm:p-6 mb-6 sm:mb-8">
            <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Информация о ресторане</h3>
            <div className="space-y-2 text-sm sm:text-base">
              <p className="break-words"><strong>Название:</strong> {getSelectedRestaurant().name}</p>
              <p className="break-all"><strong>Субдомен:</strong> {getSelectedRestaurant().subdomain}.oimoqr.com</p>
              <a
                href={`/menu/${getSelectedRestaurant().subdomain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-3 sm:mt-4 btn-primary text-sm sm:text-base w-full sm:w-auto text-center"
              >
                Посмотреть меню
              </a>
            </div>
          </div>
        )}

        {/* Analytics Dashboard */}
        {selectedRestaurantId && (
          <>
            {loadingStats ? (
              <div className="text-center py-8">
                <div className="text-lg text-gray-600">Загрузка статистики...</div>
              </div>
            ) : stats && views ? (
              <>
                {/* Overview Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
                  <div className="card p-4 sm:p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-600 text-sm mb-1">Просмотры меню</p>
                        <p className="text-2xl sm:text-3xl font-bold text-primary-600">{views.today}</p>
                        <p className="text-xs text-gray-500 mt-1">За сегодня</p>
                      </div>
                      <div className="text-4xl">👁️</div>
                    </div>
                  </div>

                  <div className="card p-4 sm:p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-600 text-sm mb-1">Всего блюд</p>
                        <p className="text-2xl sm:text-3xl font-bold text-green-600">{stats.overview.totalDishes}</p>
                        <p className="text-xs text-gray-500 mt-1">{stats.overview.totalCategories} категорий</p>
                      </div>
                      <div className="text-4xl">🍽️</div>
                    </div>
                  </div>

                  <div className="card p-4 sm:p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-600 text-sm mb-1">Заказы</p>
                        <p className="text-2xl sm:text-3xl font-bold text-blue-600">{stats.period.today.orders}</p>
                        <p className="text-xs text-gray-500 mt-1">За сегодня</p>
                      </div>
                      <div className="text-4xl">📱</div>
                    </div>
                  </div>

                  <div className="card p-4 sm:p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-600 text-sm mb-1">Выручка</p>
                        <p className="text-2xl sm:text-3xl font-bold text-purple-600">
                          {stats.period.today.revenue.toFixed(0)} {getCurrencySymbol(getSelectedRestaurant()?.currency)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">За сегодня</p>
                      </div>
                      <div className="text-4xl">💰</div>
                    </div>
                  </div>
                </div>

                {/* Period Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
                  <div className="card p-4 sm:p-6 border-l-4 border-blue-500">
                    <h3 className="text-lg font-semibold mb-3">За неделю</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Заказы:</span>
                        <span className="font-semibold">{stats.period.week.orders}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Выручка:</span>
                        <span className="font-semibold">{stats.period.week.revenue.toFixed(0)} {getCurrencySymbol(getSelectedRestaurant()?.currency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Просмотры:</span>
                        <span className="font-semibold">{views.week}</span>
                      </div>
                    </div>
                  </div>

                  <div className="card p-4 sm:p-6 border-l-4 border-purple-500">
                    <h3 className="text-lg font-semibold mb-3">За месяц</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Заказы:</span>
                        <span className="font-semibold">{stats.period.month.orders}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Выручка:</span>
                        <span className="font-semibold">{stats.period.month.revenue.toFixed(0)} {getCurrencySymbol(getSelectedRestaurant()?.currency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Просмотры:</span>
                        <span className="font-semibold">{views.month}</span>
                      </div>
                    </div>
                  </div>

                  <div className="card p-4 sm:p-6 border-l-4 border-green-500">
                    <h3 className="text-lg font-semibold mb-3">Всего</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Заказы:</span>
                        <span className="font-semibold">{stats.overview.totalOrders}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Выручка:</span>
                        <span className="font-semibold">{stats.overview.totalRevenue.toFixed(0)} {getCurrencySymbol(getSelectedRestaurant()?.currency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Просмотры:</span>
                        <span className="font-semibold">{views.total}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chart and Recent Orders */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
                  {/* Chart */}
                  <div className="card p-4 sm:p-6">
                    <h3 className="text-lg font-semibold mb-4">📈 Заказы за неделю</h3>
                    <div className="space-y-3">
                      {stats.chartData.map((day, index) => {
                        const maxOrders = Math.max(...stats.chartData.map(d => d.orders), 1);
                        const percentage = (day.orders / maxOrders) * 100;
                        const date = new Date(day.date);
                        const dayName = date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' });

                        return (
                          <div key={index}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-600">{dayName}</span>
                              <span className="font-semibold">{day.orders} заказов</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Recent Orders */}
                  <div className="card p-4 sm:p-6">
                    <h3 className="text-lg font-semibold mb-4">📱 Последние заказы</h3>
                    {stats.recentOrders.length > 0 ? (
                      <div className="space-y-3">
                        {stats.recentOrders.map((order) => {
                          const statusColors = {
                            new: 'bg-blue-100 text-blue-800',
                            confirmed: 'bg-indigo-100 text-indigo-800',
                            preparing: 'bg-yellow-100 text-yellow-800',
                            ready: 'bg-green-100 text-green-800',
                            delivered: 'bg-emerald-100 text-emerald-800',
                            completed: 'bg-gray-100 text-gray-800',
                            cancelled: 'bg-red-100 text-red-800'
                          };
                          const statusLabels = {
                            new: 'Новый',
                            confirmed: 'Подтвержден',
                            preparing: 'Готовится',
                            ready: 'Готов',
                            delivered: 'Доставлен',
                            completed: 'Выполнен',
                            cancelled: 'Отменён'
                          };

                          return (
                            <div
                              key={order.id}
                              className="w-full text-left border-b pb-3 last:border-0 hover:bg-gray-50 rounded focus-within:ring-2 focus-within:ring-primary-300"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div className="cursor-pointer" onClick={() => openOrderDetails(order.id)}>
                                  <p className="font-semibold text-sm">#{order.orderNumber}</p>
                                  <p className="text-xs text-gray-600">{order.customerName}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[order.status] || statusColors.new}`}>
                                    {statusLabels[order.status] || order.status}
                                  </span>
                                  <select
                                    className="text-xs border rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
                                    value={order.status}
                                    onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                                    disabled={updatingStatusId === order.id}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {ORDER_STATUSES.map((s) => (
                                      <option key={s.value} value={s.value}>{s.label}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-500 cursor-pointer" onClick={() => openOrderDetails(order.id)}>
                                  {new Date(order.createdAt).toLocaleString('ru-RU', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                                <span className="font-semibold text-purple-600">{order.totalAmount.toFixed(0)} {getCurrencySymbol(getSelectedRestaurant()?.currency)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm text-center py-8">Заказов пока нет</p>
                    )}
                  </div>
                </div>

                {/* Top Dishes */}
                {stats.topDishes.length > 0 && (
                  <div className="card p-4 sm:p-6">
                    <h3 className="text-lg font-semibold mb-4">🏆 Популярные блюда</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                      {stats.topDishes.map((dish, index) => (
                        <div key={dish.id} className="border rounded-lg p-3 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-2xl font-bold text-gray-300">#{index + 1}</span>
                            <span className="bg-primary-100 text-primary-700 px-2 py-1 rounded text-xs font-semibold">
                              {dish.totalQuantity} шт
                            </span>
                          </div>
                          <p className="font-semibold text-sm mb-1">{dish.name}</p>
                          <p className="text-xs text-gray-600">{dish.orderCount} заказов</p>
                          <p className="text-sm font-semibold text-primary-600 mt-1">{dish.price.toFixed(0)} {getCurrencySymbol(getSelectedRestaurant()?.currency)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="card p-8 text-center">
                <p className="text-gray-500">Статистика недоступна</p>
              </div>
            )}
          </>
        )}

        {isOrderModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between p-5 border-b">
                <div>
                  <h3 className="text-xl font-semibold">Заказ {selectedOrder?.orderNumber}</h3>
                  <p className="text-sm text-gray-500">
                    {selectedOrder?.customerName || 'Клиент'} · {selectedOrder ? new Date(selectedOrder.createdAt).toLocaleString('ru-RU') : ''}
                  </p>
                </div>
                <button
                  onClick={closeOrderModal}
                  className="text-gray-500 hover:text-gray-700"
                  aria-label="Закрыть модальное окно заказа"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-4">
                {isOrderLoading ? (
                  <div className="flex items-center justify-center py-12 text-gray-500">Загрузка заказа...</div>
                ) : selectedOrder ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-gray-50 border rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Клиент</h4>
                        <p className="font-semibold">{selectedOrder.customerName}</p>
                        <p className="text-sm text-gray-600">{selectedOrder.customerPhone}</p>
                        {selectedOrder.customerEmail && (
                          <p className="text-sm text-gray-600">{selectedOrder.customerEmail}</p>
                        )}
                        {selectedOrder.customer?.id && (
                          <p className="text-xs text-gray-500 mt-1">ID клиента: {selectedOrder.customer.id}</p>
                        )}
                      </div>

                      <div className="bg-gray-50 border rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Доставка и оплата</h4>
                        <p className="text-sm text-gray-700">Тип: <span className="font-semibold">{selectedOrder.deliveryType === 'pickup' ? 'Самовывоз' : 'Доставка'}</span></p>
                        <p className="text-sm text-gray-700">Оплата: <span className="font-semibold">{selectedOrder.paymentMethod === 'card' ? 'Картой' : 'Наличные'}</span></p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-sm text-gray-700">Статус:</span>
                          <select
                            className="text-sm border rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
                            value={selectedOrder.status}
                            onChange={(e) => handleUpdateOrderStatus(selectedOrder.id, e.target.value)}
                            disabled={updatingStatusId === selectedOrder.id}
                          >
                            {ORDER_STATUSES.map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        </div>
                        {selectedOrder.notes && (
                          <p className="text-sm text-gray-600 mt-2">Комментарий: {selectedOrder.notes}</p>
                        )}
                      </div>

                      <div className="bg-gray-50 border rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Адрес</h4>
                        <p className="text-sm text-gray-700 whitespace-pre-line break-words">{formatOrderAddress(selectedOrder)}</p>
                        {selectedOrder.customerAddress?.label && (
                          <p className="text-xs text-gray-500 mt-1">Метка: {selectedOrder.customerAddress.label}</p>
                        )}
                      </div>
                    </div>

                    <div className="bg-white border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-700">Состав заказа</h4>
                        <span className="text-sm text-gray-500">{selectedOrder.items?.length || 0} позиций</span>
                      </div>

                      <div className="space-y-3">
                        {selectedOrder.items?.map((item) => {
                          const modifiers = parseModifiers(item.selectedModifiers);
                          return (
                            <div key={item.id} className="flex justify-between items-start border-b last:border-0 pb-3 last:pb-0">
                              <div>
                                <p className="font-semibold text-gray-900">{item.dish?.name || 'Блюдо удалено'}</p>
                                {modifiers.length > 0 && (
                                  <p className="text-xs text-gray-600 mt-1">{modifiers.map((m) => m.name).join(', ')}</p>
                                )}
                                <p className="text-xs text-gray-500 mt-1">Цена: {item.price.toFixed(0)} {getCurrencySymbol(selectedOrder.restaurant?.currency || getSelectedRestaurant()?.currency)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-gray-700">{item.quantity} шт.</p>
                                <p className="font-semibold text-gray-900 mt-1">{(item.price * item.quantity).toFixed(0)} {getCurrencySymbol(selectedOrder.restaurant?.currency || getSelectedRestaurant()?.currency)}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex justify-between items-center mt-4 pt-4 border-t">
                        <span className="text-sm text-gray-600">Итого</span>
                        <span className="text-lg font-bold text-gray-900">{selectedOrder.totalAmount.toFixed(0)} {getCurrencySymbol(selectedOrder.restaurant?.currency || getSelectedRestaurant()?.currency)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-gray-500">Нет данных заказа</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="card p-4 sm:p-6 mt-6 sm:mt-8 bg-primary-50 border-primary-200">
          <h3 className="text-base sm:text-lg font-semibold mb-2">💡 Совет</h3>
          <p className="text-gray-700 text-sm sm:text-base">
            Добавьте красивые фотографии блюд и подробные описания, чтобы увеличить количество заказов.
            Не забудьте настроить баннеры для акций и специальных предложений!
          </p>
        </div>

        {/* Create Restaurant Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6 sm:p-8">
              <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Создать новый ресторан</h2>

              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4 mb-6 sm:mb-8">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Название ресторана</label>
                  <input
                    type="text"
                    value={newRestaurant.name}
                    onChange={(e) => setNewRestaurant({ ...newRestaurant, name: e.target.value })}
                    placeholder="Например: Пиццерия 'Мамино'"
                    className="input w-full"
                    disabled={creating}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Субдомен</label>
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={newRestaurant.subdomain}
                      onChange={(e) => setNewRestaurant({ ...newRestaurant, subdomain: e.target.value.toLowerCase() })}
                      placeholder="mamino-pizza"
                      className="input flex-1"
                      disabled={creating}
                    />
                    <span className="ml-2 text-gray-500 text-sm">.oimoqr.com</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Только буквы, цифры и дефисы
                  </p>
                </div>
              </div>

              <div className="flex gap-3 sm:gap-4">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setError('');
                  }}
                  className="btn-secondary flex-1"
                  disabled={creating}
                >
                  Отмена
                </button>
                <button
                  onClick={handleCreateRestaurant}
                  className="btn-primary flex-1"
                  disabled={creating}
                >
                  {creating ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
