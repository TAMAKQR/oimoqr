const MenuSkeleton = () => {
    return (
        <div className="min-h-screen bg-gray-50 animate-pulse">
            {/* Banner Skeleton */}
            <div className="bg-gray-300 h-48 sm:h-64 w-full"></div>

            {/* Restaurant Info Skeleton */}
            <div className="bg-white shadow-sm p-4">
                <div className="h-8 bg-gray-300 rounded w-3/4 mb-3"></div>
                <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>

            {/* Categories Skeleton */}
            <div className="sticky top-0 bg-white border-b border-gray-200 z-30 shadow-sm">
                <div className="overflow-x-auto scrollbar-hide">
                    <div className="flex gap-2 px-4 py-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="h-10 bg-gray-200 rounded-full w-24 flex-shrink-0"></div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Dishes Skeleton */}
            <div className="px-4 py-6 space-y-6">
                {/* Category 1 */}
                <div>
                    <div className="h-6 bg-gray-300 rounded w-40 mb-4"></div>
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-white rounded-lg shadow-sm p-4">
                                <div className="flex gap-3">
                                    {/* Image */}
                                    <div className="w-20 h-20 bg-gray-200 rounded-lg flex-shrink-0"></div>

                                    {/* Content */}
                                    <div className="flex-1 space-y-2">
                                        <div className="h-5 bg-gray-300 rounded w-3/4"></div>
                                        <div className="h-3 bg-gray-200 rounded w-full"></div>
                                        <div className="h-3 bg-gray-200 rounded w-5/6"></div>

                                        {/* Price and button */}
                                        <div className="flex justify-between items-center pt-2">
                                            <div className="h-6 bg-gray-300 rounded w-20"></div>
                                            <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Category 2 */}
                <div>
                    <div className="h-6 bg-gray-300 rounded w-40 mb-4"></div>
                    <div className="space-y-4">
                        {[1, 2].map((i) => (
                            <div key={i} className="bg-white rounded-lg shadow-sm p-4">
                                <div className="flex gap-3">
                                    <div className="w-20 h-20 bg-gray-200 rounded-lg flex-shrink-0"></div>
                                    <div className="flex-1 space-y-2">
                                        <div className="h-5 bg-gray-300 rounded w-3/4"></div>
                                        <div className="h-3 bg-gray-200 rounded w-full"></div>
                                        <div className="flex justify-between items-center pt-2">
                                            <div className="h-6 bg-gray-300 rounded w-20"></div>
                                            <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MenuSkeleton;
