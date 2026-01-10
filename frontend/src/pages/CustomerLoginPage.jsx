import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCustomerAuthStore } from '../store/customerAuthStore';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function CustomerLoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { setAuth } = useCustomerAuthStore();
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [isRegister, setIsRegister] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Получаем данные ресторана из state или localStorage (сохранены на MenuPage)
    const restaurantFromState = location.state?.restaurant;
    const restaurantFromStorage = (() => {
        const raw = localStorage.getItem('customer-last-restaurant');
        if (!raw) return null;
        try { return JSON.parse(raw); } catch (e) { return null; }
    })();
    const restaurantId = restaurantFromState?.id || restaurantFromStorage?.id;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const endpoint = isRegister ? '/customers/register' : '/customers/login';
            const response = await api.post(endpoint, {
                phone,
                name: isRegister ? name : undefined,
                password,
                restaurantId
            });

            const { customer, token } = response.data;

            // Сохраняем в store (без привязки к конкретному ресторану)
            setAuth(customer, token, restaurantFromState || restaurantFromStorage || null);

            toast.success(isRegister ? 'Регистрация успешна!' : 'Вход выполнен!');

            // Перенаправляем в личный кабинет
            navigate('/customer/profile');
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка входа');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex justify-center">
            <div className="w-full max-w-[480px] min-h-screen bg-gradient-to-br from-green-50 to-blue-50 shadow-2xl flex items-center justify-center p-3">
                <div className="bg-white rounded-2xl shadow-xl p-6">
                    {/* Header */}
                    <div className="text-center mb-6">
                        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-bold text-gray-900">Личный кабинет</h1>
                        <p className="text-gray-600 mt-2 text-sm">Войдите, чтобы отслеживать заказы и сохранять избранное</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                <p className="text-red-800 text-sm">{error}</p>
                            </div>
                        )}

                        {/* Toggle Login/Register */}
                        <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                            <button
                                type="button"
                                onClick={() => setIsRegister(false)}
                                className={`flex-1 py-1.5 rounded-md transition text-sm ${!isRegister ? 'bg-white shadow-sm font-medium' : 'text-gray-600'
                                    }`}
                            >
                                Вход
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsRegister(true)}
                                className={`flex-1 py-1.5 rounded-md transition text-sm ${isRegister ? 'bg-white shadow-sm font-medium' : 'text-gray-600'
                                    }`}
                            >
                                Регистрация
                            </button>
                        </div>

                        {/* Phone */}
                        <div>
                            <label htmlFor="phone" className="block text-xs font-medium text-gray-700 mb-1.5">
                                Номер телефона
                            </label>
                            <input
                                id="phone"
                                type="tel"
                                required
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="+7 (___) ___-__-__"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-sm"
                            />
                        </div>

                        {/* Name (only for registration) */}
                        {isRegister && (
                            <div>
                                <label htmlFor="name" className="block text-xs font-medium text-gray-700 mb-1.5">
                                    Ваше имя
                                </label>
                                <input
                                    id="name"
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Как вас зовут?"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-sm"
                                />
                            </div>
                        )}

                        {/* Password */}
                        <div>
                            <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1.5">
                                Пароль
                            </label>
                            <input
                                id="password"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Введите пароль"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-sm"
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading || !phone || !password}
                            className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium active:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    {isRegister ? 'Регистрация...' : 'Вход...'}
                                </span>
                            ) : (
                                isRegister ? 'Зарегистрироваться' : 'Войти'
                            )}
                        </button>

                        <div className="text-center text-sm text-gray-500">
                            {isRegister ? 'Уже есть аккаунт? ' : 'Нет аккаунта? '}
                            <button
                                type="button"
                                onClick={() => setIsRegister(!isRegister)}
                                className="text-green-600 hover:text-green-700 font-medium"
                            >
                                {isRegister ? 'Войти' : 'Зарегистрироваться'}
                            </button>
                        </div>
                    </form>

                    {/* Features */}
                    <div className="mt-8 pt-8 border-t border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">С личным кабинетом вы сможете:</h3>
                        <ul className="space-y-3">
                            <li className="flex items-start">
                                <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="text-sm text-gray-700">Отслеживать статус заказов</span>
                            </li>
                            <li className="flex items-start">
                                <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="text-sm text-gray-700">Сохранять любимые блюда</span>
                            </li>
                            <li className="flex items-start">
                                <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="text-sm text-gray-700">Быстро повторять заказы</span>
                            </li>
                            <li className="flex items-start">
                                <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="text-sm text-gray-700">Сохранять адреса доставки</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
