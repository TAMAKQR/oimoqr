import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { restaurantService } from '../services/restaurantService';
import api from '../services/api';

const parseArrayField = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return value ? [value] : [];
        }
    }
    return [];
};

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
};

const formatMoney = (amount, currency) => {
    const value = Number(amount) || 0;
    return `${new Intl.NumberFormat('ru-RU').format(value)} ${currencySymbols[currency] || currency || '₽'}`;
};

const getAvailableStock = (product) => {
    if (!product.trackInventory) return Infinity;
    return Number(product.stockQuantity) || 0;
};

const ShopPage = () => {
    const { subdomain } = useParams();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [restaurant, setRestaurant] = useState(null);
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [activeCategoryId, setActiveCategoryId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [cart, setCart] = useState([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [deliveryType, setDeliveryType] = useState('delivery');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [comment, setComment] = useState('');

    useEffect(() => {
        const fetchShopData = async () => {
            try {
                setLoading(true);
                setError('');

                const restaurantData = await restaurantService.getBySubdomain(subdomain, undefined, { forceRefresh: true });
                setRestaurant(restaurantData);

                if (restaurantData.businessType !== 'ONLINE_STORE') {
                    setError('Этот проект не является магазином.');
                    return;
                }

                const [categoriesResponse, productsResponse] = await Promise.all([
                    api.get(`/products/categories/${restaurantData.id}`),
                    api.get(`/products/restaurant/${restaurantData.id}`)
                ]);

                const activeCategories = (categoriesResponse.data || []).filter((category) => category.isActive !== false);
                const publicProducts = (productsResponse.data || [])
                    .filter((product) => product.available !== false)
                    .map((product) => ({
                        ...product,
                        images: parseArrayField(product.images)
                    }));

                setCategories(activeCategories);
                setProducts(publicProducts);
            } catch (err) {
                setError(err.response?.data?.error || 'Не удалось загрузить данные магазина.');
            } finally {
                setLoading(false);
            }
        };

        fetchShopData();
    }, [subdomain]);

    const filteredProducts = useMemo(() => {
        if (!activeCategoryId) return products;
        return products.filter((product) => product.categoryId === activeCategoryId);
    }, [activeCategoryId, products]);

    const featuredProducts = useMemo(() => products.filter((product) => product.featured), [products]);

    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartTotal = cart.reduce((sum, item) => sum + (Number(item.price) || 0) * item.quantity, 0);
    const banners = parseArrayField(restaurant?.banners);

    const getCartQuantity = (productId) => {
        return cart.find((item) => item.id === productId)?.quantity || 0;
    };

    const setProductQuantity = (product, nextQuantity) => {
        const quantity = Math.max(0, Number(nextQuantity) || 0);
        const maxStock = getAvailableStock(product);

        if (quantity > maxStock) {
            toast.error('Недостаточно товара на складе');
            return;
        }

        setCart((prevCart) => {
            if (quantity === 0) {
                return prevCart.filter((item) => item.id !== product.id);
            }

            const existingItem = prevCart.find((item) => item.id === product.id);
            if (existingItem) {
                return prevCart.map((item) => item.id === product.id ? { ...item, quantity } : item);
            }

            return [...prevCart, { ...product, quantity }];
        });
    };

    const handleSubmitOrder = async () => {
        if (cart.length === 0) {
            toast.error('Корзина пуста');
            return;
        }

        if (!customerName.trim() || !customerPhone.trim()) {
            toast.error('Укажите имя и телефон');
            return;
        }

        if (deliveryType === 'delivery' && !customerAddress.trim()) {
            toast.error('Укажите адрес доставки');
            return;
        }

        try {
            setSubmitting(true);
            const response = await api.post('/orders', {
                restaurantId: restaurant.id,
                items: cart.map((item) => ({
                    id: item.id,
                    quantity: item.quantity
                })),
                total: Number(cartTotal.toFixed(2)),
                customerName: customerName.trim(),
                customerPhone: customerPhone.trim(),
                deliveryAddress: deliveryType === 'delivery' ? customerAddress.trim() : null,
                deliveryType,
                paymentMethod: 'cash',
                comment: comment.trim() || null
            });

            const orderData = response?.data?.order || response?.data;
            const successPayload = {
                order: orderData,
                restaurant,
                currency: currencySymbols[restaurant.currency] || restaurant.currency || '₽'
            };

            sessionStorage.setItem('last-order-success', JSON.stringify(successPayload));
            setCart([]);
            setIsCartOpen(false);
            navigate('/order-success', { replace: true, state: successPayload });
        } catch (err) {
            toast.error(err.response?.data?.error || err.response?.data?.details || 'Не удалось оформить заказ');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="mt-4 text-gray-600">{t('common.loading')}</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6 max-w-md text-center">
                    <h2 className="text-xl font-bold text-red-600 mb-3">{t('common.error')}</h2>
                    <p className="text-gray-600">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-28">
            <header className="bg-white border-b border-gray-100">
                {banners[0] && (
                    <div className="h-44 sm:h-64 w-full bg-gray-100">
                        <img src={banners[0]} alt="" className="w-full h-full object-cover" />
                    </div>
                )}

                <div className="max-w-6xl mx-auto px-4 py-5">
                    <div className="flex items-center gap-4">
                        {restaurant.logo ? (
                            <img src={restaurant.logo} alt={restaurant.name} className="w-16 h-16 rounded-lg object-cover border border-gray-100" />
                        ) : (
                            <div className="w-16 h-16 rounded-lg bg-primary-50 text-primary-700 flex items-center justify-center font-bold text-xl">
                                {restaurant.name?.slice(0, 1) || 'S'}
                            </div>
                        )}
                        <div className="min-w-0">
                            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">{restaurant.name}</h1>
                            {restaurant.description && (
                                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{restaurant.description}</p>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-6">
                {featuredProducts.length > 0 && (
                    <section className="mb-7">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">Рекомендуем</h2>
                        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                            {featuredProducts.map((product) => (
                                <button
                                    key={product.id}
                                    type="button"
                                    onClick={() => setProductQuantity(product, getCartQuantity(product.id) + 1)}
                                    className="flex-shrink-0 w-64 text-left bg-white border border-gray-100 rounded-lg p-3 hover:shadow-sm transition-shadow disabled:opacity-60"
                                    disabled={getAvailableStock(product) <= 0}
                                >
                                    <div className="flex gap-3">
                                        <img
                                            src={product.images?.[0] || '/icons/icon-192x192.png'}
                                            alt={product.name}
                                            className="w-20 h-20 rounded-lg object-cover bg-gray-100"
                                        />
                                        <div className="min-w-0">
                                            <p className="font-semibold text-gray-900 line-clamp-2">{product.name}</p>
                                            <p className="text-sm font-bold text-primary-700 mt-1">{formatMoney(product.price, restaurant.currency)}</p>
                                            {product.compareAtPrice && Number(product.compareAtPrice) > Number(product.price) && (
                                                <p className="text-xs text-gray-400 line-through">{formatMoney(product.compareAtPrice, restaurant.currency)}</p>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                <div className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-gray-50/95 backdrop-blur border-b border-gray-100 mb-5">
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                        <button
                            type="button"
                            onClick={() => setActiveCategoryId(null)}
                            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${!activeCategoryId ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}
                        >
                            Все товары
                        </button>
                        {categories.map((category) => (
                            <button
                                key={category.id}
                                type="button"
                                onClick={() => setActiveCategoryId(category.id)}
                                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeCategoryId === category.id ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}
                            >
                                {category.name}
                            </button>
                        ))}
                    </div>
                </div>

                {filteredProducts.length === 0 ? (
                    <div className="text-center py-16 bg-white border border-gray-100 rounded-lg">
                        <p className="text-gray-500">{t('shop.empty')}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                        {filteredProducts.map((product) => {
                            const quantity = getCartQuantity(product.id);
                            const stock = getAvailableStock(product);
                            const unavailable = stock <= 0;

                            return (
                                <article key={product.id} className="bg-white rounded-lg border border-gray-100 overflow-hidden hover:shadow-sm transition-shadow">
                                    <div className="relative aspect-square bg-gray-100">
                                        <img
                                            src={product.images?.[0] || '/icons/icon-192x192.png'}
                                            alt={product.name}
                                            className="w-full h-full object-cover"
                                        />
                                        {unavailable && (
                                            <span className="absolute top-2 left-2 bg-gray-900 text-white text-xs px-2 py-1 rounded-full">
                                                Нет в наличии
                                            </span>
                                        )}
                                        {product.trackInventory && stock > 0 && stock < 10 && (
                                            <span className="absolute bottom-2 left-2 bg-amber-500 text-white text-xs px-2 py-1 rounded-full">
                                                Осталось {stock}
                                            </span>
                                        )}
                                    </div>

                                    <div className="p-3 flex flex-col min-h-[170px]">
                                        <p className="font-semibold text-gray-900 text-sm line-clamp-2">{product.name}</p>
                                        {product.description && (
                                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{product.description}</p>
                                        )}
                                        <div className="mt-2">
                                            <p className="text-base font-bold text-gray-900">{formatMoney(product.price, restaurant.currency)}</p>
                                            {product.compareAtPrice && Number(product.compareAtPrice) > Number(product.price) && (
                                                <p className="text-xs text-gray-400 line-through">{formatMoney(product.compareAtPrice, restaurant.currency)}</p>
                                            )}
                                        </div>

                                        <div className="mt-auto pt-3">
                                            {quantity === 0 ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setProductQuantity(product, 1)}
                                                    disabled={unavailable}
                                                    className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {t('shop.addToCart')}
                                                </button>
                                            ) : (
                                                <div className="flex items-center justify-between bg-primary-50 rounded-lg p-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setProductQuantity(product, quantity - 1)}
                                                        className="w-9 h-9 rounded-lg bg-white text-primary-700 flex items-center justify-center"
                                                        aria-label="Уменьшить количество"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                                                        </svg>
                                                    </button>
                                                    <span className="font-semibold text-primary-700">{quantity}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setProductQuantity(product, quantity + 1)}
                                                        className="w-9 h-9 rounded-lg bg-primary-600 text-white flex items-center justify-center"
                                                        aria-label="Увеличить количество"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </main>

            {cart.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 z-40 p-4 pointer-events-none">
                    <div className="max-w-lg mx-auto pointer-events-auto">
                        <button
                            type="button"
                            onClick={() => setIsCartOpen(true)}
                            className="w-full bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-lg px-4 py-3 flex items-center justify-between transition-colors"
                        >
                            <span className="flex items-center gap-3">
                                <span className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437m0 0L6.75 14.25A2.25 2.25 0 008.96 16h7.58a2.25 2.25 0 002.21-1.81l.962-4.81A1.125 1.125 0 0018.61 8H5.106m0-2.728L4.5 3m3.75 16.5a.75.75 0 100-1.5.75.75 0 000 1.5zm8.25 0a.75.75 0 100-1.5.75.75 0 000 1.5z" />
                                    </svg>
                                </span>
                                <span className="text-left">
                                    <span className="block text-sm font-semibold">{cartCount} товаров</span>
                                    <span className="block text-xs text-white/80">Оформить заказ</span>
                                </span>
                            </span>
                            <span className="font-bold">{formatMoney(cartTotal, restaurant.currency)}</span>
                        </button>
                    </div>
                </div>
            )}

            {isCartOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
                    <div className="bg-white w-full sm:max-w-lg max-h-[92vh] rounded-t-lg sm:rounded-lg flex flex-col">
                        <div className="flex justify-between items-center p-5 border-b border-gray-100">
                            <h2 className="text-xl font-bold text-gray-900">{t('shop.viewCart')}</h2>
                            <button onClick={() => setIsCartOpen(false)} className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center" aria-label="Закрыть">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="overflow-y-auto p-5 space-y-5">
                            <div className="space-y-3">
                                {cart.map((item) => (
                                    <div key={item.id} className="flex gap-3">
                                        <img src={item.images?.[0] || '/icons/icon-192x192.png'} alt="" className="w-14 h-14 rounded-lg object-cover bg-gray-100" />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-gray-900 text-sm line-clamp-2">{item.name}</p>
                                            <p className="text-sm text-gray-500">{formatMoney(item.price, restaurant.currency)}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setProductQuantity(item, item.quantity - 1)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center">-</button>
                                            <span className="w-5 text-center text-sm font-semibold">{item.quantity}</span>
                                            <button onClick={() => setProductQuantity(item, item.quantity + 1)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center">+</button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1">
                                <button
                                    type="button"
                                    onClick={() => setDeliveryType('delivery')}
                                    className={`py-2 rounded-md text-sm font-medium ${deliveryType === 'delivery' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}
                                >
                                    Доставка
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDeliveryType('pickup')}
                                    className={`py-2 rounded-md text-sm font-medium ${deliveryType === 'pickup' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}
                                >
                                    Самовывоз
                                </button>
                            </div>

                            <div className="space-y-3">
                                <input type="text" placeholder="Ваше имя *" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="input-field" />
                                <input type="tel" placeholder="Ваш телефон *" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="input-field" />
                                {deliveryType === 'delivery' && (
                                    <input type="text" placeholder="Адрес доставки *" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} className="input-field" />
                                )}
                                <textarea placeholder="Комментарий к заказу" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className="input-field resize-none" />
                            </div>
                        </div>

                        <div className="p-5 border-t border-gray-100">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-gray-600">Итого</span>
                                <span className="text-xl font-bold text-gray-900">{formatMoney(cartTotal, restaurant.currency)}</span>
                            </div>
                            <button
                                type="button"
                                onClick={handleSubmitOrder}
                                disabled={submitting}
                                className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? 'Оформляем...' : 'Оформить заказ'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShopPage;
