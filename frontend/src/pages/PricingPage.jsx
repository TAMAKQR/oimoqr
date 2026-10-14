import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import DashboardLayout from '../components/DashboardLayout';
import { useUserData } from '../hooks/useUserData';
import { useSelectedRestaurant } from '../hooks/useSelectedRestaurant';
import { billingService } from '../services/billingService';
import { pricingService } from '../services/pricingService';
import { formatBillingPrice } from '../utils/billingFormat';

const WAITING_PAYMENT_STATUSES = new Set(['CREATING', 'PENDING']);
const TERMINAL_PAYMENT_STATUSES = new Set(['PAID', 'EXPIRED', 'FAILED', 'REVIEW_REQUIRED']);

const STATUS_META = {
  ACTIVE: { label: 'Активен', badge: 'bg-green-100 text-green-700', panel: 'bg-green-50 border-green-200' },
  TRIAL: { label: 'Пробный период', badge: 'bg-blue-100 text-blue-700', panel: 'bg-blue-50 border-blue-200' },
  TRIALING: { label: 'Пробный период', badge: 'bg-blue-100 text-blue-700', panel: 'bg-blue-50 border-blue-200' },
  PAST_DUE: { label: 'Нужно продлить', badge: 'bg-amber-100 text-amber-800', panel: 'bg-amber-50 border-amber-200' },
  UNPAID: { label: 'Не оплачен', badge: 'bg-red-100 text-red-700', panel: 'bg-red-50 border-red-200' },
  CANCELLED: { label: 'Завершён', badge: 'bg-gray-100 text-gray-700', panel: 'bg-gray-50 border-gray-200' },
  CANCELED: { label: 'Завершён', badge: 'bg-gray-100 text-gray-700', panel: 'bg-gray-50 border-gray-200' },
  EXPIRED: { label: 'Истёк', badge: 'bg-gray-100 text-gray-700', panel: 'bg-gray-50 border-gray-200' },
  PENDING: { label: 'Ожидает активации', badge: 'bg-amber-100 text-amber-800', panel: 'bg-amber-50 border-amber-200' },
};

const NOTICE_STYLES = {
  success: 'border-green-200 bg-green-50 text-green-900',
  info: 'border-blue-200 bg-blue-50 text-blue-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-red-200 bg-red-50 text-red-900',
};

const normalizeBusinessType = (value) => (value === 'HOTEL' ? 'HOTEL' : 'RESTAURANT');
const normalizeStatus = (status, fallback = 'PENDING') => String(status || fallback).toUpperCase();
const getPaymentId = (payment) => payment?.id || payment?.paymentId || null;
const getPaymentUrl = (payment) => payment?.url || payment?.paymentUrl || null;

const getEffectiveSubscriptionStatus = (subscription) => {
  const status = normalizeStatus(subscription?.status);
  const periodEnd = status === 'TRIAL'
    ? (subscription?.trialEndsAt || subscription?.currentPeriodEnd || subscription?.endsAt)
    : (subscription?.currentPeriodEnd || subscription?.endsAt);

  if (['ACTIVE', 'TRIAL', 'TRIALING'].includes(status) && periodEnd) {
    const parsedPeriodEnd = new Date(periodEnd);
    if (!Number.isNaN(parsedPeriodEnd.getTime()) && parsedPeriodEnd <= new Date()) return 'EXPIRED';
  }

  return status;
};

const wait = (milliseconds) => new Promise((resolve) => {
  window.setTimeout(resolve, milliseconds);
});

const parseTierFeatures = (features) => {
  if (Array.isArray(features)) return features;
  if (!features || typeof features !== 'string') return [];

  try {
    const parsed = JSON.parse(features);
    return Array.isArray(parsed) ? parsed : [features];
  } catch {
    return features.split(/\r?\n|,/).map((feature) => feature.trim()).filter(Boolean);
  }
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const selectLocalSubscription = (subscriptions = []) => {
  const priority = ['ACTIVE', 'TRIAL', 'TRIALING', 'PAST_DUE', 'PENDING', 'EXPIRED', 'CANCELLED'];
  const getPriority = (subscription) => {
    const index = priority.indexOf(getEffectiveSubscriptionStatus(subscription));
    return index === -1 ? priority.length : index;
  };
  return [...subscriptions].sort((a, b) => getPriority(a) - getPriority(b))[0] || null;
};

const getPaymentNotice = (status) => {
  if (status === 'PAID') {
    return {
      tone: 'success',
      title: 'Оплата подтверждена',
      message: 'Оплаченный период активирован. Следующее продление выполняется вручную.',
    };
  }
  if (status === 'EXPIRED') {
    return {
      tone: 'warning',
      title: 'Срок оплаты истёк',
      message: 'Ссылка больше не действует. Если деньги списались, не платите повторно — сначала обратитесь в поддержку.',
    };
  }
  if (status === 'FAILED') {
    return {
      tone: 'error',
      title: 'Не удалось создать оплату',
      message: 'Проверьте статус и попробуйте создать новую ссылку позже.',
    };
  }
  if (status === 'REVIEW_REQUIRED') {
    return {
      tone: 'error',
      title: 'Платёж требует проверки',
      message: 'Не повторяйте оплату. Мы проверим платёж вручную — обратитесь в поддержку, если статус долго не меняется.',
    };
  }
  return null;
};

const PricingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const paymentReturnHandled = useRef(false);
  const { userData, loading: userLoading, refresh } = useUserData();
  const refreshRef = useRef(refresh);
  const { selectedRestaurantId, selectedRestaurant } = useSelectedRestaurant(userData);
  const [pricingTiers, setPricingTiers] = useState([]);
  const [billingStatus, setBillingStatus] = useState({
    configured: false,
    provider: 'FINIK',
    subscription: null,
    pendingPayment: null,
    requiresAction: false,
    billingIssue: null,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('RESTAURANT');
  const [creatingTierId, setCreatingTierId] = useState(null);
  const [checkingPaymentId, setCheckingPaymentId] = useState(null);
  const [verifyingReturn, setVerifyingReturn] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState(null);

  const isOwner = selectedRestaurantId
    ? Boolean(userData?.restaurants?.some((restaurant) => restaurant.id === selectedRestaurantId))
    : (userData?.restaurants?.length || 0) > 0;

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (userLoading) return;
    if (!isOwner) {
      toast.error('Раздел тарифов доступен только владельцу бизнеса');
      navigate('/dashboard');
    }
  }, [userLoading, isOwner, navigate]);

  useEffect(() => {
    if (selectedRestaurant?.businessType) {
      setActiveTab(normalizeBusinessType(selectedRestaurant.businessType));
    }
  }, [selectedRestaurant?.businessType]);

  useEffect(() => {
    if (userLoading || !isOwner) return undefined;

    let active = true;
    const loadData = async () => {
      setLoading(true);
      const [tiersResult, billingResult] = await Promise.allSettled([
        pricingService.getPricingTiers(),
        billingService.getSubscription(),
      ]);

      if (!active) return;

      if (tiersResult.status === 'fulfilled') {
        setPricingTiers((tiersResult.value || []).map((tier) => ({
          ...tier,
          features: parseTierFeatures(tier.features),
        })));
      } else {
        toast.error(tiersResult.reason?.response?.data?.error || 'Не удалось загрузить тарифы');
      }

      if (billingResult.status === 'fulfilled') {
        setBillingStatus((current) => ({ ...current, ...billingResult.value }));
      } else {
        toast.error('Не удалось проверить статус оплаты. Покупка временно недоступна.');
      }

      setLoading(false);
    };

    loadData();
    return () => {
      active = false;
    };
  }, [userLoading, isOwner]);

  useEffect(() => {
    if (paymentReturnHandled.current || loading || userLoading || !isOwner) return undefined;
    if (searchParams.get('payment') !== 'return') return undefined;

    const paymentId = searchParams.get('payment_id');
    paymentReturnHandled.current = true;

    if (!paymentId) {
      setPaymentNotice({
        tone: 'error',
        title: 'Не удалось проверить оплату',
        message: 'В ссылке возврата отсутствует номер платежа. Обратитесь в поддержку, если деньги были списаны.',
      });
      navigate('/pricing', { replace: true });
      return undefined;
    }

    let active = true;
    const verifyPayment = async () => {
      setVerifyingReturn(true);
      setCheckingPaymentId(paymentId);
      let lastError = null;
      let lastStatus = 'PENDING';
      let receivedResponse = false;

      try {
        for (let attempt = 0; attempt < 15; attempt += 1) {
          try {
            const result = await billingService.getPayment(paymentId);
            if (!active) return;
            receivedResponse = true;

            const payment = result?.payment || { id: paymentId, status: 'PENDING' };
            lastStatus = normalizeStatus(payment.status);
            const waiting = WAITING_PAYMENT_STATUSES.has(lastStatus);

            setBillingStatus((current) => ({
              ...current,
              subscription: result?.subscription || current.subscription,
              pendingPayment: waiting ? payment : null,
              requiresAction: Boolean(result?.requiresAction) || lastStatus === 'REVIEW_REQUIRED',
              billingIssue: (Boolean(result?.requiresAction) || lastStatus === 'REVIEW_REQUIRED')
                ? current.billingIssue
                : null,
            }));

            if (TERMINAL_PAYMENT_STATUSES.has(lastStatus)) {
              setPaymentNotice(getPaymentNotice(lastStatus));
              if (lastStatus === 'PAID') {
                toast.success('Оплата подтверждена, тариф активирован');
                const latestBilling = await billingService.getSubscription().catch(() => null);
                if (active && latestBilling) setBillingStatus((current) => ({ ...current, ...latestBilling }));
                void refreshRef.current();
              } else if (lastStatus === 'REVIEW_REQUIRED') {
                toast.error('Платёж отправлен на ручную проверку');
              } else if (lastStatus === 'EXPIRED') {
                toast('Срок ссылки на оплату истёк', { icon: 'ℹ️' });
              } else {
                toast.error('Не удалось создать оплату');
              }
              return;
            }

            if (!waiting) {
              setPaymentNotice({
                tone: 'error',
                title: 'Неизвестный статус платежа',
                message: 'Не повторяйте оплату до уточнения статуса в поддержке.',
              });
              return;
            }
          } catch (error) {
            lastError = error;
            const responseStatus = error.response?.status;
            if (responseStatus && responseStatus < 500 && responseStatus !== 429) throw error;
          }

          await wait(1800 + Math.min(attempt * 150, 1200));
          if (!active) return;
        }

        if (active && !receivedResponse && lastError) {
          throw lastError;
        }

        if (active && WAITING_PAYMENT_STATUSES.has(lastStatus)) {
          setPaymentNotice({
            tone: 'info',
            title: 'Платёж ещё обрабатывается',
            message: 'Finik ещё не подтвердил результат. Можно закрыть страницу и проверить статус позже — повторно платить не нужно.',
          });
          const latestBilling = await billingService.getSubscription().catch(() => null);
          if (active && latestBilling) setBillingStatus((current) => ({ ...current, ...latestBilling }));
        }
      } catch (error) {
        if (active) {
          setPaymentNotice({
            tone: 'error',
            title: 'Не удалось проверить оплату',
            message: error.response?.data?.error || 'Проверьте статус позже. Если деньги списаны, не создавайте повторный платёж.',
          });
        }
      } finally {
        if (active) {
          setVerifyingReturn(false);
          setCheckingPaymentId(null);
          navigate('/pricing', { replace: true });
        }
      }
    };

    verifyPayment();
    return () => {
      active = false;
    };
  }, [loading, userLoading, isOwner, searchParams, navigate]);

  const localSubscription = useMemo(
    () => selectLocalSubscription(userData?.subscriptions),
    [userData?.subscriptions]
  );
  const accountBusinessTypes = useMemo(() => new Set(
    (userData?.restaurants || []).map((restaurant) => normalizeBusinessType(restaurant.businessType))
  ), [userData?.restaurants]);
  const hasMixedBusinessTypes = accountBusinessTypes.size > 1;

  const currentSubscription = billingStatus.subscription || localSubscription;
  const currentTierId = currentSubscription?.pricingTierId || currentSubscription?.pricingTier?.id;
  const currentStatus = getEffectiveSubscriptionStatus(currentSubscription);
  const statusMeta = STATUS_META[currentStatus] || STATUS_META.PENDING;
  const hasActiveEntitlement = Boolean(
    currentSubscription && ['ACTIVE', 'TRIAL', 'TRIALING'].includes(currentStatus)
  );

  const pendingPayment = billingStatus.pendingPayment;
  const pendingPaymentId = getPaymentId(pendingPayment);
  const pendingPaymentUrl = getPaymentUrl(pendingPayment);
  const pendingPaymentStatus = normalizeStatus(pendingPayment?.status, 'PENDING');
  const pendingExpiresAt = pendingPayment?.expiresAt;
  const parsedPendingExpiry = pendingExpiresAt ? new Date(pendingExpiresAt) : null;
  const pendingExpiredByTime = Boolean(
    parsedPendingExpiry
    && !Number.isNaN(parsedPendingExpiry.getTime())
    && parsedPendingExpiry <= new Date()
  );
  const hasWaitingPayment = Boolean(
    pendingPayment
    && WAITING_PAYMENT_STATUSES.has(pendingPaymentStatus)
    && !pendingExpiredByTime
  );
  const pendingTerminalNotice = getPaymentNotice(pendingPaymentStatus);
  const paymentRequiresReview = billingStatus.requiresAction || pendingPaymentStatus === 'REVIEW_REQUIRED';

  const applyPaymentResult = async (result) => {
    const payment = result?.payment;
    const status = normalizeStatus(payment?.status);
    const waiting = WAITING_PAYMENT_STATUSES.has(status);

    setBillingStatus((current) => ({
      ...current,
      subscription: result?.subscription || current.subscription,
      pendingPayment: waiting ? payment : null,
      requiresAction: Boolean(result?.requiresAction) || status === 'REVIEW_REQUIRED',
      billingIssue: (Boolean(result?.requiresAction) || status === 'REVIEW_REQUIRED')
        ? current.billingIssue
        : null,
    }));

    if (TERMINAL_PAYMENT_STATUSES.has(status)) setPaymentNotice(getPaymentNotice(status));
    if (status === 'PAID') {
      toast.success('Оплата подтверждена, тариф активирован');
      const latestBilling = await billingService.getSubscription().catch(() => null);
      if (latestBilling) setBillingStatus((current) => ({ ...current, ...latestBilling }));
      await refreshRef.current();
    } else if (status === 'REVIEW_REQUIRED') {
      toast.error('Платёж требует ручной проверки');
    } else if (status === 'EXPIRED') {
      toast('Срок ссылки на оплату истёк', { icon: 'ℹ️' });
    } else if (status === 'FAILED') {
      toast.error('Не удалось создать оплату');
    } else {
      toast('Платёж ещё обрабатывается. Повторно платить не нужно.', { icon: 'ℹ️' });
    }
  };

  const checkPendingPayment = async () => {
    if (!pendingPaymentId) return;
    setCheckingPaymentId(pendingPaymentId);
    try {
      const result = await billingService.getPayment(pendingPaymentId);
      await applyPaymentResult(result);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Не удалось проверить статус платежа');
    } finally {
      setCheckingPaymentId(null);
    }
  };

  const continuePendingPayment = () => {
    if (!pendingPaymentUrl) {
      toast('Ссылка ещё создаётся. Проверьте статус через несколько секунд.', { icon: 'ℹ️' });
      return;
    }
    window.location.assign(pendingPaymentUrl);
  };

  const startPayment = async (tier) => {
    if (paymentRequiresReview) {
      toast.error('Текущий платёж требует проверки. Не создавайте повторную оплату.');
      return;
    }

    if (hasWaitingPayment) {
      continuePendingPayment();
      return;
    }

    if (pendingPayment && pendingExpiredByTime && pendingPaymentId) {
      toast('Сначала проверьте статус предыдущей попытки. Если платёж был подтверждён перед истечением ссылки, webhook может прийти с задержкой.', { icon: 'ℹ️' });
      return;
    }

    setCreatingTierId(tier.id);
    setPaymentNotice(null);
    try {
      const result = await billingService.createPayment(tier.id);
      const createdPayment = {
        id: result.paymentId,
        paymentId: result.paymentId,
        url: result.url,
        expiresAt: result.expiresAt,
        status: 'PENDING',
      };
      setBillingStatus((current) => ({ ...current, pendingPayment: createdPayment }));
      if (result.url) {
        window.location.assign(result.url);
        return;
      }
      setPaymentNotice({
        tone: 'info',
        title: 'Платёж создаётся',
        message: 'Ссылка на оплату ещё не готова. Проверьте статус через несколько секунд.',
      });
    } catch (error) {
      const latestBilling = await billingService.getSubscription().catch(() => null);
      if (latestBilling) setBillingStatus((current) => ({ ...current, ...latestBilling }));
      toast.error(error.response?.data?.error || 'Не удалось создать платёж');
    } finally {
      setCreatingTierId(null);
    }
  };

  if (loading || userLoading) {
    return (
      <DashboardLayout userData={userData} selectedRestaurantId={selectedRestaurantId}>
        <div className="flex items-center justify-center min-h-96">
          <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const periodEnd = currentSubscription?.gracePeriodEndsAt
    || currentSubscription?.currentPeriodEnd
    || currentSubscription?.endsAt
    || currentSubscription?.trialEndsAt;
  const daysLeft = periodEnd
    ? Math.max(0, Math.ceil((new Date(periodEnd) - new Date()) / (1000 * 60 * 60 * 24)))
    : null;
  const currentRestaurantCount = userData?.restaurants?.length || 0;
  const visibleTiers = pricingTiers.filter((tier) => (
    hasMixedBusinessTypes
      ? tier.businessType === 'ALL'
      : (!tier.businessType || tier.businessType === activeTab || tier.businessType === 'ALL')
  ));

  return (
    <DashboardLayout userData={userData} selectedRestaurantId={selectedRestaurantId}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Тарифные планы</h1>
          <p className="text-gray-500 text-sm mt-1">
            Разовая онлайн-оплата через Finik. Каждый следующий период продлевается вручную.
          </p>
          {hasMixedBusinessTypes ? (
            <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800 w-fit">
              Для аккаунта с ресторанами и отелями доступны только универсальные тарифы.
            </div>
          ) : (
            <div className="flex gap-1 mt-4 bg-gray-100 rounded-lg p-1 w-fit">
              <button
                type="button"
                onClick={() => setActiveTab('RESTAURANT')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'RESTAURANT'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'}`}
              >
                🍽 Рестораны
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('HOTEL')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'HOTEL'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'}`}
              >
                🏨 Отели
              </button>
            </div>
          )}
        </div>

        {verifyingReturn && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="font-semibold">Проверяем платёж</p>
            <p className="mt-1">Возврат из Finik сам по себе не подтверждает оплату. Ожидаем подтверждение платёжной системы…</p>
          </div>
        )}

        {paymentNotice && (
          <div className={`mb-6 rounded-xl border p-4 text-sm ${NOTICE_STYLES[paymentNotice.tone] || NOTICE_STYLES.info}`}>
            <p className="font-semibold">{paymentNotice.title}</p>
            <p className="mt-1">{paymentNotice.message}</p>
          </div>
        )}

        {!billingStatus.configured && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Онлайн-оплата пока настраивается. Тарифы можно посмотреть, но оплатить их станет возможно после подключения Finik.
          </div>
        )}

        {paymentRequiresReview && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <p className="font-semibold">Платёж требует ручной проверки</p>
            <p className="mt-1">
              Не создавайте повторный платёж. Обратитесь в поддержку, если статус не обновится в ближайшее время.
            </p>
          </div>
        )}

        {pendingPayment && !paymentRequiresReview && (
          <div className={`mb-6 rounded-xl border p-4 text-sm ${pendingExpiredByTime
            ? NOTICE_STYLES.warning
            : NOTICE_STYLES[pendingTerminalNotice?.tone] || NOTICE_STYLES.info}`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">
                  {pendingExpiredByTime
                    ? 'Срок оплаты истёк'
                    : pendingTerminalNotice?.title
                      || (pendingPaymentStatus === 'CREATING' ? 'Создаём ссылку на оплату' : 'Есть незавершённая оплата')}
                </p>
                <p className="mt-1">
                  {pendingExpiredByTime
                    ? 'Ссылка больше не действует. Если вы подтверждали оплату перед истечением срока, сначала проверьте статус и не платите повторно.'
                    : pendingTerminalNotice?.message || (hasWaitingPayment
                    ? 'Продолжите текущую оплату или проверьте её статус. Создавать второй платёж не нужно.'
                    : 'Можно создать новый платёж для выбранного тарифа.')}
                  {pendingExpiresAt && ` Ссылка действует до ${formatDate(pendingExpiresAt)}.`}
                </p>
              </div>
              {(hasWaitingPayment || pendingPaymentId) && (
                <div className="flex flex-wrap gap-2 shrink-0">
                  {hasWaitingPayment && pendingPaymentUrl && (
                    <button
                      type="button"
                      onClick={continuePendingPayment}
                      className="px-4 py-2 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700"
                    >
                      Продолжить оплату
                    </button>
                  )}
                  {pendingPaymentId && (
                    <button
                      type="button"
                      onClick={checkPendingPayment}
                      disabled={checkingPaymentId === pendingPaymentId}
                      className="px-4 py-2 rounded-lg border border-current bg-white/60 font-medium disabled:opacity-60"
                    >
                      {checkingPaymentId === pendingPaymentId ? 'Проверяем…' : 'Проверить статус'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {currentSubscription && (
          <div className={`mb-6 rounded-xl border ${statusMeta.panel}`}>
            <div className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white/70 flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {currentSubscription.pricingTier?.name || (currentStatus === 'TRIAL' ? 'Пробный период' : currentSubscription.plan || 'Тариф')}
                    </h3>
                    {hasActiveEntitlement && (
                      <p className="text-xs text-gray-600 mt-0.5">Автоматического списания нет — следующий период оплачивается вручную</p>
                    )}
                  </div>
                </div>
                <span className={`px-3 py-1 text-xs font-medium rounded-full w-fit ${statusMeta.badge}`}>
                  {statusMeta.label}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div className="bg-white/60 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Объекты</p>
                  <p className="font-semibold text-gray-900">
                    {currentSubscription.pricingTier?.maxRestaurants
                      ? `${currentRestaurantCount} из ${currentSubscription.pricingTier.maxRestaurants}`
                      : `${currentRestaurantCount} · без лимита`}
                  </p>
                </div>
                {currentSubscription.pricingTier && (
                  <div className="bg-white/60 rounded-lg p-3">
                    <p className="text-gray-500 text-xs mb-1">Стоимость периода</p>
                    <p className="font-semibold text-gray-900">
                      {formatBillingPrice(currentSubscription.pricingTier)}/{currentSubscription.pricingTier.billingInterval === 'year' ? 'год' : 'мес'}
                    </p>
                  </div>
                )}
                {periodEnd && (
                  <div className="bg-white/60 rounded-lg p-3">
                    <p className="text-gray-500 text-xs mb-1">
                      {currentStatus === 'PAST_DUE' ? 'Льготный доступ до' : 'Оплачено до'}
                    </p>
                    <p className="font-semibold text-gray-900">{formatDate(periodEnd)}</p>
                    {daysLeft !== null && <p className="text-xs text-gray-500 mt-0.5">Осталось дней: {daysLeft}</p>}
                  </div>
                )}
              </div>

              {['PAST_DUE', 'UNPAID', 'EXPIRED'].includes(currentStatus) && (
                <p className="text-sm text-amber-900 mt-3">
                  Оплатите новый период вручную, чтобы восстановить доступ.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleTiers.map((tier) => {
            const isCurrentTier = tier.id === currentTierId;
            const isCreatingThisTier = creatingTierId === tier.id;
            const onlinePaymentEnabled = tier.isPurchasable ?? tier.onlinePaymentEnabled ?? true;
            const canContinuePending = hasWaitingPayment && Boolean(pendingPaymentUrl);
            const canStartPayment = billingStatus.configured
              && onlinePaymentEnabled
              && !paymentRequiresReview
              && !hasWaitingPayment;
            const disabled = verifyingReturn
              || Boolean(creatingTierId)
              || Boolean(checkingPaymentId)
              || (!canStartPayment && !canContinuePending);

            let buttonLabel = isCurrentTier && hasActiveEntitlement ? 'Продлить вручную' : 'Оплатить тариф';
            if (isCreatingThisTier) buttonLabel = 'Создаём платёж…';
            else if (verifyingReturn) buttonLabel = 'Проверяем оплату…';
            else if (hasWaitingPayment && pendingPaymentUrl) buttonLabel = 'Продолжить текущую оплату';
            else if (hasWaitingPayment) buttonLabel = 'Платёж создаётся';
            else if (paymentRequiresReview) buttonLabel = 'Требуется проверка';
            else if (!onlinePaymentEnabled) buttonLabel = 'Онлайн-оплата недоступна';
            else if (!billingStatus.configured) buttonLabel = 'Оплата настраивается';

            return (
              <div
                key={tier.id}
                className={`relative rounded-xl overflow-hidden transition-all hover:shadow-md ${isCurrentTier && hasActiveEntitlement
                  ? 'ring-2 ring-primary-600 bg-primary-50'
                  : 'bg-white border border-gray-100'}`}
              >
                {isCurrentTier && hasActiveEntitlement && (
                  <div className="absolute top-4 right-4">
                    <span className="bg-primary-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      Текущий
                    </span>
                  </div>
                )}

                <div className="p-6">
                  <h3 className="text-2xl font-bold mb-2 pr-20">{tier.name}</h3>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">{formatBillingPrice(tier)}</span>
                    <span className="text-gray-600 ml-2">/{tier.billingInterval === 'year' ? 'год' : 'месяц'}</span>
                  </div>

                  {tier.description && <p className="text-gray-600 text-sm mb-6">{tier.description}</p>}

                  <div className="mb-6">
                    <p className="font-semibold mb-3 text-sm text-gray-700">Что включено:</p>
                    <ul className="space-y-2">
                      {tier.maxRestaurants && (
                        <li className="flex items-start gap-2 text-sm">
                          <span className="text-green-500 mt-0.5">✓</span>
                          <span>До {tier.maxRestaurants} {tier.maxRestaurants === 1 ? 'ресторана' : 'ресторанов'}</span>
                        </li>
                      )}
                      {(tier.features || []).map((feature, index) => (
                        <li key={`${feature}-${index}`} className="flex items-start gap-2 text-sm">
                          <span className="text-green-500 mt-0.5">✓</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => (canContinuePending ? continuePendingPayment() : startPayment(tier))}
                    disabled={disabled}
                    className={`w-full py-3 rounded-lg font-semibold transition-colors ${disabled
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-primary-600 text-white hover:bg-primary-700'}`}
                  >
                    {buttonLabel}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {visibleTiers.length === 0 && (
          <div className="rounded-xl border border-gray-100 bg-white p-8 text-center text-gray-500">
            Для выбранного типа бизнеса пока нет доступных тарифов.
          </div>
        )}

        <div className="mt-12 p-5 bg-white rounded-xl border border-gray-100">
          <h3 className="font-semibold text-lg mb-3">Нужна помощь в выборе тарифа?</h3>
          <p className="text-gray-600 mb-4">
            Напишите нам — поможем подобрать план и разобраться с оплатой через Finik.
          </p>
          <div className="flex flex-wrap gap-4">
            <a href="mailto:admin@oimoqr.com" className="text-primary-600 hover:text-primary-700 font-medium text-sm">
              📧 admin@oimoqr.com
            </a>
            <a href="https://t.me/oimoqr_support" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700 font-medium text-sm">
              💬 Telegram
            </a>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PricingPage;
