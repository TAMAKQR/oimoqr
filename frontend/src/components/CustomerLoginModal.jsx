import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useCustomerAuthStore } from '../store/customerAuthStore';
import api from '../services/api';

const COUNTRIES = [ // Вынесено за пределы компонента для предотвращения пересоздания
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
    const [step, setStep] = useState(1);
    const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [retryAfter, setRetryAfter] = useState(0);
    const codeInputs = useRef([]);

    // По умолчанию KG (пользователь может выбрать вручную)
    // IP detection отключен из-за блокировки ip-api.com

    useEffect(() => {
        if (retryAfter > 0) {
            const interval = setInterval(() => {
                setRetryAfter(prev => {
                    if (prev <= 1) { clearInterval(interval); return 0; }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [retryAfter]);

    const handleSendCode = async (e) => {
        e.preventDefault();
        if (!phoneNumber.trim()) { toast.error('Введите номер телефона'); return; }
        const fullPhone = selectedCountry.dial + phoneNumber.replace(/\D/g, '');
        setLoading(true);
        try {
            await api.post('/customers/whatsapp/send-code', { phoneNumber: fullPhone, restaurantId });
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
        } finally { setLoading(false); }
    };

    const verifyCode = async (fullCode) => {
        if (loading) return;
        if (!fullCode || fullCode.length !== 6) { toast.error('Введите 6-значный код'); return; }
        setLoading(true);
        try {
            const fullPhone = selectedCountry.dial + phoneNumber.replace(/\D/g, '');
            const response = await api.post('/customers/whatsapp/verify-code', { phoneNumber: fullPhone, code: fullCode, restaurantId });
            setAuth(response.data.customer, response.data.token, restaurantId || null);
            toast.success('Успешный вход!');
            onLoginSuccess?.();
            onClose();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Неверный код');
            setCode(['', '', '', '', '', '']);
            codeInputs.current[0]?.focus();
        } finally { setLoading(false); }
    };

    const handleVerifyCode = async (e) => { e.preventDefault(); await verifyCode(code.join('')); };

    const handleCodeChange = (index, value) => {
        if (!/^\d*$/.test(value)) return;
        const newCode = [...code];
        newCode[index] = value.slice(-1);
        setCode(newCode);
        if (value && index < 5) codeInputs.current[index + 1]?.focus();
        if (index === 5 && value) {
            const full = newCode.join('');
            if (full.length === 6) verifyCode(full);
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) codeInputs.current[index - 1]?.focus();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" style={{ paddingBottom: 'max(6rem, calc(6rem + env(safe-area-inset-bottom)))' }}>
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-fade-in border border-gray-100">
                <div className="p-5">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-5">
                        <h2 className="text-lg font-bold text-gray-900">Вход по телефону</h2>
                        <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {step === 1 ? (
                        <form onSubmit={handleSendCode} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Номер телефона</label>

                                {/* Единое поле: флаг + код + номер */}
                                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent transition-all">
                                    <button
                                        type="button"
                                        onClick={() => setShowCountryPicker(!showCountryPicker)}
                                        className="flex items-center gap-1 px-3 py-3 bg-gray-50 border-r border-gray-200 hover:bg-gray-100 transition-colors shrink-0"
                                    >
                                        <span className="text-lg leading-none">{selectedCountry.flag}</span>
                                        <span className="text-sm font-medium text-gray-600">{selectedCountry.dial}</span>
                                    </button>
                                    <input
                                        type="tel"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\d\s]/g, ''))}
                                        placeholder={selectedCountry.placeholder}
                                        required
                                        className="flex-1 px-3 py-3 text-base outline-none bg-transparent min-w-0"
                                        autoFocus
                                    />
                                </div>

                                {/* Выпадающий список стран — абсолютный, привязан к модалке */}
                                {showCountryPicker && (
                                    <>
                                        <div className="fixed inset-0 z-[101]" onClick={() => setShowCountryPicker(false)} />
                                        <div className="relative z-[102]">
                                            <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                                {COUNTRIES.map((c) => (
                                                    <button
                                                        key={c.code}
                                                        type="button"
                                                        onClick={() => { setSelectedCountry(c); setShowCountryPicker(false); }}
                                                        className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-primary-50 transition-colors text-sm ${selectedCountry.code === c.code ? 'bg-primary-50 font-medium' : ''}`}
                                                    >
                                                        <span>{c.flag}</span>
                                                        <span className="flex-1 text-gray-800">{c.name}</span>
                                                        <span className="text-gray-400">{c.dial}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}

                                <p className="text-xs text-gray-400 mt-1.5">SMS с кодом подтверждения</p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || retryAfter > 0 || !phoneNumber.trim()}
                                className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-primary-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                                        Отправка...
                                    </span>
                                ) : retryAfter > 0 ? `Повторить через ${retryAfter}с` : 'Получить код'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyCode} className="space-y-4">
                            <div className="text-center">
                                <p className="text-sm text-gray-500">Код отправлен на</p>
                                <p className="font-semibold text-gray-900 mt-0.5">{selectedCountry.flag} {selectedCountry.dial} {phoneNumber}</p>
                                <button type="button" onClick={() => { setStep(1); setCode(['', '', '', '', '', '']); }} className="text-xs text-primary-600 hover:text-primary-700 mt-1 font-medium">
                                    Изменить номер
                                </button>
                            </div>

                            <div className="flex justify-center gap-2">
                                {code.map((digit, i) => (
                                    <input
                                        key={i}
                                        ref={el => codeInputs.current[i] = el}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleCodeChange(i, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(i, e)}
                                        className="w-10 h-12 text-center text-xl font-bold border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                                        autoFocus={i === 0}
                                    />
                                ))}
                            </div>

                            <button
                                type="submit"
                                disabled={loading || code.some(d => !d)}
                                className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-primary-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                                        Проверка...
                                    </span>
                                ) : 'Войти'}
                            </button>

                            <div className="text-center">
                                {retryAfter > 0 ? (
                                    <span className="text-xs text-gray-400">Повторить через {retryAfter}с</span>
                                ) : (
                                    <button type="button" onClick={() => { setCode(['', '', '', '', '', '']); setStep(1); setRetryAfter(0); }} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                                        Отправить SMS повторно
                                    </button>
                                )}
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
