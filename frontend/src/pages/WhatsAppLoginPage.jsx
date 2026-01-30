import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const WhatsAppLoginPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const restaurantId = searchParams.get('restaurantId');

    const [step, setStep] = useState(1); // 1 = номер телефона, 2 = код
    const [phoneNumber, setPhoneNumber] = useState('');
    const [code, setCode] = useState(['', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [retryAfter, setRetryAfter] = useState(0);

    // Обратный отсчет для повторной отправки
    useState(() => {
        if (retryAfter > 0) {
            const interval = setInterval(() => {
                setRetryAfter(prev => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [retryAfter]);

    // Отправка кода верификации
    const handleSendCode = async (e) => {
        e.preventDefault();

        if (!phoneNumber.trim()) {
            toast.error('Введите номер телефона');
            return;
        }

        setLoading(true);

        try {
            const response = await axios.post(`${API_URL}/api/customers/whatsapp/send-code`, {
                phoneNumber
            });

            toast.success('Код отправлен в WhatsApp!');
            setStep(2);
            setRetryAfter(60);
        } catch (error) {
            console.error('Failed to send code:', error);

            if (error.response?.status === 429) {
                const retry = error.response.data.retryAfter || 60;
                setRetryAfter(retry);
                toast.error(`Подождите ${retry} секунд перед повторной отправкой`);
            } else {
                toast.error(error.response?.data?.error || 'Ошибка отправки кода');
            }
        } finally {
            setLoading(false);
        }
    };

    // Верификация кода
    const handleVerifyCode = async (e) => {
        e.preventDefault();

        const fullCode = code.join('');
        if (fullCode.length !== 4) {
            toast.error('Введите 4-значный код');
            return;
        }

        setLoading(true);

        try {
            const response = await axios.post(`${API_URL}/api/customers/whatsapp/verify-code`, {
                phoneNumber,
                code: fullCode,
                restaurantId
            });

            toast.success('Успешный вход!');

            // Сохраняем токен
            localStorage.setItem('customerToken', response.data.token);
            localStorage.setItem('customerData', JSON.stringify(response.data.customer));

            // Редирект в меню или профиль
            if (restaurantId) {
                navigate(`/menu/${restaurantId}`);
            } else {
                navigate('/profile');
            }
        } catch (error) {
            console.error('Failed to verify code:', error);

            if (error.response?.data?.attemptsLeft !== undefined) {
                toast.error(`Неверный код. Осталось попыток: ${error.response.data.attemptsLeft}`);
            } else {
                toast.error(error.response?.data?.error || 'Ошибка верификации кода');
            }

            // Очищаем код при ошибке
            setCode(['', '', '', '']);
            document.getElementById('code-0')?.focus();
        } finally {
            setLoading(false);
        }
    };

    // Обработка ввода кода
    const handleCodeChange = (index, value) => {
        if (!/^\d*$/.test(value)) return; // Только цифры

        const newCode = [...code];
        newCode[index] = value.slice(-1); // Берем последнюю цифру
        setCode(newCode);

        // Автопереход к следующему полю
        if (value && index < 3) {
            document.getElementById(`code-${index + 1}`)?.focus();
        }

        // Автоотправка при заполнении всех полей
        if (index === 3 && value) {
            const fullCode = newCode.join('');
            if (fullCode.length === 4) {
                handleVerifyCode(new Event('submit'));
            }
        }
    };

    // Обработка удаления
    const handleCodeKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            document.getElementById(`code-${index - 1}`)?.focus();
        }
    };

    // Форматирование номера телефона для отображения
    const formatPhoneDisplay = (phone) => {
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.startsWith('7') || cleaned.startsWith('8')) {
            return `+7 ${cleaned.slice(1, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 9)} ${cleaned.slice(9)}`;
        }
        return phone;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
                {/* Логотип */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Вход через WhatsApp</h1>
                    <p className="text-gray-600 mt-2">Быстро и безопасно</p>
                </div>

                {step === 1 ? (
                    /* Шаг 1: Номер телефона */
                    <form onSubmit={handleSendCode} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Номер телефона
                            </label>
                            <input
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                placeholder="+7 (___) ___-__-__"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                disabled={loading}
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                На этот номер придет код подтверждения в WhatsApp
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !phoneNumber.trim()}
                            className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold py-3 rounded-lg hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Отправка...
                                </span>
                            ) : (
                                'Получить код'
                            )}
                        </button>
                    </form>
                ) : (
                    /* Шаг 2: Ввод кода */
                    <form onSubmit={handleVerifyCode} className="space-y-6">
                        <div>
                            <div className="text-center mb-4">
                                <p className="text-sm text-gray-600">
                                    Код отправлен на номер
                                </p>
                                <p className="text-lg font-semibold text-gray-900">
                                    {formatPhoneDisplay(phoneNumber)}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStep(1);
                                        setCode(['', '', '', '']);
                                    }}
                                    className="text-sm text-green-600 hover:text-green-700 mt-1"
                                >
                                    Изменить номер
                                </button>
                            </div>

                            <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
                                Введите 4-значный код
                            </label>

                            <div className="flex justify-center gap-3">
                                {code.map((digit, index) => (
                                    <input
                                        key={index}
                                        id={`code-${index}`}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleCodeChange(index, e.target.value)}
                                        onKeyDown={(e) => handleCodeKeyDown(index, e)}
                                        className="w-14 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                        disabled={loading}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="text-center">
                            {retryAfter > 0 ? (
                                <p className="text-sm text-gray-500">
                                    Повторная отправка через {retryAfter} сек
                                </p>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleSendCode}
                                    className="text-sm text-green-600 hover:text-green-700"
                                    disabled={loading}
                                >
                                    Отправить код повторно
                                </button>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading || code.join('').length !== 4}
                            className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold py-3 rounded-lg hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Проверка...
                                </span>
                            ) : (
                                'Войти'
                            )}
                        </button>
                    </form>
                )}

                {/* Преимущества */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                    <div className="space-y-3 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            <span>Без паролей</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            <span>Быстрый вход</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            <span>Безопасно</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WhatsAppLoginPage;
