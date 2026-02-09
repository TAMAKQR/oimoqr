import { useState, useEffect, useRef } from 'react';

const ImageWithLoader = ({
    src,
    alt,
    className = '',
    loading = 'lazy',
    decoding = 'async',
    fallbackSrc,
    maxRetries = 2,
    retryDelay = 400,
    onError,
    ...props
}) => {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [usingFallback, setUsingFallback] = useState(false);
    const [inView, setInView] = useState(false);
    const imgRef = useRef(null);
    const retryTimer = useRef(null);

    useEffect(() => () => {
        if (retryTimer.current) {
            clearTimeout(retryTimer.current);
        }
    }, []);

    // Intersection Observer для более умной ленивой загрузки
    useEffect(() => {
        if (!imgRef.current || loading !== 'lazy') {
            setInView(true);
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setInView(true);
                        observer.disconnect();
                    }
                });
            },
            {
                rootMargin: '200px', // Загружаем заранее
            }
        );

        observer.observe(imgRef.current);

        // страховка: если observer не сработает, грузим через 1с
        const fallbackTimer = setTimeout(() => setInView(true), 1000);

        return () => {
            clearTimeout(fallbackTimer);
            observer.disconnect();
        };
    }, [loading]);

    const handleLoad = () => {
        setImageLoaded(true);
    };

    const handleError = () => {
        if (retryCount < maxRetries) {
            retryTimer.current = setTimeout(() => {
                setRetryCount((c) => c + 1);
                setImageError(false);
                setImageLoaded(false);
                setInView(true);
            }, retryDelay);
            return;
        }

        if (!usingFallback && fallbackSrc) {
            setUsingFallback(true);
            setRetryCount(0);
            setImageError(false);
            setImageLoaded(false);
            setInView(true);
            return;
        }

        setImageError(true);
        setImageLoaded(true);
        onError?.();
    };

    const effectiveSrc = usingFallback ? fallbackSrc : `${src}${retryCount > 0 ? `?rb=${retryCount}` : ''}`;

    return (
        <div ref={imgRef} className="relative w-full h-full">
            {/* Skeleton loader - показывается пока изображение загружается */}
            {!imageLoaded && (
                <div className={`absolute inset-0 ${className} bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-pulse`}>
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <svg className="w-12 h-12 opacity-50" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                        </svg>
                    </div>
                </div>
            )}

            {/* Изображение с ошибкой */}
            {imageError ? (
                <div className={`w-full h-full ${className} bg-gray-100 flex flex-col items-center justify-center text-gray-400`}>
                    <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs">Фото не загрузилось</span>
                </div>
            ) : (
                (inView || loading === 'eager') && (
                    <img
                        src={effectiveSrc}
                        alt={alt}
                        className={`${className} ${!imageLoaded ? 'opacity-0' : 'opacity-100'} transition-opacity duration-500`}
                        loading={loading}
                        decoding={decoding}
                        fetchpriority={loading === 'eager' ? 'high' : 'auto'}
                        onLoad={handleLoad}
                        onError={handleError}
                        {...props}
                    />
                )
            )}
        </div>
    );
};

export default ImageWithLoader;
