import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useCustomerAuthStore } from '../store/customerAuthStore';
import api from '../services/api';

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

export default function CustomerLoginModal({ isOpen, onClose, onLoginSuccess, restaurantId }) {
    const setAuth = useCustomerAuthStore((state) => state.setAuth);
    const [step, setStep] = useState(1); // 1 = номер, 2 = код
    const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [retryAfter, setRetryAfter] = useState(0);
    const codeInputs = useRef([]);

    // Автоопределение страны по IP при загрузке
    useEffect(() => {
        const detectCountry = async () => {
            try {
                const res = await fetch('http://ip-api.com/json/?fields=countryCode', { signal: AbortSignal.timeout(3000) });
                const data = await res.json();
                if (data?.countryCode) {
                    const found = COUNTRIES.find(c => c.code === data.countryCode);
                    if (found) setSelectedCountry(found);
                }
            } catch {
                // Не критично
            }
        };
        detectCountry();
    }, []);

    // Таймер для повторной отправки
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

    // Отправка кода
    const handleSendCode = async (e) => {
        e.preventDefault();
        if (!phoneNumber.trim()) {
            toast.error('Введите номер телефона');
            return;
        }

        const fullPhone = selectedCountry.dial + phoneNumber.replace(/\D/g, '');

        setLoading(true);
        try {
            await api.post('/customers/whatsapp/send-code', {
                phoneNumber: fullPhone,
                restaurantId
            });

            toast.success('Код отправлен по SMS!');
            setStep(2);
            setRetryAfter(60);
        } catch (error) {
            if (error.response?.status === 429) {
                const retry = error.response.data.retryAfter || 60;
                setRetryAfter(retry);
                toast.error(`Подождите ${retry} секунд`);
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
            const response = await api.post('/customers/whatsapp/verify-code', {
                phoneNumber: fullPhone,
                code: fullCode,
                restaurantId
            });

            setAuth(response.data.customer, response.data.token, restaurantId || null);
            toast.success('Успешный вход!');
            onLoginSuccess?.();
            onClose();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Неверный код');
            setCode(['', '', '', '', '', '']);
            codeInputs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async (e) => {
        e.preventDefault();
        await verifyCode(code.join(''));
    };

    const handleCodeChange = (index, value) => {
        if (!/^\d*$/.test(value)) return;
        const newCode = [...code];
        newCode[index] = value.slice(-1);
        setCode(newCode);
        if (value && index < 5) codeInputs.current[index + 1]?.focus();
        if (index === 5 && value) {
            const fullCode = newCode.join('');
            if (fullCode.length === 6) verifyCode(fullCode);
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            codeInputs.current[index - 1]?.focus();
        }
    };

    const handleResendCode = () => {
        setCode(['', '', '', '', '', '']);
        setStep(1);
        setRetryAfter(0);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" style={{ paddingBottom: 'max(6rem, calc(6rem + env(safe-area-inset-bottom)))' }}>
            <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl animate-fade-in max-h-[calc(100vh-12rem)] overflow-y-auto border border-gray-100">
                <div className="p-6 sm:p-8">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-md shadow-primary-500/20">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Вход по телефону</h2>
                                <p className="text-xs text-gray-500">Быстро и безопасно</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Step 1: Номер телефона */}
                    {step === 1 && (
                        <form onSubmit={handleSendCode} className="space-y-5">
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
                                                        className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-primary-50 text-left transition-colors ${selectedCountry.code === country.code ? 'bg-primary-50 text-primary-700' : ''}`}
                                                    >
                                                        <span className="text-lg">{country.flag}</span>
                                                        <span className="text-sm text-gray-900 flex-1">{country.name}</span>
                                                        <span className="text-sm text-gray-400">{country.dial}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <input
                                        type="tel"
                                        value={phoneNumber}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^\d\s]/g, '');
                                            setPhoneNumber(val);
                                        }}
                                        placeholder={selectedCountry.placeholder}
                                        required
                                        className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-lg transition-all"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || retryAfter > 0 || !phoneNumber.trim()}
                                className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white py-3.5 rounded-xl hover:shadow-lg hover:shadow-primary-500/25 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none font-semibold"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Отправка...
                                    </span>
                                ) : retryAfter > 0 ? `Повторить через ${retryAfter}с` : 'Получить код по SMS'}
                            </button>

                            <p className="text-xs text-gray-400 text-center">
                                На этот номер придет SMS с кодом подтверждения
                            </p>
                        </form>
                    )}

                    {/* Step 2: Ввод кода */}
                    {step === 2 && (
                        <form onSubmit={handleVerifyCode} className="space-y-5">
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
                                        {selectedCountry.flag} {selectedCountry.dial} {phoneNumber}
                                    </p>
                                </div>

                                <label className="block text-sm font-semibold text-gray-700 mb-3 text-center">
                                    Введите 6-значный код
                                </label>

                                <div className="flex justify-center gap-2 mb-4">
                                    {code.map((digit, index) => (
                                        <input
                                            key={index}
                                            ref={el => codeInputs.current[index] = el}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            value={digit}
                                            onChange={(e) => handleCodeChange(index, e.target.value)}
                                            onKeyDown={(e) => handleKeyDown(index, e)}
                                            className="w-11 h-14 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                                            autoFocus={index === 0}
                                        />
                                    ))}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || code.some(d => !d)}
                                className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white py-3.5 rounded-xl hover:shadow-lg hover:shadow-primary-500/25 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none font-semibold"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Проверка...
                                    </span>
                                ) : 'Войти'}
                            </button>

                            <div className="flex justify-between items-center">
                                <button
                                    type="button"
                                    onClick={handleResendCode}
                                    disabled={retryAfter > 0}
                                    className="text-primary-600 py-2 text-sm font-medium hover:text-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {retryAfter > 0 ? `Повторить через ${retryAfter}с` : 'Отправить SMS повторно'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStep(1);
                                        setCode(['', '', '', '', '', '']);
                                    }}
                                    className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
                                >
                                    Изменить номер
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
