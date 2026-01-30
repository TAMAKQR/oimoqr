import toast from 'react-hot-toast';

/**
 * Красивый диалог подтверждения с использованием react-hot-toast
 * @param {string} message - Сообщение для подтверждения
 * @param {Object} options - Дополнительные опции
 * @returns {Promise<boolean>} - Promise который разрешается в true если пользователь подтвердил
 */

// ✅ Защита от множественных вызовов
let isDialogOpen = false;

export const confirmDialog = (message, options = {}) => {
    // Если диалог уже открыт, игнорируем повторный вызов
    if (isDialogOpen) {
        return new Promise((resolve) => resolve(false));
    }

    isDialogOpen = true;

    return new Promise((resolve) => {
        const {
            confirmText = 'Подтвердить',
            cancelText = 'Отмена',
            duration = 8000,
            icon = '⚠️'
        } = options;

        const handleResolve = (value) => {
            toast.dismiss(toastId);
            isDialogOpen = false;
            resolve(value);
        };

        const toastId = toast.custom(
            (t) => (
                <div
                    className={`${t.visible ? 'animate-enter' : 'animate-leave'
                        } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex flex-col ring-1 ring-black ring-opacity-5`}
                >
                    <div className="flex-1 p-4">
                        <div className="flex items-start">
                            <div className="flex-shrink-0 pt-0.5">
                                <span className="text-2xl">{icon}</span>
                            </div>
                            <div className="ml-3 flex-1">
                                <p className="text-sm font-medium text-gray-900 whitespace-pre-line">
                                    {message}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex border-t border-gray-200">
                        <button
                            onClick={() => handleResolve(false)}
                            className="w-full border-r border-gray-200 rounded-none rounded-bl-lg px-4 py-3 flex items-center justify-center text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={() => handleResolve(true)}
                            className="w-full rounded-none rounded-br-lg px-4 py-3 flex items-center justify-center text-sm font-medium text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            ),
            {
                duration,
                position: 'top-center',
            }
        );
    });
};
