import { useRef } from 'react';

const CategoryScroll = ({ categories, activeCategory, onCategoryChange }) => {
    const scrollRef = useRef(null);

    const handleCategoryClick = (categoryId) => {
        onCategoryChange?.(categoryId);
    };

    return (
        <div className="bg-white shadow-sm sticky top-0 z-10">
            <div
                ref={scrollRef}
                className="flex overflow-x-auto gap-2 px-4 py-3 scrollbar-hide"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {/* All products */}
                <button
                    onClick={() => handleCategoryClick(null)}
                    className={`flex-shrink-0 px-4 py-2 rounded-full font-medium text-sm transition-all ${activeCategory === null
                            ? 'bg-grab-500 text-white shadow-grab'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    Все товары
                </button>

                {/* Categories */}
                {categories?.map((category) => (
                    <button
                        key={category.id}
                        onClick={() => handleCategoryClick(category.id)}
                        className={`flex-shrink-0 px-4 py-2 rounded-full font-medium text-sm transition-all ${activeCategory === category.id
                                ? 'bg-grab-500 text-white shadow-grab'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        {category.image && (
                            <span className="inline-block w-5 h-5 mr-1">
                                <img src={category.image} alt="" className="w-full h-full object-cover rounded-full" />
                            </span>
                        )}
                        {category.name}
                        {category._count?.products > 0 && (
                            <span className="ml-1 text-xs opacity-75">
                                ({category._count.products})
                            </span>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default CategoryScroll;
