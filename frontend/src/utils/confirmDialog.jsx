import toast from 'react-hot-toast';

/**
 * Красивый диалог подтверждения с использованием react-hot-toast
 * @param {string} message - Сообщение для подтверждения
 * @param {Object} options - Дополнительные опции
 * @returns {Promise<boolean>} - Promise который разрешается в true если пользователь подтвердил
 */
export const confirmDialog = (message, options = {}) => {
    return new Promise((resolve) => {
        const {
            confirmText = 'Подтвердить',
            cancelText = 'Отмена',
            duration = 8000,
            icon = '⚠️'
        } = options;

        toast.custom(
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
                            onClick={() => {
                                toast.dismiss(t.id);
                                resolve(false);
                            }}
                            className="w-full border-r border-gray-200 rounded-none rounded-bl-lg px-4 py-3 flex items-center justify-center text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={() => {
                                toast.dismiss(t.id);
                                resolve(true);
                            }}
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
