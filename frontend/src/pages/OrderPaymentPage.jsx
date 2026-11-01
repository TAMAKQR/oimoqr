import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import FloatingMenuWidget from '../components/FloatingMenuWidget';
import { useCartStore } from '../store/cartStore';
import { finikOrderPaymentService } from '../services/finikOrderPaymentService';

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const OrderPaymentPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get('payment_id');
  const clearCart = useCartStore((state) => state.clearCart);
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    if (!paymentId) {
      setError('В ссылке возврата отсутствует номер платежа.');
      setChecking(false);
      return undefined;
    }

    let active = true;
    let timer;
    let attempts = 0;
    setChecking(true);
    setError('');

    const checkPayment = async () => {
      try {
        const result = await finikOrderPaymentService.getPayment(paymentId);
        if (!active) return;
        const currentPayment = result?.payment;
        setPayment(currentPayment || null);
        if (currentPayment?.status === 'PAID' && result?.order) {
          clearCart();
          navigate('/order-success', {
            replace: true,
            state: { order: result.order, currency: result.currency },
          });
          return;
        }

        attempts += 1;
        if (['PENDING', 'CREATING'].includes(currentPayment?.status) && attempts < 16) {
          timer = window.setTimeout(checkPayment, 2500);
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.response?.data?.error || 'Не удалось проверить статус оплаты.');
        }
      } finally {
        if (active) setChecking(false);
      }
    };

    checkPayment();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [paymentId, refreshCount, clearCart, navigate]);

  const pending = ['PENDING', 'CREATING'].includes(payment?.status);
  const linkExpired = payment?.expiresAt && new Date(payment.expiresAt) <= new Date();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50">
      <div className="max-w-[480px] mx-auto px-4 pt-12 pb-8">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
          <div className="mb-3 text-4xl">{payment?.status === 'PAID' ? '✅' : '⏳'}</div>
          <h1 className="text-xl font-bold text-gray-900">
            {checking
              ? 'Проверяем оплату'
              : payment?.status === 'PAID'
                ? 'Оплата подтверждена'
                : payment?.status === 'REVIEW_REQUIRED'
                  ? 'Платёж проверяется'
                  : payment?.status === 'EXPIRED'
                    ? 'Срок проверки платежа истёк'
                    : 'Ожидаем подтверждение оплаты'}
          </h1>
          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
          {!error && pending && (
            <p className="mt-3 text-sm text-gray-600">
              {linkExpired
                ? 'Ссылка на оплату истекла. Проверка может занять 24 часа, а Finik может повторять подтверждение и позже. Не оформляйте и не оплачивайте заказ повторно, если деньги списались.'
                : 'Если вы уже оплатили по QR-коду, дождитесь подтверждения. Ресторан получит заказ только после подтверждения оплаты.'}
            </p>
          )}
          {payment?.status === 'REVIEW_REQUIRED' && (
            <p className="mt-3 text-sm text-amber-800">
              Платёж получен, но заказ не отправлен ресторану автоматически. Не оплачивайте повторно и обратитесь в поддержку для сверки.
            </p>
          )}
          {payment?.status === 'EXPIRED' && (
            <p className="mt-3 text-sm text-amber-800">
              Статус оплаты не подтверждён. Если деньги списались, не создавайте новый заказ — обратитесь в поддержку.
            </p>
          )}
          {payment?.expiresAt && (
            <p className="mt-2 text-xs text-gray-500">Ссылка действовала до {formatDate(payment.expiresAt)}.</p>
          )}
          {pending && payment?.url && (
            <a
              href={payment.url}
              className="mt-5 block w-full rounded-xl bg-primary-600 py-3 text-sm font-semibold text-white"
            >
              Оплатить по QR
            </a>
          )}
          {!checking && (
            <button
              type="button"
              onClick={() => setRefreshCount((count) => count + 1)}
              className="mt-3 w-full rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-700"
            >
              Проверить статус
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/', { replace: true })}
            className="mt-3 w-full rounded-xl py-3 text-sm text-gray-500"
          >
            Вернуться в меню
          </button>
        </div>
      </div>
      <FloatingMenuWidget />
    </div>
  );
};

export default OrderPaymentPage;
