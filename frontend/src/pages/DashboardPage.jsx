import { useState, useEffect, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { restaurantService } from '../services/restaurantService';
import { pricingService } from '../services/pricingService';
import { analyticsService } from '../services/analyticsService';
import RestaurantSelector from '../components/RestaurantSelector';
import DashboardLayout from '../components/DashboardLayout';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { useUserData } from '../hooks/useUserData';
import { useSelectedRestaurant } from '../hooks/useSelectedRestaurant';
import { getBusinessType, BUSINESS_TYPE_OPTIONS } from '../utils/businessTypes';
import { formatBillingPrice, getBillingIntervalLabel } from '../utils/billingFormat';

const DashboardPage = () => {
  const [pricingTiers, setPricingTiers] = useState([]);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { userData, loading, refresh: refreshUserData } = useUserData();
  const { selectedRestaurantId, setSelectedRestaurantId, selectedRestaurant } = useSelectedRestaurant(userData);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRestaurant, setNewRestaurant] = useState({ name: '', subdomain: '', businessType: 'RESTAURANT', country: '', city: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [loadingGuardTriggered, setLoadingGuardTriggered] = useState(false);
  const lastOrderIdRef = useRef(null);
  const canPollOrders = Boolean(
    selectedRestaurantId
    && userData?.restaurants?.some((restaurant) => restaurant.id === selectedRestaurantId),
  );

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

  useEffect(() => {
    if (!canPollOrders) {
      lastOrderIdRef.current = null;
      return undefined;
    }

    let cancelled = false;

    const checkForNewOrders = async (notify = true) => {
      try {
        const statsData = await analyticsService.getRestaurantStats(selectedRestaurantId);
        if (cancelled) return;

        const latestOrder = statsData?.recentOrders?.[0];
        if (
          notify
          && latestOrder?.id
          && lastOrderIdRef.current
          && lastOrderIdRef.current !== latestOrder.id
        ) {
          const orderNumber = `#${String(latestOrder.orderNumber || '').replace(/^#+/, '')}`;
          toast.success(`Новый заказ ${orderNumber}`.trim());
        }
        lastOrderIdRef.current = latestOrder?.id || null;
      } catch (err) {
        if (!cancelled && err?.status !== 403) {
          console.error('Error polling orders:', err);
        }
      }
    };

    checkForNewOrders(false);
    const intervalId = window.setInterval(checkForNewOrders, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [canPollOrders, selectedRestaurantId]);

  const loadPricingTiers = async () => {
    try {
      const tiers = await pricingService.getPricingTiers();
      setPricingTiers(tiers);
    } catch (err) {
      console.error('Error loading pricing tiers:', err);
    }
  };

  const getSelectedRestaurant = () => selectedRestaurant;

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
          const currency = response.pricing?.currency || 'KGS';
          const maxRestaurants = response.pricing?.maxRestaurants || response.pricing?.totalRestaurants;
          if (maxRestaurants) {
            errorMessage += `\n\nТребуемый тариф: ${new Intl.NumberFormat('ru-RU', { style: 'currency', currency }).format(response.pricing.monthlyPrice)}/мес за ${maxRestaurants} ${maxRestaurants === 1 ? 'ресторан' : 'ресторанов'}`;
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
                          const tierInfo = `${tier.name} - ${formatBillingPrice(tier)}/${getBillingIntervalLabel(tier, true)}`;
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
