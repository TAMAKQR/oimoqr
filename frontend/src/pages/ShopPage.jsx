import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { restaurantService } from '../services/restaurantService';
import api from '../services/api';
// import ProductCard from '../components/products/ProductCard'; // Мы создадим этот компонент позже
import { useTranslation } from 'react-i18next';

const ShopPage = () => {
    const { subdomain } = useParams();
    const { t } = useTranslation();
    const [restaurant, setRestaurant] = useState(null);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

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
                            // Заглушка для карточки товара
                            <div key={product.id} className="border rounded-lg p-4 bg-white">
                                {product.imageUrl && <img src={product.imageUrl} alt={product.name} className="w-full h-40 object-cover rounded-md mb-4" />}
                                <h3 className="font-semibold">{product.name}</h3>
                                <p className="text-gray-600">{product.price} {restaurant.currency}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16">
                        <p className="text-gray-500">{t('shop.empty')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShopPage;