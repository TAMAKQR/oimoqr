import React, { useState } from 'react';

const ErrorBoundary = ({ children }) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white shadow-md rounded-lg p-8 text-center">
          <h2 className="text-2xl font-semibold text-red-600 mb-4">
            Что-то пошло не так!
          </h2>
          <p className="text-gray-700 mb-4">
            Произошла непредвиденная ошибка. Пожалуйста, перезагрузите страницу.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
          >
            Перезагрузить
          </button>
        </div>
      </div>
    );
  }

  return (
    <>{children}</>
  );
};

export default ErrorBoundary;