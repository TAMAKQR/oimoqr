import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useCustomerAuthStore } from '../store/customerAuthStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export default function CustomerLoginModal({ isOpen, onClose, onLoginSuccess, restaurantId }) {
    const setAuth = useCustomerAuthStore((state) => state.setAuth);
    const [step, setStep] = useState(1); // 1 = номер, 2 = код
    const [phoneNumber, setPhoneNumber] = useState('');
    const [code, setCode] = useState(['', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [retryAfter, setRetryAfter] = useState(0);
    const codeInputs = useRef([]);

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

        setLoading(true);
        try {
            await axios.post(`${API_URL}/customers/whatsapp/send-code`, {
                phoneNumber,
                restaurantId
            });

            toast.success('Код отправлен в WhatsApp!');
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
        if (!fullCode || fullCode.length !== 4) {
            toast.error('Введите 4-значный код');
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post(`${API_URL}/customers/whatsapp/verify-code`, {
                phoneNumber,
                code: fullCode,
                restaurantId
            });

            // Сохраняем авторизацию (zustand + localStorage совместимость)
            setAuth(response.data.customer, response.data.token, restaurantId || null);

            toast.success('Успешный вход!');
            onLoginSuccess?.();
            onClose();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Неверный код');
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
        if (!/^\d*$/.test(value)) return;

        const newCode = [...code];
        newCode[index] = value.slice(-1);
        setCode(newCode);

        // Автофокус на следующий input
        if (value && index < 3) {
            codeInputs.current[index + 1]?.focus();
        }

        // Автоотправка при заполнении всех 4 цифр
        if (newCode.every(digit => digit) && index === 3) {
            verifyCode(newCode.join(''));
        }
    };

    // Обработка Backspace
    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            codeInputs.current[index - 1]?.focus();
        }
    };

    // Повторная отправка кода
    const handleResendCode = () => {
        setCode(['', '', '', '']);
        setStep(1);
        setRetryAfter(0);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4" style={{ paddingBottom: 'max(6rem, calc(6rem + env(safe-area-inset-bottom)))' }}>
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl animate-fade-in max-h-[calc(100vh-12rem)] overflow-y-auto">
                <div className="p-6">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-800">
                            Вход через WhatsApp
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 text-2xl"
                        >
                            ×
                        </button>
                    </div>

                    {/* Step 1: Номер телефона */}
                    {step === 1 && (
                        <form onSubmit={handleSendCode} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Номер телефона
                                </label>
                                <input
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    placeholder="+7 (___) ___-__-__"
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || retryAfter > 0}
                                className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-lg hover:from-green-600 hover:to-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                                {loading ? 'Отправка...' : retryAfter > 0 ? `Повторить через ${retryAfter}с` : 'Получить код'}
                            </button>

                            <p className="text-xs text-gray-500 text-center mt-3">
                                Мы отправим код подтверждения в WhatsApp
                            </p>
                        </form>
                    )}

                    {/* Step 2: Ввод кода */}
                    {step === 2 && (
                        <form onSubmit={handleVerifyCode} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                                    Введите код из WhatsApp
                                </label>
                                <p className="text-xs text-gray-500 text-center mb-4">
                                    Отправлен на {phoneNumber}
                                </p>
                                <div className="flex justify-center gap-3 mb-6">
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
                                            className="w-14 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                            autoFocus={index === 0}
                                        />
                                    ))}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || code.some(d => !d)}
                                className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-lg hover:from-green-600 hover:to-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                                {loading ? 'Проверка...' : 'Войти'}
                            </button>

                            <button
                                type="button"
                                onClick={handleResendCode}
                                disabled={retryAfter > 0}
                                className="w-full text-green-600 py-2 text-sm hover:text-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {retryAfter > 0 ? `Повторить через ${retryAfter}с` : 'Отправить код повторно'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
