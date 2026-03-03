import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import api from '../services/api';

const ADMIN_DASHBOARD_CACHE_KEY = 'admin-dashboard-cache-v1';
const ADMIN_DASHBOARD_CACHE_TTL_MS = 60 * 1000;

const StatCard = ({ label, value, sub, icon, color = 'blue' }) => {
    const colors = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-green-50 text-green-600',
        purple: 'bg-purple-50 text-purple-600',
        orange: 'bg-orange-50 text-orange-600',
        red: 'bg-red-50 text-red-600',
        cyan: 'bg-cyan-50 text-cyan-600',
        pink: 'bg-pink-50 text-pink-600',
    };
    return (
        <div className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${colors[color]}`}>
                    {icon}
                </div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
        </div>
    );
};

const LineChart = ({ data, dataKey = 'count', label = '', color = '#3b82f6', height = 200 }) => {
    if (!data?.length) return <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">Нет данных</div>;

    const values = data.map(d => Number(d[dataKey]) || 0);
    const maxVal = Math.max(...values, 1);
    const minVal = Math.min(...values, 0);
    const range = maxVal - minVal || 1;

    const padX = 45;
    const padTop = 10;
    const padBottom = 30;
    const w = 600;
    const chartH = height - padTop - padBottom;

    const points = data.map((d, i) => {
        const x = padX + (i / Math.max(data.length - 1, 1)) * (w - padX - 10);
        const y = padTop + chartH - ((values[i] - minVal) / range) * chartH;
        return { x, y, val: values[i], date: d.date };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const areaPath = `${linePath} L${points[points.length - 1].x},${padTop + chartH} L${points[0].x},${padTop + chartH} Z`;

    // Y-axis grid lines (5 lines)
    const gridLines = Array.from({ length: 5 }, (_, i) => {
        const val = minVal + (range / 4) * i;
        const y = padTop + chartH - ((val - minVal) / range) * chartH;
        return { y, label: val >= 1000 ? `${(val / 1000).toFixed(1)}k` : Math.round(val).toString() };
    });

    // X-axis date labels (show ~6 labels)
    const step = Math.max(Math.floor(data.length / 6), 1);
    const dateLabels = data.filter((_, i) => i % step === 0 || i === data.length - 1).map((d, _, arr) => {
        const idx = data.indexOf(d);
        const x = padX + (idx / Math.max(data.length - 1, 1)) * (w - padX - 10);
        const dt = new Date(d.date);
        return { x, label: `${dt.getDate()}.${String(dt.getMonth() + 1).padStart(2, '0')}` };
    });

    const [hover, setHover] = useState(null);

    return (
        <div className="relative">
            <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
                {/* Grid */}
                {gridLines.map((g, i) => (
                    <g key={i}>
                        <line x1={padX} y1={g.y} x2={w - 10} y2={g.y} stroke="#f3f4f6" strokeWidth="1" />
                        <text x={padX - 6} y={g.y + 4} textAnchor="end" fill="#9ca3af" fontSize="10">{g.label}</text>
                    </g>
                ))}

                {/* Area fill */}
                <defs>
                    <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.15" />
                        <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                    </linearGradient>
                </defs>
                <path d={areaPath} fill={`url(#grad-${color.replace('#', '')})`} />

                {/* Line */}
                <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

                {/* Dots */}
                {points.map((p, i) => (
                    <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r={hover === i ? 5 : 3}
                        fill="white"
                        stroke={color}
                        strokeWidth="2"
                        className="cursor-pointer transition-all"
                        onMouseEnter={() => setHover(i)}
                        onMouseLeave={() => setHover(null)}
                    />
                ))}

                {/* X labels */}
                {dateLabels.map((d, i) => (
                    <text key={i} x={d.x} y={height - 6} textAnchor="middle" fill="#9ca3af" fontSize="10">{d.label}</text>
                ))}

                {/* Tooltip */}
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
        </div>
    );
};

const StatusBadge = ({ status }) => {
    const map = {
        PENDING: { bg: 'bg-yellow-100 text-yellow-800', label: 'Ожидает' },
        CONFIRMED: { bg: 'bg-blue-100 text-blue-800', label: 'Подтверждён' },
        PREPARING: { bg: 'bg-orange-100 text-orange-800', label: 'Готовится' },
        READY: { bg: 'bg-green-100 text-green-800', label: 'Готов' },
        DELIVERED: { bg: 'bg-green-100 text-green-800', label: 'Доставлен' },
        COMPLETED: { bg: 'bg-green-100 text-green-800', label: 'Завершён' },
        CANCELLED: { bg: 'bg-red-100 text-red-800', label: 'Отменён' },
        ACTIVE: { bg: 'bg-green-100 text-green-800', label: 'Активна' },
        TRIAL: { bg: 'bg-blue-100 text-blue-800', label: 'Триал' },
        EXPIRED: { bg: 'bg-red-100 text-red-800', label: 'Истекла' },
        CANCELLED_SUB: { bg: 'bg-gray-100 text-gray-800', label: 'Отменена' },
    };
    const s = map[status] || { bg: 'bg-gray-100 text-gray-700', label: status };
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.bg}`}>{s.label}</span>;
};

const AdminDashboardPage = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let hasFreshCachedData = false;

        try {
            const cachedRaw = localStorage.getItem(ADMIN_DASHBOARD_CACHE_KEY);
            if (cachedRaw) {
                const cached = JSON.parse(cachedRaw);
                if (cached?.payload && cached?.timestamp && (Date.now() - cached.timestamp) < ADMIN_DASHBOARD_CACHE_TTL_MS) {
                    setData(cached.payload);
                    setLoading(false);
                    hasFreshCachedData = true;
                }
            }
        } catch {
            // ignore cache parse issues
        }

        const load = async () => {
            try {
                const res = await api.get('/admin/stats/dashboard');
                setData(res.data);
                localStorage.setItem(
                    ADMIN_DASHBOARD_CACHE_KEY,
                    JSON.stringify({ payload: res.data, timestamp: Date.now() })
                );
                setError(null);
            } catch (err) {
                setError(err.message || 'Ошибка загрузки');
            } finally {
                if (!hasFreshCachedData) {
                    setLoading(false);
                }
            }
        };
        load();
    }, []);

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="text-center">
                        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-gray-500">Загрузка статистики...</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    if (error) {
        return (
            <DashboardLayout>
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                    <p className="text-red-600 font-medium">{error}</p>
                </div>
            </DashboardLayout>
        );
    }

    const { overview, today, week, growth, charts, distributions, topRestaurants, recentOrders } = data;

    const deliveryTypeLabels = {
        delivery: '🚗 Доставка',
        pickup: '🏃 Самовывоз',
        dine_in: '🍽️ В зале',
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Панель администратора</h1>
                    <p className="text-sm text-gray-500 mt-1">Обзор платформы OimoQR</p>
                </div>

                {/* Today highlight */}
                <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-6 text-white">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">📊</span>
                        <span className="text-sm font-medium opacity-90">Сегодня</span>
                    </div>
                    <div className="grid grid-cols-2 gap-6 mt-3">
                        <div>
                            <div className="text-3xl font-bold">{today.orders}</div>
                            <div className="text-sm opacity-80">заказов</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold">{Number(today.revenue).toLocaleString('ru')}</div>
                            <div className="text-sm opacity-80">выручка</div>
                        </div>
                    </div>
                    <div className="text-xs opacity-60 mt-3">За неделю: {week.orders} заказов</div>
                </div>

                {/* Overview Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard icon="👥" label="Пользователи" value={overview.totalUsers} sub={`+${growth.newUsersThisMonth} за месяц`} color="blue" />
                    <StatCard icon="🏪" label="Рестораны" value={overview.totalRestaurants} sub={`+${growth.newRestaurantsThisMonth} за месяц`} color="green" />
                    <StatCard icon="📦" label="Всего заказов" value={overview.totalOrders.toLocaleString('ru')} color="purple" />
                    <StatCard icon="💰" label="Общая выручка" value={Number(overview.totalRevenue).toLocaleString('ru')} color="orange" />
                    <StatCard icon="👤" label="Клиенты" value={overview.totalCustomers} sub={`+${growth.newCustomersThisMonth} за месяц`} color="cyan" />
                    <StatCard icon="🍽" label="Блюд в системе" value={overview.totalDishes} color="pink" />
                    <StatCard icon="👁" label="Просмотры меню" value={overview.menuViews30d.toLocaleString('ru')} sub="за 30 дней" color="blue" />
                </div>

                {/* Charts row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* User growth */}
                    <div className="bg-white rounded-xl border border-gray-100 p-5">
                        <h3 className="text-sm font-semibold text-gray-900 mb-1">📈 Рост пользователей</h3>
                        <p className="text-xs text-gray-500 mb-3">Новые регистрации за 30 дней</p>
                        <LineChart data={charts.userGrowth} dataKey="count" color="#3b82f6" label="Пользователи" />
                    </div>

                    {/* Order growth */}
                    <div className="bg-white rounded-xl border border-gray-100 p-5">
                        <h3 className="text-sm font-semibold text-gray-900 mb-1">📦 Заказы</h3>
                        <p className="text-xs text-gray-500 mb-3">Количество заказов за 30 дней</p>
                        <LineChart data={charts.orderGrowth} dataKey="count" color="#10b981" label="Заказы" />
                    </div>
                </div>

                {/* Revenue chart - full width */}
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">💰 Выручка</h3>
                    <p className="text-xs text-gray-500 mb-3">Динамика выручки за 30 дней</p>
                    <LineChart data={charts.orderGrowth} dataKey="revenue" color="#f59e0b" label="Выручка" height={220} />
                </div>

                {/* Distributions row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Subscriptions by status */}
                    <div className="bg-white rounded-xl border border-gray-100 p-5">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">Подписки</h3>
                        {distributions.subscriptionsByStatus?.length > 0 ? (
                            <div className="space-y-3">
                                {distributions.subscriptionsByStatus.map((s) => (
                                    <div key={s.status} className="flex items-center justify-between">
                                        <StatusBadge status={s.status} />
                                        <span className="text-sm font-bold text-gray-900">{s._count}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-400">Нет данных</p>
                        )}
                    </div>

                    {/* Orders by status */}
                    <div className="bg-white rounded-xl border border-gray-100 p-5">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">Заказы по статусу</h3>
                        {distributions.ordersByStatus?.length > 0 ? (
                            <div className="space-y-3">
                                {distributions.ordersByStatus.map((s) => (
                                    <div key={s.status} className="flex items-center justify-between">
                                        <StatusBadge status={s.status} />
                                        <span className="text-sm font-bold text-gray-900">{s._count}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-400">Нет данных</p>
                        )}
                    </div>

                    {/* Delivery types */}
                    <div className="bg-white rounded-xl border border-gray-100 p-5">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">Типы заказов</h3>
                        {distributions.ordersByDeliveryType?.length > 0 ? (
                            <div className="space-y-3">
                                {distributions.ordersByDeliveryType.map((d) => (
                                    <div key={d.deliveryType} className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600">{deliveryTypeLabels[d.deliveryType] || d.deliveryType}</span>
                                        <span className="text-sm font-bold text-gray-900">{d._count}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-400">Нет данных</p>
                        )}
                    </div>
                </div>

                {/* Bottom row: Top restaurants + Recent orders */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top restaurants */}
                    <div className="bg-white rounded-xl border border-gray-100 p-5">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">Топ-10 ресторанов</h3>
                        <div className="space-y-3">
                            {topRestaurants?.map((r, i) => (
                                <div key={r.id} className="flex items-center gap-3">
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {i + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-900 truncate">{r.name}</div>
                                        <div className="text-[10px] text-gray-400">{r.subdomain}.oimoqr.com {r.city ? `• ${r.city}` : ''}</div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <div className="text-sm font-bold text-gray-900">{r._count.orders}</div>
                                        <div className="text-[10px] text-gray-400">заказов</div>
                                    </div>
                                </div>
                            ))}
                            {(!topRestaurants || topRestaurants.length === 0) && (
                                <p className="text-sm text-gray-400">Нет данных</p>
                            )}
                        </div>
                    </div>

                    {/* Recent orders */}
                    <div className="bg-white rounded-xl border border-gray-100 p-5">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">Последние заказы</h3>
                        <div className="space-y-3">
                            {recentOrders?.map((o) => (
                                <div key={o.id} className="flex items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-900">#{String(o.orderNumber || '').replace(/^#+/, '')}</span>
                                            <StatusBadge status={o.status} />
                                        </div>
                                        <div className="text-[10px] text-gray-400">
                                            {o.restaurant?.name} • {deliveryTypeLabels[o.deliveryType] || o.deliveryType}
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <div className="text-sm font-bold text-gray-900">{Number(o.totalAmount).toLocaleString('ru')}</div>
                                        <div className="text-[10px] text-gray-400">
                                            {new Date(o.createdAt).toLocaleDateString('ru', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {(!recentOrders || recentOrders.length === 0) && (
                                <p className="text-sm text-gray-400">Нет заказов</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Cities */}
                {distributions.citiesDistribution?.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-100 p-5">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">География ресторанов</h3>
                        <div className="flex flex-wrap gap-2">
                            {distributions.citiesDistribution.map((c) => (
                                <span key={c.city} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-full text-sm">
                                    <span className="text-gray-600">{c.city}</span>
                                    <span className="font-bold text-gray-900">{c.count}</span>
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default AdminDashboardPage;
