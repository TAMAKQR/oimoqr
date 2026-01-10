import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import CategoryScroll from '../components/shop/CategoryScroll';
import ProductGrid from '../components/shop/ProductGrid';
import FloatingCart from '../components/shop/FloatingCart';
import api from '../services/api';

const ShopPage = () => {
    const { subdomain } = useParams();
    const [restaurant, setRestaurant] = useState(null);
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [activeCategory, setActiveCategory] = useState(null);
    const [cart, setCart] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadShopData();
    }, [subdomain]);

    useEffect(() => {
        filterProducts();
    }, [activeCategory, products, searchQuery]);

    const loadShopData = async () => {
        try {
            setLoading(true);

            // Load restaurant info
            const restaurantRes = await api.get(`/restaurants/subdomain/${subdomain}`);
            setRestaurant(restaurantRes.data);

            // Load categories
            const categoriesRes = await api.get(`/products/categories/${restaurantRes.data.id}`);
            setCategories(categoriesRes.data);

            // Load all products
            const productsRes = await api.get(`/products/restaurant/${restaurantRes.data.id}`);
            setProducts(productsRes.data);
            setFilteredProducts(productsRes.data);
        } catch (error) {
            console.error('Error loading shop:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterProducts = () => {
        let filtered = products;

        // Filter by category
        if (activeCategory) {
            filtered = filtered.filter(p => p.categoryId === activeCategory);
        }

        // Filter by search
        if (searchQuery) {
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.description?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        setFilteredProducts(filtered);
    };

    const handleAddToCart = (product, quantity) => {
        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);

            if (quantity === 0) {
                return prev.filter(item => item.product.id !== product.id);
            }

            if (existing) {
                return prev.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity }
                        : item
                );
            }

            return [...prev, { product, quantity }];
        });
    };

    const calculateTotal = () => {
        return cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    };

    const handleCheckout = () => {
        // TODO: Navigate to checkout page
        console.log('Checkout:', cart);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-grab-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Загрузка магазина...</p>
                </div>
            </div>
        );
    }

    if (!restaurant) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-600 text-lg">Магазин не найден</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-32">
            {/* Header */}
            <div className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    {/* Logo and name */}
                    <div className="flex items-center gap-3 mb-4">
                        {restaurant.logo && (
                            <img
                                src={restaurant.logo}
                                alt={restaurant.name}
                                className="w-16 h-16 rounded-grab object-cover"
                            />
                        )}
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold text-gray-900">{restaurant.name}</h1>
                            {restaurant.description && (
                                <p className="text-sm text-gray-600 mt-1">{restaurant.description}</p>
                            )}
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Поиск товаров..."
                            className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-grab focus:outline-none focus:ring-2 focus:ring-grab-500 focus:bg-white transition-all"
                        />
                        <svg
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Categories */}
            <CategoryScroll
                categories={categories}
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
            />

            {/* Products */}
            <ProductGrid
                products={filteredProducts}
                onAddToCart={handleAddToCart}
                loading={false}
            />

            {/* Floating Cart */}
            <FloatingCart
                items={cart}
                total={calculateTotal()}
                onCheckout={handleCheckout}
            />
        </div>
    );
};

export default ShopPage;
