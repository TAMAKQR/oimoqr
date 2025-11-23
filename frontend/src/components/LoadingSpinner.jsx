const LoadingSpinner = ({ message = 'Загрузка...', fullScreen = true }) => {
  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50">
        <div className="text-center">
          {/* Animated Logo */}
          <div className="mb-6 relative">
            <div className="w-24 h-24 mx-auto relative">
              {/* Outer spinning circle */}
              <div className="absolute inset-0 border-4 border-orange-200 rounded-full animate-spin" 
                   style={{ borderTopColor: '#f97316', animationDuration: '1s' }}></div>
              
              {/* Inner pulsing circle */}
              <div className="absolute inset-2 bg-gradient-to-br from-orange-400 to-red-500 rounded-full animate-pulse flex items-center justify-center">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            </div>
          </div>

          {/* Loading text with animation */}
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-gray-800 animate-pulse">
              Oimo QR
            </h3>
            <p className="text-gray-600 flex items-center justify-center gap-1">
              <span>{message}</span>
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
              </span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Inline spinner (для использования внутри компонентов)
  return (
    <div className="flex items-center justify-center p-8">
      <div className="relative">
        <div className="w-12 h-12 border-4 border-orange-200 rounded-full animate-spin" 
             style={{ borderTopColor: '#f97316' }}></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 bg-orange-500 rounded-full animate-pulse"></div>
        </div>
      </div>
      {message && <span className="ml-3 text-gray-600">{message}</span>}
    </div>
  );
};

export default LoadingSpinner;
