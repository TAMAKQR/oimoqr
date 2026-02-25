import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useCustomerAuthStore } from '../store/customerAuthStore';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Список стран с кодами и флагами
const COUNTRIES = [
    { code: 'KG', dial: '+996', flag: '🇰🇬', name: 'Кыргызстан', placeholder: '555 123 456' },
    { code: 'KZ', dial: '+7', flag: '🇰🇿', name: 'Казахстан', placeholder: '700 123 4567' },
    { code: 'RU', dial: '+7', flag: '🇷🇺', name: 'Россия', placeholder: '912 345 6789' },
    { code: 'UZ', dial: '+998', flag: '🇺🇿', name: 'Узбекистан', placeholder: '90 123 4567' },
    { code: 'TJ', dial: '+992', flag: '🇹🇯', name: 'Таджикистан', placeholder: '90 123 4567' },
    { code: 'TR', dial: '+90', flag: '🇹🇷', name: 'Турция', placeholder: '532 123 4567' },
    { code: 'AE', dial: '+971', flag: '🇦🇪', name: 'ОАЭ', placeholder: '50 123 4567' },
    { code: 'US', dial: '+1', flag: '🇺🇸', name: 'США', placeholder: '202 555 1234' },
    { code: 'GB', dial: '+44', flag: '🇬🇧', name: 'Великобритания', placeholder: '7911 123456' },
    { code: 'DE', dial: '+49', flag: '🇩🇪', name: 'Германия', placeholder: '151 1234 5678' },
    { code: 'CN', dial: '+86', flag: '🇨🇳', name: 'Китай', placeholder: '131 2345 6789' },
    { code: 'VN', dial: '+84', flag: '🇻🇳', name: 'Вьетнам', placeholder: '91 234 5678' },
    { code: 'IN', dial: '+91', flag: '🇮🇳', name: 'Индия', placeholder: '91234 56789' },
];

const WhatsAppLoginPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const restaurantId = searchParams.get('restaurantId');
    const setAuth = useCustomerAuthStore((state) => state.setAuth);

    const [step, setStep] = useState(1); // 1 = номер телефона, 2 = код
    const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]); // по умолчанию KG
    const [phoneNumber, setPhoneNumber] = useState('');
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [retryAfter, setRetryAfter] = useState(0);

    // Автоопределение страны по IP при загрузке
    useEffect(() => {
        const detectCountry = async () => {
            try {
                // ip-api.com поддерживает CORS
                const res = await fetch('https://ip-api.com/json/?fields=countryCode', { signal: AbortSignal.timeout(3000) });
                const data = await res.json();
                if (data?.countryCode) {
                    const found = COUNTRIES.find(c => c.code === data.countryCode);
                    if (found) {
                        setSelectedCountry(found);
                    }
                }
            } catch {
                // Не критично — оставляем KG по умолчанию
            }
        };
        detectCountry();
    }, []);

    // Обратный отсчет для повторной отправки
    useEffect(() => {
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

        const fullPhone = selectedCountry.dial + phoneNumber.replace(/\D/g, '');

        setLoading(true);

        try {
            const response = await axios.post(`${API_URL}/customers/whatsapp/send-code`, {
                phoneNumber: fullPhone
            });

            toast.success('Код отправлен по SMS!');
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

    const verifyCode = async (fullCode) => {
        if (loading) return;
        if (!fullCode || fullCode.length !== 6) {
            toast.error('Введите 6-значный код');
            return;
        }

        setLoading(true);

        try {
            const fullPhone = selectedCountry.dial + phoneNumber.replace(/\D/g, '');
            const response = await axios.post(`${API_URL}/customers/whatsapp/verify-code`, {
                phoneNumber: fullPhone,
                code: fullCode,
                restaurantId
            });

            toast.success('Успешный вход!');

            // Сохраняем авторизацию (zustand + localStorage совместимость)
            setAuth(response.data.customer, response.data.token, restaurantId || null);

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
            setCode(['', '', '', '', '', '']);
            document.getElementById('code-0')?.focus();
        } finally {
            setLoading(false);
        }
    };

    // Верификация кода
    const handleVerifyCode = async (e) => {
        e.preventDefault();
        await verifyCode(code.join(''));
    };

    // Обработка ввода кода
    const handleCodeChange = (index, value) => {
        if (!/^\d*$/.test(value)) return; // Только цифры

        const newCode = [...code];
        newCode[index] = value.slice(-1); // Берем последнюю цифру
        setCode(newCode);

        // Автопереход к следующему полю
        if (value && index < 5) {
            document.getElementById(`code-${index + 1}`)?.focus();
        }

        // Автоотправка при заполнении всех полей
        if (index === 5 && value) {
            const fullCode = newCode.join('');
            if (fullCode.length === 6) {
                verifyCode(fullCode);
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
        return `${selectedCountry.flag} ${selectedCountry.dial} ${phone}`;
    };

    return (
        <div className="min-h-screen bg-white flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background decorations matching landing page */}
            <div className="absolute top-20 -left-32 w-96 h-96 bg-primary-200/30 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-10 -right-32 w-80 h-80 bg-amber-200/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-100/20 rounded-full blur-3xl" />

            <div className="relative bg-white rounded-3xl shadow-xl max-w-md w-full p-8 border border-gray-100">
                {/* Логотип OimoQR */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-md shadow-primary-500/20">
                            <span className="text-white font-bold text-lg">Q</span>
                        </div>
                        <span className="text-2xl font-bold tracking-tight text-gray-900">OimoQR</span>
                    </div>
                    <h1 className="text-2xl font-extrabold text-gray-900">Вход по номеру телефона</h1>
                    <p className="text-gray-500 mt-2">Быстро и безопасно</p>
                </div>

                {step === 1 ? (
                    /* Шаг 1: Номер телефона */
                    <form onSubmit={handleSendCode} className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Номер телефона
                            </label>
                            <div className="flex gap-2">
                                {/* Выбор страны */}
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setShowCountryPicker(!showCountryPicker)}
                                        className="flex items-center gap-1.5 px-3 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all min-w-[105px]"
                                    >
                                        <span className="text-lg">{selectedCountry.flag}</span>
                                        <span className="text-sm font-medium text-gray-700">{selectedCountry.dial}</span>
                                        <svg className="w-3.5 h-3.5 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>

                                    {/* Выпадающий список стран */}
                                    {showCountryPicker && (
                                        <div className="absolute z-50 mt-1 w-64 bg-white border border-gray-100 rounded-2xl shadow-xl max-h-60 overflow-y-auto">
                                            {COUNTRIES.map((country) => (
                                                <button
                                                    key={country.code}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedCountry(country);
                                                        setShowCountryPicker(false);
                                                    }}
                                                    className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-primary-50 text-left transition-colors ${selectedCountry.code === country.code ? 'bg-primary-50 text-primary-700' : ''
                                                        }`}
                                                >
                                                    <span className="text-lg">{country.flag}</span>
                                                    <span className="text-sm text-gray-900 flex-1">{country.name}</span>
                                                    <span className="text-sm text-gray-400">{country.dial}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Поле ввода номера */}
                                <input
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/[^\d\s]/g, '');
                                        setPhoneNumber(val);
                                    }}
                                    placeholder={selectedCountry.placeholder}
                                    className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                    disabled={loading}
                                    autoFocus
                                />
                            </div>
                            <p className="text-xs text-gray-400 mt-2">
                                На этот номер придет SMS с кодом подтверждения
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !phoneNumber.trim()}
                            className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold py-3.5 rounded-xl hover:shadow-lg hover:shadow-primary-500/25 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
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
                                'Получить код по SMS'
                            )}
                        </button>
                    </form>
                ) : (
                    /* Шаг 2: Ввод кода */
                    <form onSubmit={handleVerifyCode} className="space-y-6">
                        <div>
                            <div className="text-center mb-5">
                                <div className="inline-flex items-center gap-2 bg-primary-50 text-primary-700 px-4 py-2 rounded-full text-sm font-semibold mb-3 border border-primary-200/50">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500" />
                                    </span>
                                    SMS отправлено
                                </div>
                                <p className="text-sm text-gray-500">
                                    Код отправлен на номер
                                </p>
                                <p className="text-base font-semibold text-gray-900 mt-1">
                                    {formatPhoneDisplay(phoneNumber)}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStep(1);
                                        setCode(['', '', '', '', '', '']);
                                    }}
                                    className="text-sm text-primary-600 hover:text-primary-700 mt-2 font-medium transition-colors"
                                >
                                    Изменить номер
                                </button>
                            </div>

                            <label className="block text-sm font-semibold text-gray-700 mb-3 text-center">
                                Введите 6-значный код
                            </label>

                            <div className="flex justify-center gap-2.5">
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
                                        className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                                        disabled={loading}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="text-center">
                            {retryAfter > 0 ? (
                                <p className="text-sm text-gray-400">
                                    Повторная отправка через {retryAfter} сек
                                </p>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleSendCode}
                                    className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
                                    disabled={loading}
                                >
                                    Отправить SMS повторно
                                </button>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading || code.join('').length !== 6}
                            className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold py-3.5 rounded-xl hover:shadow-lg hover:shadow-primary-500/25 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
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
                <div className="mt-8 pt-6 border-t border-gray-100">
                    <div className="space-y-3 text-sm text-gray-600">
                        {['Без паролей', 'Быстрый вход по SMS', 'Безопасно'].map((text, i) => (
                            <div key={i} className="flex items-center gap-2.5">
                                <div className="w-5 h-5 rounded-full bg-primary-50 flex items-center justify-center shrink-0">
                                    <svg className="w-3 h-3 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <span>{text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Кнопка назад */}
                <div className="mt-5 text-center">
                    <button
                        type="button"
                        onClick={() => {
                            if (restaurantId) {
                                navigate(`/menu/${restaurantId}`);
                            } else {
                                navigate(-1);
                            }
                        }}
                        className="text-sm text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1.5 mx-auto font-medium transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        {restaurantId ? 'Вернуться в меню' : 'Назад'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WhatsAppLoginPage;

