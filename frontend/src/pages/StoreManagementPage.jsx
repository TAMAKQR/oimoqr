import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import toast from 'react-hot-toast';
import { confirmDialog } from '../utils/confirmDialog';

const StoreManagementPage = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();
    const [restaurant, setRestaurant] = useState(null);
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('products'); // products | categories | inventory

    useEffect(() => {
        loadStoreData();
    }, []);

    const loadStoreData = async () => {
        try {
            setLoading(true);

            // Get user's restaurant
            const restaurantsRes = await api.get('/restaurants');
            const userRestaurant = restaurantsRes.data[0]; // Assuming first restaurant

            if (!userRestaurant || userRestaurant.businessType !== 'ONLINE_STORE') {
                toast.error('У вас нет онлайн-магазина');
                navigate('/dashboard');
                return;
            }

            setRestaurant(userRestaurant);

            // Load categories and products
            const [categoriesRes, productsRes] = await Promise.all([
                api.get(`/products/categories/${userRestaurant.id}`),
                api.get(`/products/restaurant/${userRestaurant.id}`)
            ]);

            setCategories(categoriesRes.data);
            setProducts(productsRes.data);
        } catch (error) {
            console.error('Error loading store data:', error);
            toast.error('Ошибка загрузки данных');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteProduct = async (productId) => {
        const confirmed = await confirmDialog('Удалить товар?', {
            confirmText: 'Удалить',
            cancelText: 'Отмена',
            icon: '🗑️'
        });
        if (!confirmed) return;

        try {
            await api.delete(`/products/${productId}`);
            toast.success('Товар удален');
            loadStoreData();
        } catch (error) {
            toast.error('Ошибка удаления товара');
        }
    };

    const handleToggleAvailability = async (product) => {
        try {
            await api.put(`/products/${product.id}`, {
                available: !product.available
            });
            toast.success(product.available ? 'Товар скрыт' : 'Товар доступен');
            loadStoreData();
        } catch (error) {
            toast.error('Ошибка обновления');
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-grab-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Управление магазином</h1>
                            <p className="text-sm text-gray-600 mt-1">{restaurant?.name}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="px-4 py-2 text-gray-600 hover:text-gray-900"
                            >
                                ← Назад
                            </button>
                            <button
                                onClick={handleLogout}
                                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                Выйти
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white border-b">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex gap-8">
                        <button
                            onClick={() => setActiveTab('products')}
                            className={`py-4 border-b-2 font-medium transition-colors ${activeTab === 'products'
                                ? 'border-grab-500 text-grab-600'
                                : 'border-transparent text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            Товары ({products.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('categories')}
                            className={`py-4 border-b-2 font-medium transition-colors ${activeTab === 'categories'
                                ? 'border-grab-500 text-grab-600'
                                : 'border-transparent text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            Категории ({categories.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('inventory')}
                            className={`py-4 border-b-2 font-medium transition-colors ${activeTab === 'inventory'
                                ? 'border-grab-500 text-grab-600'
                                : 'border-transparent text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            Остатки
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 py-6">
                {/* Products Tab */}
                {activeTab === 'products' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-semibold">Товары</h2>
                            <button className="bg-grab-500 hover:bg-grab-600 text-white px-6 py-2 rounded-grab font-medium transition-colors">
                                + Добавить товар
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {products.map((product) => (
                                <div key={product.id} className="bg-white rounded-grab shadow-grab p-4">
                                    <div className="flex gap-4">
                                        {/* Image */}
                                        <div className="flex-shrink-0">
                                            {product.images?.[0] ? (
                                                <img
                                                    src={product.images[0]}
                                                    alt={product.name}
                                                    className="w-20 h-20 rounded-lg object-cover"
                                                />
                                            ) : (
                                                <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                                                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
                                            <p className="text-sm text-gray-600">{product.category.name}</p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-lg font-bold text-grab-600">
                                                    {new Intl.NumberFormat('ru-RU').format(product.price)} ₽
                                                </span>
                                                {product.trackInventory && (
                                                    <span className={`text-xs px-2 py-1 rounded-full ${product.stockQuantity > 10
                                                        ? 'bg-green-100 text-green-700'
                                                        : product.stockQuantity > 0
                                                            ? 'bg-yellow-100 text-yellow-700'
                                                            : 'bg-red-100 text-red-700'
                                                        }`}>
                                                        {product.stockQuantity} шт
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 mt-4">
                                        <button
                                            onClick={() => handleToggleAvailability(product)}
                                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${product.available
                                                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                : 'bg-grab-100 text-grab-700 hover:bg-grab-200'
                                                }`}
                                        >
                                            {product.available ? 'Скрыть' : 'Показать'}
                                        </button>
                                        <button className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors">
                                            Изменить
                                        </button>
                                        <button
                                            onClick={() => handleDeleteProduct(product.id)}
                                            className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                                        >
                                            Удалить
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {products.length === 0 && (
                            <div className="text-center py-12">
                                <svg className="w-24 h-24 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                                <p className="text-gray-600 mb-4">Товаров пока нет</p>
                                <button className="bg-grab-500 hover:bg-grab-600 text-white px-6 py-2 rounded-grab font-medium transition-colors">
                                    + Добавить первый товар
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Categories Tab */}
                {activeTab === 'categories' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-semibold">Категории</h2>
                            <button className="bg-grab-500 hover:bg-grab-600 text-white px-6 py-2 rounded-grab font-medium transition-colors">
                                + Добавить категорию
                            </button>
                        </div>

                        <div className="bg-white rounded-grab shadow-grab overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Категория</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Товаров</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Порядок</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {categories.map((category) => (
                                        <tr key={category.id}>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">{category.name}</div>
                                                {category.description && (
                                                    <div className="text-sm text-gray-500">{category.description}</div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {category._count?.products || 0}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {category.order}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex gap-2">
                                                    <button className="text-blue-600 hover:text-blue-800">Изменить</button>
                                                    <button className="text-red-600 hover:text-red-800">Удалить</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Inventory Tab */}
                {activeTab === 'inventory' && (
                    <div>
                        <h2 className="text-xl font-semibold mb-6">Управление остатками</h2>

                        <div className="bg-white rounded-grab shadow-grab overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Товар</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Остаток</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {products.filter(p => p.trackInventory).map((product) => (
                                        <tr key={product.id}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    {product.images?.[0] && (
                                                        <img src={product.images[0]} alt="" className="w-10 h-10 rounded object-cover" />
                                                    )}
                                                    <span className="font-medium">{product.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {product.sku || '—'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-semibold">{product.stockQuantity}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 text-xs rounded-full ${product.stockQuantity > 10
                                                    ? 'bg-green-100 text-green-700'
                                                    : product.stockQuantity > 0
                                                        ? 'bg-yellow-100 text-yellow-700'
                                                        : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {product.stockQuantity > 10 ? 'В наличии' : product.stockQuantity > 0 ? 'Мало' : 'Нет'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <button className="text-grab-600 hover:text-grab-800 font-medium">
                                                    Изменить остаток
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StoreManagementPage;
