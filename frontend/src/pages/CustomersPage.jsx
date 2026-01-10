import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { authService } from '../services/authService';
import api from '../services/api';
import toast from 'react-hot-toast';

const CustomersPage = () => {
    const { restaurantId } = useParams();
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);
    const [restaurant, setRestaurant] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('createdAt'); // createdAt, totalOrders, totalSpent
    const [sortOrder, setSortOrder] = useState('desc'); // asc, desc

    useEffect(() => {
        loadData();
    }, [restaurantId]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [user, customersData] = await Promise.all([
                authService.getMe(),
                api.get(`/restaurants/${restaurantId}/customers`)
            ]);

            setUserData(user);
            setCustomers(customersData.data.customers || []);

            // Находим ресторан в данных пользователя
            const currentRestaurant = user.restaurants?.find(r => r.id === restaurantId) ||
                user.restaurantStaff?.find(s => s.restaurantId === restaurantId)?.restaurant;
            setRestaurant(currentRestaurant);
        } catch (error) {
            console.error('Error loading data:', error);
            toast.error('Ошибка загрузки данных');
            if (error.response?.status === 403) {
                toast.error('Доступ запрещён');
                navigate('/dashboard');
            }
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (date) => {
        if (!date) return 'Никогда';
        return new Date(date).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatCurrency = (amount) => {
        const currency = restaurant?.currency || 'RUB';
        const locale = currency === 'USD' ? 'en-US' : currency === 'EUR' ? 'de-DE' : 'ru-RU';

        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0
        }).format(amount);
    };

    // Фильтрация и сортировка
    const filteredAndSortedCustomers = customers
        .filter(customer => {
            if (!searchQuery) return true;
            const query = searchQuery.toLowerCase();
            return (
                customer.name?.toLowerCase().includes(query) ||
                customer.phone?.toLowerCase().includes(query) ||
                customer.email?.toLowerCase().includes(query)
            );
        })
        .sort((a, b) => {
            let aValue, bValue;

            switch (sortBy) {
                case 'totalOrders':
                    aValue = a.stats.totalOrders;
                    bValue = b.stats.totalOrders;
                    break;
                case 'totalSpent':
                    aValue = a.stats.totalSpent;
                    bValue = b.stats.totalSpent;
                    break;
                case 'lastOrder':
                    aValue = a.stats.lastOrderDate ? new Date(a.stats.lastOrderDate).getTime() : 0;
                    bValue = b.stats.lastOrderDate ? new Date(b.stats.lastOrderDate).getTime() : 0;
                    break;
                case 'createdAt':
                default:
                    aValue = new Date(a.createdAt).getTime();
                    bValue = new Date(b.createdAt).getTime();
                    break;
            }

            if (sortOrder === 'asc') {
                return aValue - bValue;
            } else {
                return bValue - aValue;
            }
        });

    if (loading) {
        return (
            <DashboardLayout userData={userData} selectedRestaurantId={restaurantId}>
                <div className="flex items-center justify-center min-h-96">
                    <div className="text-xl">Загрузка...</div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout userData={userData} selectedRestaurantId={restaurantId}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Клиенты</h1>
                    <p className="text-gray-600">
                        Всего клиентов: <span className="font-semibold">{customers.length}</span>
                    </p>
                </div>

                {/* Filters and Search */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search */}
                        <div className="flex-1">
                            <input
                                type="text"
                                placeholder="🔍 Поиск по имени, телефону или email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="input-field w-full"
                            />
                        </div>

                        {/* Sort By */}
                        <div className="flex gap-2">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="input-field"
                            >
                                <option value="createdAt">По дате регистрации</option>
                                <option value="totalOrders">По количеству заказов</option>
                                <option value="totalSpent">По сумме заказов</option>
                                <option value="lastOrder">По последнему заказу</option>
                            </select>

                            <button
                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                className="btn-secondary px-4"
                                title={sortOrder === 'asc' ? 'По возрастанию' : 'По убыванию'}
                            >
                                {sortOrder === 'asc' ? '↑' : '↓'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Customers List */}
                {filteredAndSortedCustomers.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                        <div className="text-6xl mb-4">👥</div>
                        <h3 className="text-xl font-semibold mb-2">
                            {searchQuery ? 'Клиенты не найдены' : 'Пока нет клиентов'}
                        </h3>
                        <p className="text-gray-600">
                            {searchQuery
                                ? 'Попробуйте изменить критерии поиска'
                                : 'Клиенты появятся здесь после регистрации в вашем QR-меню'}
                        </p>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Клиент
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Контакты
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Заказы
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Сумма
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Последний заказ
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Регистрация
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredAndSortedCustomers.map((customer) => (
                                        <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="flex-shrink-0 h-10 w-10">
                                                        {customer.avatar ? (
                                                            <img
                                                                className="h-10 w-10 rounded-full object-cover"
                                                                src={customer.avatar}
                                                                alt={customer.name || 'Customer'}
                                                            />
                                                        ) : (
                                                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                                                                {(customer.name || customer.phone || 'C').charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="ml-4">
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {customer.name || 'Без имени'}
                                                        </div>
                                                        {customer.favoriteDishes.length > 0 && (
                                                            <div className="text-xs text-gray-500">
                                                                ❤️ {customer.favoriteDishes.length} в избранном
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">{customer.phone}</div>
                                                {customer.email && (
                                                    <div className="text-sm text-gray-500">{customer.email}</div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-semibold text-gray-900">
                                                    {customer.stats.totalOrders}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-semibold text-green-600">
                                                    {formatCurrency(customer.stats.totalSpent)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">
                                                    {customer.stats.lastOrderDate
                                                        ? formatDate(customer.stats.lastOrderDate)
                                                        : 'Нет заказов'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-500">
                                                    {formatDate(customer.createdAt)}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Statistics */}
                {customers.length > 0 && (
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <div className="text-sm text-gray-500 mb-1">Всего клиентов</div>
                            <div className="text-3xl font-bold text-gray-900">{customers.length}</div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <div className="text-sm text-gray-500 mb-1">Всего заказов</div>
                            <div className="text-3xl font-bold text-gray-900">
                                {customers.reduce((sum, c) => sum + c.stats.totalOrders, 0)}
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <div className="text-sm text-gray-500 mb-1">Общая сумма</div>
                            <div className="text-3xl font-bold text-green-600">
                                {formatCurrency(customers.reduce((sum, c) => sum + c.stats.totalSpent, 0))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default CustomersPage;
