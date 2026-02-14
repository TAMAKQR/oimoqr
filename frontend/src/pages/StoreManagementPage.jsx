import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserData } from '../hooks/useUserData';
import { useSelectedRestaurant } from '../hooks/useSelectedRestaurant';
import DashboardLayout from '../components/DashboardLayout';
import ProductForm from '../components/ProductForm';
import api from '../services/api';
import toast from 'react-hot-toast';
import { confirmDialog } from '../utils/confirmDialog';

const StoreManagementPage = () => {
    const navigate = useNavigate();
    const { userData, loading: userLoading } = useUserData();
    const { selectedRestaurantId, selectedRestaurant } = useSelectedRestaurant(userData);
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('products');

    // Product form state
    const [showProductForm, setShowProductForm] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);

    // Category form state
    const [showCategoryForm, setShowCategoryForm] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [categoryForm, setCategoryForm] = useState({ name: '', description: '', order: 0 });

    // Stock edit state
    const [editingStock, setEditingStock] = useState(null);
    const [stockValue, setStockValue] = useState(0);

    const loadStoreData = async () => {
        if (!selectedRestaurantId) return;
        try {
            setLoading(true);
            const categoriesRes = await api.get(`/products/categories/${selectedRestaurantId}`);
            setCategories(categoriesRes.data);

            // Load products per category to include unavailable ones
            const allProducts = [];
            for (const cat of categoriesRes.data) {
                const res = await api.get(`/products/category/${cat.id}`);
                allProducts.push(...res.data);
            }
            setProducts(allProducts);
        } catch (error) {
            console.error('Error loading store data:', error);
            toast.error('Ошибка загрузки данных');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedRestaurantId) loadStoreData();
    }, [selectedRestaurantId]);

    // ---- Product CRUD ----
    const handleDeleteProduct = async (productId) => {
        const confirmed = await confirmDialog('Удалить товар?', {
            confirmText: 'Удалить',
            cancelText: 'Отмена',
            icon: '🗑️'
        });
        if (!confirmed) return;

        try {
            await api.delete(`/products/${productId}`);
            toast.success('Товар удалён');
            loadStoreData();
        } catch (error) {
            toast.error('Ошибка удаления товара');
        }
    };

    const handleToggleAvailability = async (product) => {
        try {
            await api.put(`/products/${product.id}`, { available: !product.available });
            toast.success(product.available ? 'Товар скрыт' : 'Товар доступен');
            loadStoreData();
        } catch (error) {
            toast.error('Ошибка обновления');
        }
    };

    const handleProductSaved = () => {
        setShowProductForm(false);
        setEditingProduct(null);
        loadStoreData();
    };

    // ---- Category CRUD ----
    const openCategoryForm = (category = null) => {
        if (category) {
            setEditingCategory(category);
            setCategoryForm({ name: category.name, description: category.description || '', order: category.order || 0 });
        } else {
            setEditingCategory(null);
            setCategoryForm({ name: '', description: '', order: categories.length });
        }
        setShowCategoryForm(true);
    };

    const handleSaveCategory = async () => {
        if (!categoryForm.name.trim()) {
            toast.error('Название категории обязательно');
            return;
        }

        try {
            if (editingCategory) {
                await api.put(`/products/categories/${editingCategory.id}`, categoryForm);
                toast.success('Категория обновлена');
            } else {
                await api.post('/products/categories', {
                    ...categoryForm,
                    restaurantId: selectedRestaurantId
                });
                toast.success('Категория создана');
            }
            setShowCategoryForm(false);
            setEditingCategory(null);
            loadStoreData();
        } catch (error) {
            toast.error('Ошибка сохранения категории');
        }
    };

    const handleDeleteCategory = async (categoryId) => {
        const confirmed = await confirmDialog('Удалить категорию? Все товары из этой категории также будут удалены.', {
            confirmText: 'Удалить',
            cancelText: 'Отмена',
            icon: '⚠️'
        });
        if (!confirmed) return;

        try {
            await api.delete(`/products/categories/${categoryId}`);
            toast.success('Категория удалена');
            loadStoreData();
        } catch (error) {
            toast.error('Ошибка удаления категории');
        }
    };

    // ---- Stock update ----
    const handleUpdateStock = async () => {
        if (!editingStock) return;
        try {
            await api.patch(`/products/${editingStock.id}/stock`, {
                quantity: parseInt(stockValue),
                operation: 'set'
            });
            toast.success('Остаток обновлён');
            setEditingStock(null);
            loadStoreData();
        } catch (error) {
            toast.error('Ошибка обновления остатка');
        }
    };

    if (userLoading) {
        return (
            <DashboardLayout userData={userData} selectedRestaurantId={selectedRestaurantId}>
                <div className="flex items-center justify-center py-20">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
            </DashboardLayout>
        );
    }

    if (selectedRestaurant && selectedRestaurant.businessType !== 'ONLINE_STORE') {
        return (
            <DashboardLayout userData={userData} selectedRestaurantId={selectedRestaurantId}>
                <div className="text-center py-20">
                    <p className="text-gray-600 text-lg mb-4">Этот раздел доступен только для магазинов</p>
                    <button onClick={() => navigate('/dashboard')} className="text-blue-600 hover:text-blue-700 font-medium">
                        ← Вернуться на главную
                    </button>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout userData={userData} selectedRestaurantId={selectedRestaurantId}>
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Управление товарами</h1>
                    <p className="text-gray-500 text-sm mt-1">{selectedRestaurant?.name}</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
                    {[
                        { id: 'products', label: `Товары (${products.length})` },
                        { id: 'categories', label: `Категории (${categories.length})` },
                        { id: 'inventory', label: 'Остатки' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* ===== PRODUCTS TAB ===== */}
                        {activeTab === 'products' && (
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-lg font-semibold text-gray-900">Все товары</h2>
                                    <button
                                        onClick={() => {
                                            if (categories.length === 0) {
                                                toast.error('Сначала создайте категорию');
                                                setActiveTab('categories');
                                                return;
                                            }
                                            setEditingProduct(null);
                                            setShowProductForm(true);
                                        }}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                        </svg>
                                        Добавить товар
                                    </button>
                                </div>

                                {products.length === 0 ? (
                                    <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
                                        <div className="w-16 h-16 bg-gray-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                                            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                            </svg>
                                        </div>
                                        <p className="text-gray-600 mb-4">Товаров пока нет</p>
                                        <button
                                            onClick={() => {
                                                if (categories.length === 0) {
                                                    toast.error('Сначала создайте категорию');
                                                    setActiveTab('categories');
                                                    return;
                                                }
                                                setEditingProduct(null);
                                                setShowProductForm(true);
                                            }}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
                                        >
                                            + Добавить первый товар
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {products.map((product) => (
                                            <div key={product.id} className={`bg-white rounded-xl border ${product.available ? 'border-gray-100' : 'border-gray-200 opacity-60'} p-4 hover:shadow-sm transition-shadow`}>
                                                <div className="flex gap-4">
                                                    <div className="flex-shrink-0">
                                                        {product.images?.[0] ? (
                                                            <img src={product.images[0]} alt={product.name} className="w-20 h-20 rounded-lg object-cover" />
                                                        ) : (
                                                            <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                                                                <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V5.25a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                                                                </svg>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
                                                        <p className="text-sm text-gray-500">{product.category?.name}</p>
                                                        <div className="flex items-center gap-2 mt-2">
                                                            <span className="text-lg font-bold text-gray-900">
                                                                {new Intl.NumberFormat('ru-RU').format(product.price)} ₽
                                                            </span>
                                                            {product.compareAtPrice && product.compareAtPrice > product.price && (
                                                                <span className="text-sm text-gray-400 line-through">
                                                                    {new Intl.NumberFormat('ru-RU').format(product.compareAtPrice)} ₽
                                                                </span>
                                                            )}
                                                        </div>
                                                        {product.trackInventory && (
                                                            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${product.stockQuantity > 10 ? 'bg-green-100 text-green-700'
                                                                    : product.stockQuantity > 0 ? 'bg-yellow-100 text-yellow-700'
                                                                        : 'bg-red-100 text-red-700'
                                                                }`}>
                                                                {product.stockQuantity} шт
                                                            </span>
                                                        )}
                                                        {!product.available && (
                                                            <span className="inline-block mt-1 ml-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Скрыт</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex gap-2 mt-4">
                                                    <button
                                                        onClick={() => handleToggleAvailability(product)}
                                                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${product.available ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-green-100 text-green-700 hover:bg-green-200'
                                                            }`}
                                                    >
                                                        {product.available ? 'Скрыть' : 'Показать'}
                                                    </button>
                                                    <button
                                                        onClick={() => { setEditingProduct(product); setShowProductForm(true); }}
                                                        className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors"
                                                    >
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
                                )}
                            </div>
                        )}

                        {/* ===== CATEGORIES TAB ===== */}
                        {activeTab === 'categories' && (
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-lg font-semibold text-gray-900">Категории товаров</h2>
                                    <button
                                        onClick={() => openCategoryForm()}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                        </svg>
                                        Добавить категорию
                                    </button>
                                </div>

                                {categories.length === 0 ? (
                                    <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
                                        <p className="text-gray-600 mb-4">Категорий пока нет</p>
                                        <button onClick={() => openCategoryForm()} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors">
                                            + Создать первую категорию
                                        </button>
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                                        <table className="w-full">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Категория</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Товаров</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Порядок</th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {categories.map((category) => (
                                                    <tr key={category.id} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div className="font-medium text-gray-900">{category.name}</div>
                                                            {category.description && <div className="text-sm text-gray-500 mt-0.5">{category.description}</div>}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-600">{category._count?.products || 0}</td>
                                                        <td className="px-6 py-4 text-sm text-gray-500">{category.order}</td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex gap-3 justify-end">
                                                                <button onClick={() => openCategoryForm(category)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Изменить</button>
                                                                <button onClick={() => handleDeleteCategory(category.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Удалить</button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ===== INVENTORY TAB ===== */}
                        {activeTab === 'inventory' && (
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 mb-6">Управление остатками</h2>

                                {products.filter(p => p.trackInventory).length === 0 ? (
                                    <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
                                        <p className="text-gray-600">Нет товаров с отслеживанием остатков</p>
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                                        <table className="w-full">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Товар</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Остаток</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {products.filter(p => p.trackInventory).map((product) => (
                                                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                {product.images?.[0] ? (
                                                                    <img src={product.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover" />
                                                                ) : (
                                                                    <div className="w-10 h-10 bg-gray-100 rounded-lg" />
                                                                )}
                                                                <span className="font-medium text-gray-900">{product.name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-500">{product.sku || '—'}</td>
                                                        <td className="px-6 py-4">
                                                            {editingStock?.id === product.id ? (
                                                                <input
                                                                    type="number"
                                                                    value={stockValue}
                                                                    onChange={(e) => setStockValue(e.target.value)}
                                                                    className="w-24 px-2 py-1 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                    autoFocus
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') handleUpdateStock();
                                                                        if (e.key === 'Escape') setEditingStock(null);
                                                                    }}
                                                                />
                                                            ) : (
                                                                <span className="font-semibold text-gray-900">{product.stockQuantity}</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${product.stockQuantity > 10 ? 'bg-green-100 text-green-700'
                                                                    : product.stockQuantity > 0 ? 'bg-yellow-100 text-yellow-700'
                                                                        : 'bg-red-100 text-red-700'
                                                                }`}>
                                                                {product.stockQuantity > 10 ? 'В наличии' : product.stockQuantity > 0 ? 'Мало' : 'Нет на складе'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            {editingStock?.id === product.id ? (
                                                                <div className="flex gap-2 justify-end">
                                                                    <button onClick={handleUpdateStock} className="text-green-600 hover:text-green-800 text-sm font-medium">Сохранить</button>
                                                                    <button onClick={() => setEditingStock(null)} className="text-gray-500 hover:text-gray-700 text-sm font-medium">Отмена</button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => { setEditingStock(product); setStockValue(product.stockQuantity); }}
                                                                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                                                >
                                                                    Изменить
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ===== PRODUCT FORM MODAL ===== */}
            {showProductForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl w-full max-w-lg my-8 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-gray-900">
                                {editingProduct ? 'Редактировать товар' : 'Новый товар'}
                            </h2>
                            <button
                                onClick={() => { setShowProductForm(false); setEditingProduct(null); }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <ProductForm
                            product={editingProduct}
                            categories={categories}
                            restaurantId={selectedRestaurantId}
                            onSave={handleProductSaved}
                            onCancel={() => { setShowProductForm(false); setEditingProduct(null); }}
                        />
                    </div>
                </div>
            )}

            {/* ===== CATEGORY FORM MODAL ===== */}
            {showCategoryForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-md p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-6">
                            {editingCategory ? 'Редактировать категорию' : 'Новая категория'}
                        </h2>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
                                <input
                                    type="text"
                                    value={categoryForm.name}
                                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                                    placeholder="Название категории"
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
                                <textarea
                                    value={categoryForm.description}
                                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                                    rows={2}
                                    placeholder="Описание категории"
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                />
                            </div>
                            <div className="w-32">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Порядок</label>
                                <input
                                    type="number"
                                    value={categoryForm.order}
                                    onChange={(e) => setCategoryForm({ ...categoryForm, order: parseInt(e.target.value) || 0 })}
                                    min="0"
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowCategoryForm(false); setEditingCategory(null); }}
                                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleSaveCategory}
                                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                            >
                                {editingCategory ? 'Сохранить' : 'Создать'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
};

export default StoreManagementPage;
