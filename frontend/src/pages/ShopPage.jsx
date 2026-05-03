import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { restaurantService } from '../services/restaurantService';
import api from '../services/api';
// import ProductCard from '../components/products/ProductCard'; // Мы создадим этот компонент позже
import { useTranslation } from 'react-i18next';

// Вспомогательная функция для генерации номера заказа.
// Была ошибочно импортирована, теперь определена здесь.
const generateOrderNumber = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const ShopPage = () => {
    const { subdomain } = useParams();
    const { t } = useTranslation();
    const [restaurant, setRestaurant] = useState(null);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [cart, setCart] = useState([]);
    const [isCartOpen, setIsCartOpen] = useState(false);

    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');

    useEffect(() => {
        const fetchShopData = async () => {
            try {
                setLoading(true);
                const restaurantData = await restaurantService.getBySubdomain(subdomain);
                setRestaurant(restaurantData);

                if (restaurantData.businessType !== 'ONLINE_STORE') {
                    setError('Этот проект не является магазином.');
                    return;
                }

                const productsResponse = await api.get(`/products/restaurant/${restaurantData.id}`);
                const productsData = productsResponse.data;
                setProducts(productsData);
            } catch (err) {
                setError(err.response?.data?.error || 'Не удалось загрузить данные магазина.');
            } finally {
                setLoading(false);
            }
        };

        fetchShopData();
    }, [subdomain]);

    const addToCart = (product) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === product.id);
            if (existingItem) {
                return prevCart.map(item =>
                    item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [...prevCart, { ...product, quantity: 1 }];
        });
    };

    const updateQuantity = (productId, amount) => {
        setCart(prevCart => {
            return prevCart.map(item => {
                if (item.id === productId) {
                    const newQuantity = item.quantity + amount;
                    return newQuantity > 0 ? { ...item, quantity: newQuantity } : null;
                }
                return item;
            }).filter(Boolean); // Удаляем null (товары с количеством 0)
        });
    };

    const handleOrder = () => {
        if (!customerName || !customerPhone || !customerAddress) {
            alert('Пожалуйста, заполните все поля для доставки.');
            return;
        }

        const orderNumber = generateOrderNumber();
        const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const orderText = cart.map(item => `- ${item.name} (x${item.quantity})`).join('\n');

        let message = `🛍️ Новый заказ из магазина "${restaurant.name}" (№${orderNumber})\n\n👤 Имя: ${customerName}\n📱 Телефон: ${customerPhone}\n📍 Адрес: ${customerAddress}\n\nСостав заказа:\n${orderText}\n\nИтого: ${total} ${restaurant.currency}`;

        const whatsappUrl = `https://wa.me/${restaurant.phone}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-4 text-gray-600">{t('common.loading')}</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="card max-w-md text-center">
                    <h2 className="text-2xl font-bold text-red-600 mb-4">{t('common.error')}</h2>
                    <p className="text-gray-600">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Баннер */}
            {restaurant.banners && restaurant.banners.length > 0 && (
                <div className="w-full h-48 md:h-64 bg-cover bg-center" style={{ backgroundImage: `url(${restaurant.banners[0]})` }}>
                </div>
            )}

            {/* Шапка магазина */}
            <div className="bg-white shadow-sm">
                <div className="container mx-auto px-4 py-6">
                    <div className="flex items-center gap-4">
                        {restaurant.logo && (
                            <img src={restaurant.logo} alt={`${restaurant.name} logo`} className="w-16 h-16 object-contain rounded-md" />
                        )}
                        <div>
                            <h1 className="text-3xl font-bold">{restaurant.name}</h1>
                            {restaurant.description && <p className="text-gray-600 mt-1">{restaurant.description}</p>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Каталог товаров */}
            <div className="container mx-auto px-4 py-8">
                <h2 className="text-2xl font-bold mb-6">{t('shop.title')}</h2>
                {products.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {products.map((product) => (
                            <div key={product.id} className="card bg-white rounded-lg shadow-md overflow-hidden flex flex-col">
                                <img src={product.images?.[0] || 'https://via.placeholder.com/300'} alt={product.name} className="w-full h-48 object-cover" />
                                <div className="p-4 flex flex-col flex-grow">
                                    <h3 className="font-bold text-lg mb-2">{product.name}</h3>
                                    <p className="text-gray-700 font-semibold text-xl mb-4">{product.price} {restaurant.currency}</p>
                                    <div className="mt-auto">
                                        <button onClick={() => addToCart(product)} className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 transition-colors">
                                            {t('shop.addToCart')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16">
                        <p className="text-gray-500">{t('shop.empty')}</p>
                    </div>
                )}
            </div>

            {/* Кнопка корзины */}
            {cart.length > 0 && (
                <button
                    onClick={() => setIsCartOpen(true)}
                    className="fixed bottom-6 right-6 bg-primary-600 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg text-2xl"
                >
                    🛍️
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-2 py-1">
                        {cart.reduce((sum, item) => sum + item.quantity, 0)}
                    </span>
                </button>
            )}

            {/* Модальное окно корзины */}
            {isCartOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold">{t('shop.viewCart')}</h2>
                            <button onClick={() => setIsCartOpen(false)} className="text-2xl">&times;</button>
                        </div>
                        <div className="space-y-3 my-4">
                            <input type="text" placeholder="Ваше имя *" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="input w-full" />
                            <input type="tel" placeholder="Ваш телефон *" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="input w-full" />
                            <input type="text" placeholder="Адрес доставки *" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} className="input w-full" />
                        </div>
                        <div className="overflow-y-auto flex-grow space-y-2 pr-2">
                            {cart.map(item => (
                                <div key={item.id} className="flex items-center justify-between border-b pb-2">
                                    <div>
                                        <p className="font-semibold">{item.name}</p>
                                        <p className="text-sm text-gray-600">{item.price} {restaurant.currency}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => updateQuantity(item.id, -1)} className="btn-secondary btn-sm">-</button>
                                        <span>{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.id, 1)} className="btn-secondary btn-sm">+</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="text-right font-bold text-xl mt-4 pt-4 border-t">
                            Итого: {cart.reduce((sum, item) => sum + item.price * item.quantity, 0)} {restaurant.currency}
                        </div>
                        <div className="flex justify-end gap-4 mt-6">
                            <button onClick={() => setIsCartOpen(false)} className="btn-secondary">
                                {t('common.cancel')}
                            </button>
                            <button onClick={handleOrder} className="btn-primary">
                                Оформить заказ
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShopPage;