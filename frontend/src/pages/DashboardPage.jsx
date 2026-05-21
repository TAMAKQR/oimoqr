import { useState, useEffect, useRef, useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { restaurantService } from '../services/restaurantService';
import { pricingService } from '../services/pricingService';
import { analyticsService } from '../services/analyticsService';
import RestaurantSelector from '../components/RestaurantSelector';
import DashboardLayout from '../components/DashboardLayout';
import { ordersService } from '../services/ordersService';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { useUserData } from '../hooks/useUserData';
import { useSelectedRestaurant } from '../hooks/useSelectedRestaurant';
import { getBusinessType, BUSINESS_TYPE_OPTIONS } from '../utils/businessTypes';

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

const DashLineChart = ({ data, dataKey = 'orders', color = '#8b5cf6', height = 180 }) => {
  const [hover, setHover] = useState(null);
  if (!data?.length) return <div className="h-[180px] flex items-center justify-center text-gray-400 text-sm">Нет данных</div>;

  const values = data.map(d => Number(d[dataKey]) || 0);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;

  const padX = 45, padTop = 10, padBottom = 28;
  const w = 600;
  const chartH = height - padTop - padBottom;

  const points = data.map((d, i) => {
    const x = padX + (i / Math.max(data.length - 1, 1)) * (w - padX - 10);
    const y = padTop + chartH - ((values[i] - minVal) / range) * chartH;
    return { x, y, val: values[i], date: d.date };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${padTop + chartH} L${points[0].x},${padTop + chartH} Z`;

  const gridLines = Array.from({ length: 5 }, (_, i) => {
    const val = minVal + (range / 4) * i;
    const y = padTop + chartH - ((val - minVal) / range) * chartH;
    return { y, label: val >= 1000 ? `${(val / 1000).toFixed(1)}k` : Math.round(val).toString() };
  });

  const step = Math.max(Math.floor(data.length / 6), 1);
  const dateLabels = data.filter((_, i) => i % step === 0 || i === data.length - 1).map((d) => {
    const idx = data.indexOf(d);
    const x = padX + (idx / Math.max(data.length - 1, 1)) * (w - padX - 10);
    const dt = new Date(d.date);
    return { x, label: `${dt.getDate()}.${String(dt.getMonth() + 1).padStart(2, '0')}` };
  });

  const gradId = `grad-${color.replace('#', '')}-${dataKey}`;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {gridLines.map((g, i) => (
        <g key={i}>
          <line x1={padX} y1={g.y} x2={w - 10} y2={g.y} stroke="#f3f4f6" strokeWidth="1" />
          <text x={padX - 6} y={g.y + 4} textAnchor="end" fill="#9ca3af" fontSize="10">{g.label}</text>
        </g>
      ))}
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={hover === i ? 5 : 3} fill="white" stroke={color} strokeWidth="2"
          className="cursor-pointer" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
      ))}
      {dateLabels.map((d, i) => (
        <text key={i} x={d.x} y={height - 4} textAnchor="middle" fill="#9ca3af" fontSize="10">{d.label}</text>
      ))}
      {hover !== null && (
        <g>
          <line x1={points[hover].x} y1={padTop} x2={points[hover].x} y2={padTop + chartH} stroke={color} strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
          <rect x={points[hover].x - 40} y={points[hover].y - 32} width="80" height="24" rx="6" fill="#1f2937" />
          <text x={points[hover].x} y={points[hover].y - 16} textAnchor="middle" fill="white" fontSize="11" fontWeight="600">
            {Number(points[hover].val).toLocaleString('ru')}
          </text>
        </g>
      )}
    </svg>
  );
};

const DashboardPage = () => {
  const [pricingTiers, setPricingTiers] = useState([]);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { userData, loading, refresh: refreshUserData } = useUserData();
  const { selectedRestaurantId, setSelectedRestaurantId, selectedRestaurant, isOwner: isOwnerFlag } = useSelectedRestaurant(userData);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRestaurant, setNewRestaurant] = useState({ name: '', subdomain: '', businessType: 'RESTAURANT', country: '', city: '' });
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
  const [loadingGuardTriggered, setLoadingGuardTriggered] = useState(false);

  const canViewAnalytics = useMemo(() => {
    if (!selectedRestaurantId || !userData) return false;
    if (userData.isAdmin) return true;
    return (userData.restaurants || []).some((restaurant) => restaurant.id === selectedRestaurantId);
  }, [selectedRestaurantId, userData]);

  const restaurantsCount = userData?.restaurants?.length || 0;
  const isFirstRestaurantCreation = restaurantsCount === 0;

  const openCreateRestaurantModal = () => {
    const primaryRestaurant = selectedRestaurant || userData?.restaurants?.[0] || null;

    setNewRestaurant((prev) => ({
      name: isFirstRestaurantCreation
        ? (prev.name || '')
        : (primaryRestaurant?.name || prev.name || ''),
      subdomain: '',
      businessType: 'RESTAURANT',
      country: isFirstRestaurantCreation
        ? (prev.country || '')
        : (primaryRestaurant?.country || prev.country || ''),
      city: isFirstRestaurantCreation
        ? (prev.city || '')
        : (primaryRestaurant?.city || prev.city || '')
    }));

    setError('');
    setShowCreateModal(true);
  };

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
    loadPricingTiers();
  }, []);

  useEffect(() => {
    if (!loading) {
      setLoadingGuardTriggered(false);
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setLoadingGuardTriggered(true);
    }, 10000);

    return () => clearTimeout(timeoutId);
  }, [loading]);

  const loadPricingTiers = async () => {
    try {
      const tiers = await pricingService.getPricingTiers();
      setPricingTiers(tiers);
    } catch (err) {
      console.error('Error loading pricing tiers:', err);
    }
  };

  // Загрузка статистики при выборе ресторана
  useEffect(() => {
    if (selectedRestaurantId) {
      if (canViewAnalytics) {
        loadStats();
      } else {
        setStats(null);
        setViews(null);
        setLoadingStats(false);
        lastOrderIdRef.current = null;
      }
    }
  }, [selectedRestaurantId, canViewAnalytics]);

  useEffect(() => {
    if (!selectedRestaurantId || !canViewAnalytics) return undefined;

    const intervalId = setInterval(() => {
      checkForNewOrders();
    }, 15000);

    return () => clearInterval(intervalId);
  }, [selectedRestaurantId, canViewAnalytics]);

  const loadStats = async () => {
    if (!selectedRestaurantId || !canViewAnalytics) return;

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
      if (err?.status === 403) {
        setStats(null);
        setViews(null);
        lastOrderIdRef.current = null;
        return;
      }
      console.error('Error loading stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const checkForNewOrders = async () => {
    if (!selectedRestaurantId || !canViewAnalytics) return;

    try {
      const statsData = await analyticsService.getRestaurantStats(selectedRestaurantId);
      const latestId = statsData?.recentOrders?.[0]?.id;

      if (latestId) {
        if (lastOrderIdRef.current && lastOrderIdRef.current !== latestId) {
          const latestOrder = statsData.recentOrders[0];
          const normalizedOrderNumber = `#${String(latestOrder.orderNumber || '').replace(/^#+/, '')}`;
          toast.success(`Новый заказ ${normalizedOrderNumber}`.trim());
        }
        lastOrderIdRef.current = latestId;
      }

      setStats(statsData);
    } catch (err) {
      if (err?.status === 403) return;
      console.error('Error polling orders:', err);
      // console.error('Error polling orders:', err);
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

  const getSelectedRestaurant = () => selectedRestaurant;
  const isOwner = () => isOwnerFlag;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleCreateRestaurant = async () => {
    if (!newRestaurant.name.trim()) {
      setError('Название обязательно');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const restaurantData = {
        ...newRestaurant,
        ownerId: userData.id, // Добавляем ID владельца
      };

      if (!restaurantData.subdomain?.trim()) {
        delete restaurantData.subdomain; // Пусть бэкенд сгенерирует автоматически для филиалов
      }
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

      setNewRestaurant({ name: '', subdomain: '', businessType: 'RESTAURANT', country: '', city: '' });
      setShowCreateModal(false);
      await refreshUserData();
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

    if (order.deliveryType === 'dine_in') return order.tableNumber ? `Стол ${order.tableNumber}` : 'В зале';
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

  if (user?.isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (loading) {
    if (loadingGuardTriggered) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 p-6 text-center">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Загрузка занимает слишком много времени</h2>
            <p className="text-sm text-gray-600 mb-5">Попробуйте обновить страницу или войти заново.</p>
            <div className="flex gap-3">
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => window.location.reload()}
              >
                Обновить
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={() => {
                  logout();
                  navigate('/login', { replace: true });
                }}
              >
                Войти заново
              </button>
            </div>
          </div>
        </div>
      );
    }

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
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl mx-auto mb-6 flex items-center justify-center">
              <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016A3.001 3.001 0 0021 9.349m-18 0a2.997 2.997 0 003.75.616m-3.75-.616V2.99A1.5 1.5 0 014.5 1.5h15a1.5 1.5 0 011.5 1.5v6.849" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Создайте свой первый бизнес</h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">У вас ещё нет объектов. Создайте первый, чтобы начать работу с платформой.</p>
            <button
              onClick={openCreateRestaurantModal}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Создать ресторан
            </button>
          </div>

          {/* Create Restaurant Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-md w-full p-6 sm:p-8">
                <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">
                  {isFirstRestaurantCreation ? 'Создать ресторан' : 'Добавить филиал'}
                </h2>

                {error && (
                  <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">
                    {error}
                  </div>
                )}

                <div className="space-y-4 mb-6 sm:mb-8">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Тип бизнеса</label>
                    <div className="grid grid-cols-3 gap-3">
                      {BUSINESS_TYPE_OPTIONS.map(opt => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setNewRestaurant({ ...newRestaurant, businessType: opt.key })}
                          className={`p-3 rounded-xl border-2 text-center transition-all ${newRestaurant.businessType === opt.key ? `border-${opt.color}-500 bg-${opt.color}-50` : 'border-gray-200 hover:border-gray-300'}`}
                          disabled={creating}
                        >
                          <span className="text-2xl block mb-1">{opt.icon}</span>
                          <span className="text-sm font-medium">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{getBusinessType(newRestaurant.businessType).nameLabel}</label>
                    <input
                      type="text"
                      value={newRestaurant.name}
                      onChange={(e) => setNewRestaurant({ ...newRestaurant, name: e.target.value })}
                      placeholder={`Например: ${getBusinessType(newRestaurant.businessType).namePlaceholder}`}
                      className="input-field w-full"
                      disabled={creating}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Страна и город</label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={newRestaurant.country}
                        onChange={(e) => setNewRestaurant({ ...newRestaurant, country: e.target.value, city: '' })}
                        className="input-field"
                        disabled={creating}
                      >
                        <option value="">Выберите страну</option>
                        <option value="Кыргызстан">🇰🇬 Кыргызстан</option>
                        <option value="Турция">🇹🇷 Турция</option>
                        <option value="Казахстан">🇰🇿 Казахстан</option>
                        <option value="Узбекистан">🇺🇿 Узбекистан</option>
                        <option value="Россия">🇷🇺 Россия</option>
                        <option value="Таджикистан">🇹🇯 Таджикистан</option>
                      </select>
                      <input
                        type="text"
                        value={newRestaurant.city}
                        onChange={(e) => setNewRestaurant({ ...newRestaurant, city: e.target.value })}
                        placeholder="Город"
                        className="input-field"
                        disabled={creating}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Субдомен</label>
                    <div className="flex items-center">
                      <input
                        type="text"
                        value={isFirstRestaurantCreation ? newRestaurant.subdomain : ''}
                        onChange={(e) => {
                          if (!isFirstRestaurantCreation) return;
                          setNewRestaurant({ ...newRestaurant, subdomain: e.target.value.toLowerCase() });
                        }}
                        placeholder={isFirstRestaurantCreation
                          ? getBusinessType(newRestaurant.businessType).subdomainPlaceholder
                          : 'Сгенерируется автоматически'}
                        className="input-field flex-1"
                        disabled={creating || !isFirstRestaurantCreation}
                        readOnly={!isFirstRestaurantCreation}
                      />
                      <span className="ml-2 text-gray-500 text-sm">.oimoqr.com</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {isFirstRestaurantCreation
                        ? 'Только буквы, цифры и дефисы'
                        : 'Для филиалов субдомен создадим автоматически на базе главного ресторана'}
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
      <div className="max-w-6xl mx-auto">
        {/* Page header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Панель управления</h1>
          <p className="text-gray-500 text-sm mt-1">{getBusinessType(getSelectedRestaurant()?.businessType).overviewLabel}</p>
        </div>

        {/* Restaurant Selector */}
        {userData && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Выберите {selectedRestaurant ? getBusinessType(selectedRestaurant.businessType).label.toLowerCase() : 'заведение'}</label>
              {(userData?.restaurants?.length > 0 || (userData?.restaurantStaff?.length === 0 && !userData?.restaurants)) && (
                <button
                  onClick={() => {
                    const currentRestaurantCount = userData?.restaurants?.length || 0;

                    // Проверяем активную подписку
                    const activeSubscription = userData?.subscriptions?.find(sub => sub.status === 'ACTIVE');

                    if (currentRestaurantCount === 0) {
                      // Первый ресторан - всегда разрешаем создание (trial)
                      openCreateRestaurantModal();
                      return;
                    }

                    if (!activeSubscription) {
                      // Для админа эта логика не нужна, он может создавать рестораны без подписки
                      if (userData?.isAdmin) {
                        openCreateRestaurantModal();
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
                      openCreateRestaurantModal();
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
              placeholderLabel={selectedRestaurant ? getBusinessType(selectedRestaurant.businessType).label.toLowerCase() : 'заведение'}
              onSelectRestaurant={(id) => {
                setSelectedRestaurantId(id);
                localStorage.setItem('selectedRestaurantId', id);
              }}
            />
          </div>
        )}

        {/* Restaurant Info */}
        {getSelectedRestaurant() && (
          <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Информация о ресторане</h3>
            <div className="space-y-2 text-sm">
              <p><span className="text-gray-500">Название:</span> <span className="font-medium text-gray-900">{getSelectedRestaurant().name}</span></p>
              <p className="break-all"><span className="text-gray-500">Субдомен:</span> <span className="font-medium text-gray-900">{getSelectedRestaurant().subdomain}.oimoqr.com</span></p>
              <a
                href={`/${getBusinessType(getSelectedRestaurant()?.businessType).route}/${getSelectedRestaurant().subdomain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                {getBusinessType(getSelectedRestaurant()?.businessType).viewLabel}
              </a>
            </div>

            {/* General QR Code */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-4">
                <div className="bg-white p-2 rounded-lg border border-gray-200">
                  <QRCodeSVG
                    id="dashboard-general-qr"
                    value={`${window.location.origin}/${getBusinessType(getSelectedRestaurant()?.businessType).route}/${getSelectedRestaurant().subdomain}`}
                    size={80}
                    level="M"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 mb-1">{getBusinessType(getSelectedRestaurant()?.businessType).qrLabel}</p>
                  <button
                    onClick={() => {
                      const printWindow = window.open('', '_blank');
                      const url = `${window.location.origin}/${getBusinessType(getSelectedRestaurant()?.businessType).route}/${getSelectedRestaurant().subdomain}`;
                      const qrSvg = document.getElementById('dashboard-general-qr');
                      printWindow.document.write(`
                        <html><head><title>QR - ${getSelectedRestaurant().name}</title>
                        <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:sans-serif;}svg{width:300px;height:300px;}</style>
                        </head><body>
                        <h2>${getSelectedRestaurant().name}</h2>
                        ${qrSvg ? qrSvg.outerHTML : ''}
                        </body></html>`);
                      printWindow.document.close();
                      printWindow.focus();
                      setTimeout(() => { printWindow.print(); }, 300);
                    }}
                    className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 7.034V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659" />
                    </svg>
                    Печать
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Dashboard */}
        {selectedRestaurantId && (
          <>
            {!canViewAnalytics ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
                <h3 className="text-sm font-semibold text-amber-900 mb-1">Статистика ограничена</h3>
                <p className="text-sm text-amber-800">Для роли менеджера доступно управление стоп-листом. Аналитика доступна только владельцу ресторана.</p>
              </div>
            ) : loadingStats ? (
              <div className="text-center py-8">
                <div className="text-lg text-gray-600">Загрузка статистики...</div>
              </div>
            ) : stats && views ? (
              <>
                {/* Overview Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-500">Просмотры</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{views.today}</p>
                    <p className="text-xs text-gray-400 mt-1">За сегодня</p>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-500">{getSelectedRestaurant()?.businessType === 'ONLINE_STORE' ? 'Товары' : 'Блюда'}</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{stats.overview.totalDishes}</p>
                    <p className="text-xs text-gray-400 mt-1">{stats.overview.totalCategories} категорий</p>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-500">Заказы</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{stats.period.today.orders}</p>
                    <p className="text-xs text-gray-400 mt-1">За сегодня</p>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-500">Выручка</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.period.today.revenue.toFixed(0)} {getCurrencySymbol(getSelectedRestaurant()?.currency)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">За сегодня</p>
                  </div>
                </div>

                {/* Period Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-white rounded-xl border border-gray-100 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
                      <h3 className="text-sm font-semibold text-gray-900">За неделю</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Заказы</span>
                        <span className="text-sm font-semibold text-gray-900">{stats.period.week.orders}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Выручка</span>
                        <span className="text-sm font-semibold text-gray-900">{stats.period.week.revenue.toFixed(0)} {getCurrencySymbol(getSelectedRestaurant()?.currency)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Просмотры</span>
                        <span className="text-sm font-semibold text-gray-900">{views.week}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-100 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-1 h-5 bg-purple-500 rounded-full"></div>
                      <h3 className="text-sm font-semibold text-gray-900">За месяц</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Заказы</span>
                        <span className="text-sm font-semibold text-gray-900">{stats.period.month.orders}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Выручка</span>
                        <span className="text-sm font-semibold text-gray-900">{stats.period.month.revenue.toFixed(0)} {getCurrencySymbol(getSelectedRestaurant()?.currency)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Просмотры</span>
                        <span className="text-sm font-semibold text-gray-900">{views.month}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-100 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-1 h-5 bg-green-500 rounded-full"></div>
                      <h3 className="text-sm font-semibold text-gray-900">Всего</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Заказы</span>
                        <span className="text-sm font-semibold text-gray-900">{stats.overview.totalOrders}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Выручка</span>
                        <span className="text-sm font-semibold text-gray-900">{stats.overview.totalRevenue.toFixed(0)} {getCurrencySymbol(getSelectedRestaurant()?.currency)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Просмотры</span>
                        <span className="text-sm font-semibold text-gray-900">{views.total}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Charts and Recent Orders */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                  {/* Orders Line Chart */}
                  <div className="bg-white rounded-xl border border-gray-100 p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">📦 Заказы за 30 дней</h3>
                    <p className="text-xs text-gray-500 mb-2">Динамика заказов по дням</p>
                    <DashLineChart data={stats.chartData} dataKey="orders" color="#8b5cf6" />
                  </div>

                  {/* Revenue Line Chart */}
                  <div className="bg-white rounded-xl border border-gray-100 p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">💰 Выручка за 30 дней</h3>
                    <p className="text-xs text-gray-500 mb-2">Динамика выручки по дням ({getCurrencySymbol(getSelectedRestaurant()?.currency)})</p>
                    <DashLineChart data={stats.chartData} dataKey="revenue" color="#10b981" />
                  </div>
                </div>

                {/* Recent Orders */}
                <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Последние заказы</h3>
                  {stats.recentOrders.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                            <th className="pb-2 font-medium">Заказ</th>
                            <th className="pb-2 font-medium">Клиент</th>
                            <th className="pb-2 font-medium">Дата</th>
                            <th className="pb-2 font-medium">Сумма</th>
                            <th className="pb-2 font-medium">Статус</th>
                            <th className="pb-2 font-medium"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.recentOrders.map((order) => {
                            const statusColors = {
                              new: 'bg-blue-50 text-blue-700',
                              confirmed: 'bg-indigo-50 text-indigo-700',
                              preparing: 'bg-yellow-50 text-yellow-700',
                              ready: 'bg-green-50 text-green-700',
                              delivered: 'bg-emerald-50 text-emerald-700',
                              completed: 'bg-gray-100 text-gray-600',
                              cancelled: 'bg-red-50 text-red-700'
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
                              <tr
                                key={order.id}
                                className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors cursor-pointer"
                                onClick={() => openOrderDetails(order.id)}
                              >
                                <td className="py-3 pr-3">
                                  <span className="font-semibold text-gray-900">#{String(order.orderNumber || '').replace(/^#+/, '')}</span>
                                </td>
                                <td className="py-3 pr-3">
                                  <span className="text-gray-700">{order.customerName || '—'}</span>
                                </td>
                                <td className="py-3 pr-3 text-gray-500 whitespace-nowrap">
                                  {new Date(order.createdAt).toLocaleString('ru-RU', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </td>
                                <td className="py-3 pr-3">
                                  <span className="font-semibold text-gray-900">{order.totalAmount.toFixed(0)} {getCurrencySymbol(getSelectedRestaurant()?.currency)}</span>
                                </td>
                                <td className="py-3 pr-3">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[order.status] || statusColors.new}`}>
                                    {statusLabels[order.status] || order.status}
                                  </span>
                                </td>
                                <td className="py-3" onClick={(e) => e.stopPropagation()}>
                                  <select
                                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
                                    value={order.status}
                                    onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                                    disabled={updatingStatusId === order.id}
                                  >
                                    {ORDER_STATUSES.map((s) => (
                                      <option key={s.value} value={s.value}>{s.label}</option>
                                    ))}
                                  </select>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm text-center py-8">Заказов пока нет</p>
                  )}
                </div>

                {/* Top Dishes */}
                {stats.topDishes.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-100 p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">{getBusinessType(getSelectedRestaurant()?.businessType).popularLabel}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                      {stats.topDishes.map((dish, index) => (
                        <div key={dish.id} className="border border-gray-100 rounded-xl p-4 hover:shadow-sm transition-shadow">
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-lg font-bold text-gray-200">#{index + 1}</span>
                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">
                              {dish.totalQuantity} шт
                            </span>
                          </div>
                          <p className="font-medium text-sm text-gray-900 mb-1">{dish.name}</p>
                          <p className="text-xs text-gray-400">{dish.orderCount} заказов</p>
                          <p className="text-sm font-semibold text-gray-900 mt-2">{dish.price.toFixed(0)} {getCurrencySymbol(getSelectedRestaurant()?.currency)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
                <p className="text-gray-400 text-sm">Статистика недоступна</p>
              </div>
            )}
          </>
        )}

        {isOrderModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between p-5 border-b">
                <div>
                  <h3 className="text-xl font-semibold">Заказ #{String(selectedOrder?.orderNumber || '').replace(/^#+/, '')}</h3>
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
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Тип заказа</h4>
                        <p className="text-sm text-gray-700">Тип: <span className="font-semibold">{selectedOrder.deliveryType === 'dine_in' ? `🍽️ В зале${selectedOrder.tableNumber ? ` (Стол ${selectedOrder.tableNumber})` : ''}` : selectedOrder.deliveryType === 'pickup' ? '🏃 Самовывоз' : '🚗 Доставка'}</span></p>
                        {selectedOrder.deliveryType !== 'dine_in' && (
                          <p className="text-sm text-gray-700">Оплата: <span className="font-semibold">{selectedOrder.paymentMethod === 'card' ? 'Картой' : 'Наличные'}</span></p>
                        )}
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
                          const itemName = item.dish?.name || item.product?.name || 'Позиция удалена';
                          return (
                            <div key={item.id} className="flex justify-between items-start border-b last:border-0 pb-3 last:pb-0">
                              <div>
                                <p className="font-semibold text-gray-900">{itemName}</p>
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
        <div className="bg-white rounded-xl border border-gray-100 p-5 mt-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Совет</h3>
          <p className="text-sm text-gray-500">
            {getBusinessType(getSelectedRestaurant()?.businessType).tip}
          </p>
        </div>

        {/* Create Restaurant Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6 sm:p-8">
              <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Создать новый бизнес</h2>

              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4 mb-6 sm:mb-8">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Тип бизнеса</label>
                  <div className="grid grid-cols-3 gap-3">
                    {BUSINESS_TYPE_OPTIONS.map(opt => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setNewRestaurant({ ...newRestaurant, businessType: opt.key })}
                        className={`p-3 rounded-xl border-2 text-center transition-all ${newRestaurant.businessType === opt.key ? `border-${opt.color}-500 bg-${opt.color}-50` : 'border-gray-200 hover:border-gray-300'}`}
                        disabled={creating}
                      >
                        <span className="text-2xl block mb-1">{opt.icon}</span>
                        <span className="text-sm font-medium">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{getBusinessType(newRestaurant.businessType).nameLabel}</label>
                  <input
                    type="text"
                    value={newRestaurant.name}
                    onChange={(e) => setNewRestaurant({ ...newRestaurant, name: e.target.value })}
                    placeholder={`Например: ${getBusinessType(newRestaurant.businessType).namePlaceholder}`}
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
                      placeholder={getBusinessType(newRestaurant.businessType).subdomainPlaceholder}
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
