import { useState } from 'react';

const ProductCard = ({ product, onAddToCart }) => {
    const [quantity, setQuantity] = useState(0);

    const handleAdd = () => {
        setQuantity(prev => prev + 1);
        onAddToCart?.(product, quantity + 1);
    };

    const handleRemove = () => {
        if (quantity > 0) {
            setQuantity(prev => prev - 1);
            onAddToCart?.(product, quantity - 1);
        }
    };

    const formatPrice = (price) => {
        return new Intl.NumberFormat('ru-RU').format(price);
    };

    const discountPercent = product.compareAtPrice
        ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
        : 0;

    return (
        <div className="bg-white rounded-grab shadow-grab overflow-hidden hover:shadow-grab-lg transition-shadow">
            {/* Image */}
            <div className="relative aspect-square bg-gray-100">
                {product.images?.[0] ? (
                    <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                )}

                {/* Badges */}
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {!product.available && (
                        <span className="bg-gray-800 text-white text-xs px-2 py-1 rounded-full">
                            Нет в наличии
                        </span>
                    )}
                    {product.featured && (
                        <span className="bg-grabYellow text-white text-xs px-2 py-1 rounded-full">
                            ⭐ Хит
                        </span>
                    )}
                    {discountPercent > 0 && (
                        <span className="bg-grabRed text-white text-xs px-2 py-1 rounded-full font-bold">
                            -{discountPercent}%
                        </span>
                    )}
                </div>

                {/* Stock indicator */}
                {product.trackInventory && product.stockQuantity < 10 && product.stockQuantity > 0 && (
                    <div className="absolute bottom-2 left-2">
                        <span className="bg-grabOrange text-white text-xs px-2 py-1 rounded-full">
                            Осталось {product.stockQuantity}
                        </span>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-3">
                <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-2">
                    {product.name}
                </h3>

                {product.description && (
                    <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                        {product.description}
                    </p>
                )}

                {/* Price */}
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg font-bold text-grab-600">
                        {formatPrice(product.price)} ₽
                    </span>
                    {product.compareAtPrice && (
                        <span className="text-sm text-gray-400 line-through">
                            {formatPrice(product.compareAtPrice)} ₽
                        </span>
                    )}
                </div>

                {/* Add to cart */}
                {product.available && (
                    <div className="flex items-center justify-between">
                        {quantity === 0 ? (
                            <button
                                onClick={handleAdd}
                                className="w-full bg-grab-500 hover:bg-grab-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                            >
                                Добавить
                            </button>
                        ) : (
                            <div className="w-full flex items-center justify-between bg-grab-50 rounded-lg p-1">
                                <button
                                    onClick={handleRemove}
                                    className="w-8 h-8 flex items-center justify-center bg-white rounded-lg text-grab-600 hover:bg-grab-100 transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                    </svg>
                                </button>
                                <span className="font-semibold text-grab-600">{quantity}</span>
                                <button
                                    onClick={handleAdd}
                                    className="w-8 h-8 flex items-center justify-center bg-grab-500 rounded-lg text-white hover:bg-grab-600 transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductCard;
