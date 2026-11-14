import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import DashboardLayout from '../components/DashboardLayout';
import RestaurantSelector from '../components/RestaurantSelector';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Modal } from '../components/ui/Modal';
import { StatusBadge } from '../components/ui/Badge';
import { useUserData } from '../hooks/useUserData';
import { useSelectedRestaurant } from '../hooks/useSelectedRestaurant';
import { analyticsService } from '../services/analyticsService';
import { ordersService } from '../services/ordersService';
import { useAuthStore } from '../store/authStore';
import { getBusinessType } from '../utils/businessTypes';

const ORDER_STATUSES = [
  { value: 'new', label: 'Новый' },
  { value: 'confirmed', label: 'Подтверждён' },
  { value: 'preparing', label: 'Готовится' },
  { value: 'ready', label: 'Готов' },
  { value: 'delivered', label: 'Доставлен' },
  { value: 'completed', label: 'Завершён' },
  { value: 'cancelled', label: 'Отменён' },
];

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
  };
  const normalizedCode = String(currencyCode || '').trim().toUpperCase();
  return currencySymbols[normalizedCode] || normalizedCode || '₽';
};

const formatCompactNumber = (value) => {
  const numericValue = Number(value) || 0;
  if (Math.abs(numericValue) >= 1000000) return `${(numericValue / 1000000).toFixed(1)}м`;
  if (Math.abs(numericValue) >= 1000) return `${(numericValue / 1000).toFixed(1)}к`;
  return Math.round(numericValue).toLocaleString('ru-RU');
};

const getNiceScaleMax = (value) => {
  const numericValue = Math.max(0, Number(value) || 0);
  if (numericValue <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(numericValue));
  const normalized = numericValue / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
};

const formatDate = (value, long = false) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '—';
  return date.toLocaleDateString('ru-RU', long
    ? { day: 'numeric', month: 'long', year: 'numeric' }
    : { day: '2-digit', month: '2-digit' });
};

const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const DualMetricChart = ({ data, currencySymbol, rangeLabel, height = 300 }) => {
  const [activeIndex, setActiveIndex] = useState(null);
  const [isMobileViewport, setIsMobileViewport] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
  ));
  const scrollContainerRef = useRef(null);
  const rows = Array.isArray(data) ? data : [];

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 639px)');
    const handleChange = (event) => setIsMobileViewport(event.matches);
    mediaQuery.addEventListener?.('change', handleChange);
    return () => mediaQuery.removeEventListener?.('change', handleChange);
  }, []);

  useEffect(() => {
    if (isMobileViewport && rows.length > 7 && scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
    }
  }, [isMobileViewport, rows.length]);

  if (rows.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-gray-400">
        Нет данных за выбранный период
      </div>
    );
  }

  const useCompactMobileChart = isMobileViewport && rows.length <= 7;
  const width = useCompactMobileChart ? 480 : 760;
  const padding = useCompactMobileChart
    ? { left: 46, right: 62, top: 30, bottom: 34 }
    : { left: 56, right: 72, top: 30, bottom: 34 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const orderValues = rows.map((row) => Math.max(0, Number(row.orders) || 0));
  const revenueValues = rows.map((row) => Math.max(0, Number(row.revenue) || 0));
  const maxOrders = getNiceScaleMax(Math.max(...orderValues, 0));
  const maxRevenue = getNiceScaleMax(Math.max(...revenueValues, 0));

  const getX = (index) => rows.length === 1
    ? padding.left + plotWidth / 2
    : padding.left + (index / (rows.length - 1)) * plotWidth;
  const getOrderY = (value) => padding.top + plotHeight - (value / maxOrders) * plotHeight;
  const getRevenueY = (value) => padding.top + plotHeight - (value / maxRevenue) * plotHeight;

  const orderPoints = rows.map((row, index) => ({
    x: getX(index),
    y: getOrderY(orderValues[index]),
    value: orderValues[index],
    date: row.date,
  }));
  const revenuePoints = rows.map((row, index) => ({
    x: getX(index),
    y: getRevenueY(revenueValues[index]),
    value: revenueValues[index],
    date: row.date,
  }));
  const toPath = (points) => points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ');
  const gridLines = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    return {
      y: padding.top + plotHeight - ratio * plotHeight,
      orders: maxOrders * ratio,
      revenue: maxRevenue * ratio,
    };
  });
  const labelStep = Math.max(Math.ceil(rows.length / 6), 1);
  const dateIndexes = rows
    .map((_, index) => index)
    .filter((index) => index % labelStep === 0 || index === rows.length - 1);
  const activeRow = activeIndex === null ? null : rows[activeIndex];
  const tooltipWidth = 190;
  const tooltipX = activeIndex === null
    ? 0
    : Math.min(
      Math.max(getX(activeIndex) - tooltipWidth / 2, padding.left),
      width - padding.right - tooltipWidth,
    );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-gray-600">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-primary-600" />
          Заказы · левая шкала
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-success-600" />
          Выручка · правая шкала
        </span>
      </div>

      <div ref={scrollContainerRef} className="overflow-x-auto pb-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={useCompactMobileChart ? 'w-full' : 'w-full min-w-[640px]'}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Динамика заказов и выручки ${rangeLabel || ''}`.trim()}
          onPointerLeave={() => setActiveIndex(null)}
        >
        <text x={padding.left} y="14" fill="#6b7280" fontSize="10" fontWeight="600">Заказы</text>
        <text x={width - padding.right} y="14" textAnchor="end" fill="#6b7280" fontSize="10" fontWeight="600">
          Выручка, {currencySymbol}
        </text>
        {gridLines.map((line, index) => (
          <g key={index}>
            <line
              x1={padding.left}
              y1={line.y}
              x2={width - padding.right}
              y2={line.y}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
            <text x={padding.left - 8} y={line.y + 4} textAnchor="end" fill="#4b6282" fontSize="10">
              {formatCompactNumber(line.orders)}
            </text>
            <text x={width - padding.right + 8} y={line.y + 4} textAnchor="start" fill="#059669" fontSize="10">
              {formatCompactNumber(line.revenue)}
            </text>
          </g>
        ))}

        {dateIndexes.map((index) => (
          <text
            key={index}
            x={getX(index)}
            y={height - 7}
            textAnchor="middle"
            fill="#9ca3af"
            fontSize="10"
          >
            {formatDate(rows[index].date)}
          </text>
        ))}

        <path
          d={toPath(orderPoints)}
          fill="none"
          stroke="#4b6282"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={toPath(revenuePoints)}
          fill="none"
          stroke="#16a34a"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {rows.map((row, index) => {
          const hitWidth = Math.max(plotWidth / Math.max(rows.length, 1), 18);
          return (
            <rect
              key={`${row.date}-${index}`}
              x={getX(index) - hitWidth / 2}
              y={padding.top}
              width={hitWidth}
              height={plotHeight}
              fill="transparent"
              className="cursor-crosshair"
              tabIndex="0"
              aria-label={`${formatDate(row.date, true)}: ${orderValues[index]} заказов, ${revenueValues[index].toLocaleString('ru-RU')} ${currencySymbol}`}
              onPointerEnter={() => setActiveIndex(index)}
              onPointerDown={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              onBlur={() => setActiveIndex(null)}
            />
          );
        })}

        {activeRow && (
          <g pointerEvents="none">
            <line
              x1={getX(activeIndex)}
              y1={padding.top}
              x2={getX(activeIndex)}
              y2={padding.top + plotHeight}
              stroke="#6b7280"
              strokeDasharray="4 4"
              opacity="0.45"
            />
            <circle cx={getX(activeIndex)} cy={orderPoints[activeIndex].y} r="5" fill="white" stroke="#4b6282" strokeWidth="3" />
            <circle cx={getX(activeIndex)} cy={revenuePoints[activeIndex].y} r="5" fill="white" stroke="#16a34a" strokeWidth="3" />
            <rect x={tooltipX} y={4} width={tooltipWidth} height="66" rx="9" fill="#111827" opacity="0.96" />
            <text x={tooltipX + 12} y={22} fill="#d1d5db" fontSize="10">
              {formatDate(activeRow.date, true)}
            </text>
            <text x={tooltipX + 12} y={41} fill="#cfd5e5" fontSize="11" fontWeight="600">
              Заказы: {orderValues[activeIndex].toLocaleString('ru-RU')}
            </text>
            <text x={tooltipX + 12} y={59} fill="#6ee7b7" fontSize="11" fontWeight="600">
              Выручка: {revenueValues[activeIndex].toLocaleString('ru-RU')} {currencySymbol}
            </text>
          </g>
        )}
        </svg>
      </div>
    </div>
  );
};

const MetricCard = ({ label, value, hint, icon, tone = 'primary' }) => {
  const tones = {
    primary: 'bg-primary-50 text-primary-700 ring-primary-100',
    info: 'bg-info-50 text-info-600 ring-info-100',
    success: 'bg-success-50 text-success-600 ring-success-100',
    warning: 'bg-warning-50 text-warning-600 ring-warning-100',
  };

  return (
    <div className="surface-section min-w-0 overflow-hidden">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${tones[tone] || tones.primary}`}>
          {icon}
        </div>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-500">{hint}</span>
      </div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 break-words text-2xl font-bold tracking-tight text-gray-950">{value}</p>
    </div>
  );
};

const PeriodSummary = ({ periods, currencySymbol }) => (
  <section className="surface h-full overflow-hidden" aria-labelledby="period-summary-title">
    <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
      <h2 id="period-summary-title" className="text-base font-bold text-gray-950">Сводка по периодам</h2>
      <p className="mt-1 text-xs leading-5 text-gray-500">Заказы, выручка и просмотры</p>
    </div>
    <div className="divide-y divide-gray-100">
      {periods.map((period) => (
        <div key={period.label} className="px-5 py-4 sm:px-6">
          <p className="mb-3 text-sm font-semibold text-gray-900">{period.label}</p>
          <dl className="grid grid-cols-3 gap-3">
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Заказы</dt>
              <dd className="mt-1 text-sm font-bold text-gray-900">{Number(period.orders || 0).toLocaleString('ru-RU')}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Выручка</dt>
              <dd className="mt-1 truncate text-sm font-bold text-gray-900" title={`${Number(period.revenue || 0).toLocaleString('ru-RU')} ${currencySymbol}`}>
                {formatCompactNumber(period.revenue)} {currencySymbol}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Визиты</dt>
              <dd className="mt-1 text-sm font-bold text-gray-900">{Number(period.views || 0).toLocaleString('ru-RU')}</dd>
            </div>
          </dl>
        </div>
      ))}
    </div>
  </section>
);

const StatisticsSkeleton = () => (
  <div className="space-y-6" aria-label="Загрузка статистики" aria-busy="true">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="surface-section">
          <div className="skeleton h-11 w-11 rounded-xl" />
          <div className="skeleton mt-4 h-4 w-24" />
          <div className="skeleton mt-3 h-8 w-32" />
        </div>
      ))}
    </div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
      <div className="surface-section">
        <div className="skeleton h-5 w-48" />
        <div className="skeleton mt-5 h-[300px] w-full rounded-xl" />
      </div>
      <div className="surface-section">
        <div className="skeleton h-5 w-40" />
        <div className="mt-6 space-y-6">
          {Array.from({ length: 3 }, (_, index) => <div key={index} className="skeleton h-16 w-full" />)}
        </div>
      </div>
    </div>
    <div className="surface-section">
      <div className="skeleton h-5 w-36" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="skeleton h-14 w-full" />)}
      </div>
    </div>
  </div>
);

const OrderStatusSelect = ({ order, updatingStatusId, onChange, compact = false }) => {
  const statusIsEditable = ORDER_STATUSES.some((status) => status.value === order.status);
  const readOnlyStatusLabel = order.status === 'pending_payment' ? 'Ожидает оплату' : order.status;

  return (
    <select
      className={`${compact ? 'min-h-9 px-2.5 py-1.5 text-xs' : 'min-h-10 px-3 py-2 text-sm'} rounded-xl border border-gray-200 bg-white font-medium text-gray-700 shadow-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-70`}
      value={order.status}
      onChange={(event) => onChange(order.id, event.target.value)}
      disabled={updatingStatusId === order.id || !statusIsEditable}
      aria-label={`Статус заказа ${order.orderNumber}`}
      title={statusIsEditable ? 'Изменить статус' : 'Статус изменится автоматически'}
    >
      {!statusIsEditable && <option value={order.status}>{readOnlyStatusLabel}</option>}
      {ORDER_STATUSES.map((status) => (
        <option key={status.value} value={status.value}>{status.label}</option>
      ))}
    </select>
  );
};

const RecentOrders = ({ orders, currencySymbol, updatingStatusId, onStatusChange, onOpen }) => (
  <section className="surface overflow-hidden" aria-labelledby="recent-orders-title">
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-6">
      <div>
        <h2 id="recent-orders-title" className="text-base font-bold text-gray-950">Последние заказы</h2>
        <p className="mt-1 text-xs leading-5 text-gray-500">Статусы можно менять прямо в списке</p>
      </div>
      <span className="hidden items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-600 sm:inline-flex">
        <span className="h-1.5 w-1.5 rounded-full bg-success-600" />
        Автообновление
      </span>
    </div>

    {orders?.length > 0 ? (
      <>
        <div className="divide-y divide-gray-100 md:hidden">
          {orders.map((order) => (
            <article key={order.id} className="px-4 py-4 sm:px-5">
              <button type="button" onClick={() => onOpen(order.id)} className="w-full rounded-xl text-left focus-visible:outline-none">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-gray-950">#{String(order.orderNumber || '').replace(/^#+/, '')}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="mt-1 truncate text-sm text-gray-600">{order.customerName || 'Клиент не указан'}</p>
                    <p className="mt-1 text-xs text-gray-400">{formatDateTime(order.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-right text-sm font-bold text-gray-950">
                      {Number(order.totalAmount || 0).toLocaleString('ru-RU')} {currencySymbol}
                    </span>
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
                <span className="text-xs font-medium text-gray-500">Изменить статус</span>
                <OrderStatusSelect
                  order={order}
                  updatingStatusId={updatingStatusId}
                  onChange={onStatusChange}
                  compact
                />
              </div>
            </article>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/70 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="px-6 py-3">Заказ</th>
                <th className="px-4 py-3">Клиент</th>
                <th className="px-4 py-3">Дата</th>
                <th className="px-4 py-3">Сумма</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Изменить</th>
                <th className="w-12 px-4 py-3"><span className="sr-only">Открыть</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => (
                <tr key={order.id} className="group transition-colors hover:bg-primary-50/40">
                  <td className="px-6 py-4">
                    <button type="button" onClick={() => onOpen(order.id)} className="font-bold text-gray-950 hover:text-primary-700">
                      #{String(order.orderNumber || '').replace(/^#+/, '')}
                    </button>
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-4 text-gray-700">{order.customerName || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-gray-500">{formatDateTime(order.createdAt)}</td>
                  <td className="whitespace-nowrap px-4 py-4 font-bold text-gray-950">
                    {Number(order.totalAmount || 0).toLocaleString('ru-RU')} {currencySymbol}
                  </td>
                  <td className="px-4 py-4"><StatusBadge status={order.status} /></td>
                  <td className="px-4 py-4">
                    <OrderStatusSelect order={order} updatingStatusId={updatingStatusId} onChange={onStatusChange} compact />
                  </td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => onOpen(order.id)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-white hover:text-primary-700"
                      aria-label={`Открыть заказ ${order.orderNumber}`}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    ) : (
      <EmptyState
        icon={
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 2.25h9.75L20.25 6.75V21.75H6V2.25zM15.75 2.25V6.75H20.25M9 11.25h8.25M9 15h8.25" />
          </svg>
        }
        title="Заказов пока нет"
        description="Новые заказы появятся здесь автоматически."
      />
    )}
  </section>
);

const TopDishes = ({ dishes, currencySymbol, title }) => {
  if (!dishes?.length) return null;
  const maxQuantity = Math.max(...dishes.map((dish) => Number(dish.totalQuantity) || 0), 1);

  return (
    <section className="surface-section" aria-labelledby="top-dishes-title">
      <div className="mb-5">
        <h2 id="top-dishes-title" className="text-base font-bold text-gray-950">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-gray-500">Рейтинг по количеству проданных позиций</p>
      </div>
      <div className="space-y-2 sm:hidden">
        {dishes.map((dish, index) => (
          <article key={dish.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/50 p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-bold text-primary-700 shadow-sm ring-1 ring-gray-200">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-bold text-gray-950">{dish.name}</h3>
              <p className="mt-0.5 text-xs text-gray-500">
                {Number(dish.orderCount || 0).toLocaleString('ru-RU')} заказов · {Number(dish.totalQuantity || 0).toLocaleString('ru-RU')} шт.
              </p>
            </div>
            <span className="shrink-0 text-sm font-bold text-gray-950">
              {Number(dish.price || 0).toLocaleString('ru-RU')} {currencySymbol}
            </span>
          </article>
        ))}
      </div>
      <div className="hidden gap-3 sm:grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        {dishes.map((dish, index) => {
          const quantity = Number(dish.totalQuantity) || 0;
          return (
            <article key={dish.id} className="rounded-2xl border border-gray-200 bg-gray-50/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-bold text-primary-700 shadow-sm ring-1 ring-gray-200">
                  {index + 1}
                </span>
                <span className="text-xs font-semibold text-gray-500">{quantity.toLocaleString('ru-RU')} шт.</span>
              </div>
              <h3 className="mt-3 line-clamp-2 min-h-10 text-sm font-bold leading-5 text-gray-950">{dish.name}</h3>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-200" aria-hidden="true">
                <div className="h-full rounded-full bg-primary-600" style={{ width: `${Math.max(8, (quantity / maxQuantity) * 100)}%` }} />
              </div>
              <div className="mt-3 flex items-end justify-between gap-2 text-xs text-gray-500">
                <span>{Number(dish.orderCount || 0).toLocaleString('ru-RU')} заказов</span>
                <span className="whitespace-nowrap font-bold text-gray-900">
                  {Number(dish.price || 0).toLocaleString('ru-RU')} {currencySymbol}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

const StatisticsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { userData, loading } = useUserData();
  const {
    selectedRestaurantId,
    setSelectedRestaurantId,
    selectedRestaurant,
    allRestaurants,
  } = useSelectedRestaurant(userData);
  const [stats, setStats] = useState(null);
  const [views, setViews] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isOrderLoading, setIsOrderLoading] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [chartRange, setChartRange] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches ? 7 : 30
  ));
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const lastOrderIdRef = useRef(null);
  const activeRestaurantIdRef = useRef(selectedRestaurantId);
  activeRestaurantIdRef.current = selectedRestaurantId;

  const canViewAnalytics = useMemo(() => {
    if (!selectedRestaurantId || !userData) return false;
    return (userData.restaurants || []).some((restaurant) => restaurant.id === selectedRestaurantId);
  }, [selectedRestaurantId, userData]);

  const loadStats = useCallback(async () => {
    if (!selectedRestaurantId || !canViewAnalytics) return;

    const restaurantId = selectedRestaurantId;
    setLoadingStats(true);
    setStatsError('');
    try {
      const [statsData, viewsData] = await Promise.all([
        analyticsService.getRestaurantStats(restaurantId),
        analyticsService.getRestaurantViews(restaurantId),
      ]);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setStats(statsData);
      setViews(viewsData);
      setLastUpdatedAt(new Date());
      lastOrderIdRef.current = statsData?.recentOrders?.[0]?.id || null;
    } catch (error) {
      if (activeRestaurantIdRef.current !== restaurantId) return;
      setStatsError(
        error?.status === 403
          ? 'У вас нет доступа к статистике этого заведения.'
          : error?.message || 'Не удалось загрузить статистику',
      );
    } finally {
      if (activeRestaurantIdRef.current === restaurantId) {
        setLoadingStats(false);
      }
    }
  }, [canViewAnalytics, selectedRestaurantId]);

  const checkForNewOrders = useCallback(async () => {
    if (!selectedRestaurantId || !canViewAnalytics) return;

    const restaurantId = selectedRestaurantId;
    try {
      const statsData = await analyticsService.getRestaurantStats(restaurantId);
      if (activeRestaurantIdRef.current !== restaurantId) return;
      const latestOrder = statsData?.recentOrders?.[0];
      if (latestOrder?.id) {
        if (lastOrderIdRef.current && lastOrderIdRef.current !== latestOrder.id) {
          const orderNumber = `#${String(latestOrder.orderNumber || '').replace(/^#+/, '')}`;
          toast.success(`Новый заказ ${orderNumber}`.trim());
        }
        lastOrderIdRef.current = latestOrder.id;
      }
      setStats(statsData);
    } catch (error) {
      if (error?.status !== 403) console.error('Error polling orders:', error);
    }
  }, [canViewAnalytics, selectedRestaurantId]);

  useEffect(() => {
    if (!selectedRestaurantId || !canViewAnalytics) {
      setStats(null);
      setViews(null);
      setLastUpdatedAt(null);
      setStatsError('');
      setLoadingStats(false);
      lastOrderIdRef.current = null;
      return;
    }
    setStats(null);
    setViews(null);
    setLastUpdatedAt(null);
    setStatsError('');
    lastOrderIdRef.current = null;
    loadStats();
  }, [canViewAnalytics, loadStats, selectedRestaurantId]);

  useEffect(() => {
    if (!selectedRestaurantId || !canViewAnalytics) return undefined;
    const intervalId = window.setInterval(checkForNewOrders, 15000);
    return () => window.clearInterval(intervalId);
  }, [canViewAnalytics, checkForNewOrders, selectedRestaurantId]);

  const openOrderDetails = async (orderId) => {
    setIsOrderModalOpen(true);
    setIsOrderLoading(true);
    setSelectedOrder(null);
    try {
      setSelectedOrder(await ordersService.getOrder(orderId));
    } catch (error) {
      const message = typeof error === 'string' ? error : error?.error || error?.message || 'Не удалось загрузить заказ';
      toast.error(message);
      setIsOrderModalOpen(false);
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
      setSelectedOrder((currentOrder) => currentOrder?.id === orderId
        ? { ...currentOrder, status }
        : currentOrder);
      await loadStats();
    } catch (error) {
      const message = typeof error === 'string' ? error : error?.error || error?.message || 'Не удалось изменить статус';
      toast.error(message);
    } finally {
      setUpdatingStatusId(null);
    }
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
    if (order.deliveryType === 'dine_in') {
      const selectedBusinessType = getBusinessType(selectedRestaurant?.businessType);
      return order.tableNumber
        ? `${selectedBusinessType.tableLabel} ${order.tableNumber}`
        : selectedRestaurant?.businessType === 'HOTEL' ? 'В номер' : 'В зале';
    }
    return order.deliveryAddress || (order.deliveryType === 'pickup' ? 'Самовывоз' : '—');
  };

  const parseModifiers = (modifiers) => {
    if (!modifiers) return [];
    if (Array.isArray(modifiers)) return modifiers;
    if (typeof modifiers !== 'string') return [];
    try {
      const parsed = JSON.parse(modifiers);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  if (user?.isAdmin) return <Navigate to="/admin/dashboard" replace />;

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F6F7F9] text-gray-500">
        <LoadingSpinner size="lg" />
        <p className="text-sm font-medium">Загружаем рабочее пространство</p>
      </div>
    );
  }

  const currencySymbol = getCurrencySymbol(stats?.currency || selectedRestaurant?.currency);
  const businessType = getBusinessType(selectedRestaurant?.businessType);
  const chartData = Array.isArray(stats?.chartData) ? stats.chartData.slice(-chartRange) : [];
  const chartRangeLabel = chartRange === 7 ? 'за 7 дней' : 'за 30 дней';
  const chartTotals = chartData.reduce((totals, row) => ({
    orders: totals.orders + (Number(row.orders) || 0),
    revenue: totals.revenue + (Number(row.revenue) || 0),
  }), { orders: 0, revenue: 0 });
  const periods = [
    {
      label: 'За неделю',
      orders: stats?.period?.week?.orders,
      revenue: stats?.period?.week?.revenue,
      views: views?.week,
    },
    {
      label: 'За месяц',
      orders: stats?.period?.month?.orders,
      revenue: stats?.period?.month?.revenue,
      views: views?.month,
    },
    {
      label: 'За всё время',
      orders: stats?.overview?.totalOrders,
      revenue: stats?.overview?.totalRevenue,
      views: views?.total,
    },
  ];
  const updatedTimeLabel = lastUpdatedAt
    ? lastUpdatedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : null;
  const dineInLabel = selectedRestaurant?.businessType === 'HOTEL' ? 'В номер' : 'В зале';

  return (
    <DashboardLayout userData={userData} selectedRestaurantId={selectedRestaurantId}>
      <div className="mx-auto max-w-7xl">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">Аналитика</p>
            <h1 className="page-title">Статистика</h1>
            <p className="page-description">
              Заказы, выручка и активность гостей — в одном понятном обзоре.
            </p>
          </div>

          {allRestaurants?.length > 0 && (
            <div className="w-full sm:w-[340px]">
              <label className="form-label">Заведение</label>
              <RestaurantSelector
                userData={userData}
                selectedRestaurantId={selectedRestaurantId}
                onSelectRestaurant={setSelectedRestaurantId}
                placeholderLabel="заведение"
              />
              {canViewAnalytics && (
                <div className="mt-2 flex min-h-10 items-center justify-between gap-3">
                  <p className="text-xs text-gray-400">
                    {updatedTimeLabel ? `Обновлено в ${updatedTimeLabel}` : 'Данные ещё не загружены'}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => loadStats()}
                    loading={loadingStats && Boolean(stats)}
                    disabled={loadingStats && !stats}
                    className="shrink-0 px-2.5"
                  >
                    {!(loadingStats && stats) && (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7h-5V2M4 17h5v5M19 12a7 7 0 00-12-4.9L4 10M5 12a7 7 0 0012 4.9L20 14" />
                      </svg>
                    )}
                    Обновить
                  </Button>
                </div>
              )}
            </div>
          )}
        </header>

        {!selectedRestaurantId ? (
          <div className="surface">
            <EmptyState
              icon={
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6" />
                </svg>
              }
              title="Нет выбранного заведения"
              description="Создайте или выберите заведение, чтобы увидеть его статистику."
              action={() => navigate('/dashboard')}
              actionLabel="На главную"
            />
          </div>
        ) : !canViewAnalytics ? (
          <div className="surface">
            <EmptyState
              icon={
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 10.5V7.75a4.5 4.5 0 019 0v2.75M6 10.5h12v10.25H6V10.5z" />
                </svg>
              }
              title="Статистика доступна владельцу"
              description="Менеджеры могут управлять меню и стоп‑листом, но финансовые данные видит только владелец."
              action={() => navigate('/dashboard')}
              actionLabel="Вернуться на главную"
            />
          </div>
        ) : loadingStats && (!stats || !views) ? (
          <StatisticsSkeleton />
        ) : statsError && (!stats || !views) ? (
          <div className="surface">
            <EmptyState
              icon={
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.7L2.7 17a2 2 0 001.73 3h15.14a2 2 0 001.73-3L13.7 3.7a2 2 0 00-3.4 0z" />
                </svg>
              }
              title="Не удалось загрузить статистику"
              description={statsError}
              action={() => loadStats()}
              actionLabel="Повторить"
            />
          </div>
        ) : stats && views ? (
          <div className="space-y-6">
            {statsError && (
              <div className="flex flex-col gap-3 rounded-2xl border border-warning-100 bg-warning-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" role="alert">
                <div className="flex items-start gap-3">
                  <svg className="mt-0.5 h-5 w-5 shrink-0 text-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.7L2.7 17a2 2 0 001.73 3h15.14a2 2 0 001.73-3L13.7 3.7a2 2 0 00-3.4 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-warning-900">Не удалось обновить данные</p>
                    <p className="mt-0.5 text-xs text-warning-600">Показываем последнюю успешно загруженную версию.</p>
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => loadStats()}>Повторить</Button>
              </div>
            )}

            <section aria-labelledby="key-metrics-title">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="key-metrics-title" className="text-lg font-bold text-gray-950">Ключевые показатели</h2>
                  <p className="mt-1 text-sm text-gray-500">Ситуация на сегодня и состояние меню</p>
                </div>
                <p className="text-xs font-medium text-gray-400">
                  {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
                <MetricCard
                  label="Просмотры"
                  value={Number(views.today || 0).toLocaleString('ru-RU')}
                  hint="Сегодня"
                  tone="info"
                  icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" /><circle cx="12" cy="12" r="2.5" /></svg>}
                />
                <MetricCard
                  label="Заказы"
                  value={Number(stats.period?.today?.orders || 0).toLocaleString('ru-RU')}
                  hint="Сегодня"
                  tone="primary"
                  icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12l1 14H5L6 7zM9 9V5a3 3 0 016 0v4" /></svg>}
                />
                <MetricCard
                  label="Выручка"
                  value={`${Number(stats.period?.today?.revenue || 0).toLocaleString('ru-RU')} ${currencySymbol}`}
                  hint="Сегодня"
                  tone="success"
                  icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m3-9.5c-.8-.8-1.8-1.2-3-1.2-1.7 0-3 1-3 2.3 0 3.4 6 1.8 6 5.1 0 1.3-1.3 2.3-3 2.3-1.2 0-2.4-.5-3.2-1.3" /></svg>}
                />
                <MetricCard
                  label={businessType.itemsLabel || 'Позиции меню'}
                  value={Number(stats.overview?.totalDishes || 0).toLocaleString('ru-RU')}
                  hint={`${Number(stats.overview?.totalCategories || 0).toLocaleString('ru-RU')} категорий`}
                  tone="warning"
                  icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 5.5h16M4 12h16M4 18.5h10" /></svg>}
                />
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
              <section className="surface-section min-w-0" aria-labelledby="trend-chart-title">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 id="trend-chart-title" className="text-base font-bold text-gray-950">Заказы и выручка</h2>
                    <p className="mt-1 text-xs leading-5 text-gray-500">Две метрики на одном графике с отдельными шкалами</p>
                  </div>
                  <div className="inline-flex self-start rounded-xl bg-gray-100 p-1" role="group" aria-label="Период графика">
                    {[7, 30].map((range) => (
                      <button
                        key={range}
                        type="button"
                        onClick={() => setChartRange(range)}
                        aria-pressed={chartRange === range}
                        className={`min-h-9 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${chartRange === range ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                      >
                        {range} дней
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-lg bg-primary-50 px-3 py-2 text-xs font-medium text-primary-700">
                    {chartTotals.orders.toLocaleString('ru-RU')} заказов
                  </span>
                  <span className="rounded-lg bg-success-50 px-3 py-2 text-xs font-medium text-success-600">
                    {chartTotals.revenue.toLocaleString('ru-RU')} {currencySymbol} выручки
                  </span>
                </div>

                <div className="mt-5">
                  <DualMetricChart
                    key={chartRange}
                    data={chartData}
                    currencySymbol={currencySymbol}
                    rangeLabel={chartRangeLabel}
                  />
                </div>
                <p className="mt-2 text-center text-[11px] text-gray-400 sm:hidden">Проведите по графику, чтобы увидеть значения</p>
              </section>

              <PeriodSummary periods={periods} currencySymbol={currencySymbol} />
            </div>

            <RecentOrders
              orders={stats.recentOrders}
              currencySymbol={currencySymbol}
              updatingStatusId={updatingStatusId}
              onStatusChange={handleUpdateOrderStatus}
              onOpen={openOrderDetails}
            />

            <TopDishes
              dishes={stats.topDishes}
              currencySymbol={currencySymbol}
              title={businessType.popularLabel}
            />
          </div>
        ) : (
          <div className="surface">
            <EmptyState title="Статистика пока недоступна" description="Попробуйте обновить страницу или выбрать другое заведение." />
          </div>
        )}
      </div>

      <Modal
        isOpen={isOrderModalOpen}
        onClose={closeOrderModal}
        title={selectedOrder ? `Заказ #${String(selectedOrder.orderNumber || '').replace(/^#+/, '')}` : 'Детали заказа'}
        maxWidth="max-w-4xl"
      >
        {isOrderLoading ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-gray-500">
            <LoadingSpinner size="lg" />
            <p className="text-sm font-medium">Загружаем заказ</p>
          </div>
        ) : selectedOrder ? (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 rounded-2xl bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-bold text-gray-950">{selectedOrder.customerName || 'Клиент'}</p>
                <p className="mt-0.5 text-xs text-gray-500">{formatDateTime(selectedOrder.createdAt)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={selectedOrder.status} />
                <OrderStatusSelect
                  order={selectedOrder}
                  updatingStatusId={updatingStatusId}
                  onChange={handleUpdateOrderStatus}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <section className="rounded-2xl border border-gray-200 p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-info-50 text-info-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
                    <circle cx="12" cy="8" r="3.25" /><path strokeLinecap="round" strokeLinejoin="round" d="M5.5 20a6.5 6.5 0 0113 0" />
                  </svg>
                </div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Клиент</h3>
                <p className="mt-2 font-bold text-gray-950">{selectedOrder.customerName || '—'}</p>
                <p className="mt-1 text-sm text-gray-600">{selectedOrder.customerPhone || '—'}</p>
                {selectedOrder.customerEmail && <p className="mt-1 break-all text-sm text-gray-600">{selectedOrder.customerEmail}</p>}
              </section>

              <section className="rounded-2xl border border-gray-200 p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12l1 14H5L6 7zM9 9V5a3 3 0 016 0v4" />
                  </svg>
                </div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Получение и оплата</h3>
                <p className="mt-2 font-bold text-gray-950">
                  {selectedOrder.deliveryType === 'dine_in'
                    ? `${dineInLabel}${selectedOrder.tableNumber ? ` · ${businessType.tableLabel} ${selectedOrder.tableNumber}` : ''}`
                    : selectedOrder.deliveryType === 'pickup' ? 'Самовывоз' : 'Доставка'}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  {selectedOrder.paymentMethod === 'finik'
                    ? 'Finik · оплачено'
                    : selectedOrder.paymentMethod === 'card' ? 'Картой' : 'Наличными'}
                </p>
              </section>

              <section className="rounded-2xl border border-gray-200 p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-success-50 text-success-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-5.1 7-12a7 7 0 10-14 0c0 6.9 7 12 7 12z" /><circle cx="12" cy="9" r="2.2" />
                  </svg>
                </div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Адрес</h3>
                <p className="mt-2 whitespace-pre-line break-words text-sm font-medium leading-6 text-gray-800">{formatOrderAddress(selectedOrder)}</p>
                {selectedOrder.customerAddress?.label && (
                  <p className="mt-1 text-xs text-gray-500">{selectedOrder.customerAddress.label}</p>
                )}
              </section>
            </div>

            {selectedOrder.notes && (
              <div className="rounded-2xl border border-warning-100 bg-warning-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-warning-600">Комментарий</p>
                <p className="mt-1 text-sm leading-6 text-warning-900">{selectedOrder.notes}</p>
              </div>
            )}

            <section className="overflow-hidden rounded-2xl border border-gray-200">
              <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-4 py-3 sm:px-5">
                <h3 className="text-sm font-bold text-gray-950">Состав заказа</h3>
                <span className="text-xs font-medium text-gray-500">{selectedOrder.items?.length || 0} позиций</span>
              </div>
              <div className="divide-y divide-gray-100 px-4 sm:px-5">
                {selectedOrder.items?.map((item, index) => {
                  const modifiers = parseModifiers(item.selectedModifiers);
                  const itemName = item.dish?.name || item.dishName || item.product?.name || 'Позиция удалена';
                  const itemPrice = Number(item.price || 0);
                  const itemQuantity = Number(item.quantity || 0);
                  const itemCurrency = getCurrencySymbol(selectedOrder.restaurant?.currency || selectedRestaurant?.currency);
                  return (
                    <div key={item.id || `${itemName}-${index}`} className="flex items-start justify-between gap-4 py-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-950">{itemName}</p>
                        {modifiers.length > 0 && (
                          <p className="mt-1 text-xs leading-5 text-gray-500">{modifiers.map((modifier) => modifier.name).join(', ')}</p>
                        )}
                        <p className="mt-1 text-xs text-gray-400">
                          {itemPrice.toLocaleString('ru-RU')} {itemCurrency} × {itemQuantity}
                        </p>
                      </div>
                      <p className="shrink-0 font-bold text-gray-950">
                        {(itemPrice * itemQuantity).toLocaleString('ru-RU')} {itemCurrency}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-4 sm:px-5">
                <span className="text-sm font-semibold text-gray-600">Итого</span>
                <span className="text-xl font-bold tracking-tight text-gray-950">
                  {Number(selectedOrder.totalAmount || 0).toLocaleString('ru-RU')} {getCurrencySymbol(selectedOrder.restaurant?.currency || selectedRestaurant?.currency)}
                </span>
              </div>
            </section>
          </div>
        ) : (
          <EmptyState title="Данные заказа недоступны" description="Закройте окно и попробуйте ещё раз." />
        )}
      </Modal>
    </DashboardLayout>
  );
};

export default StatisticsPage;
