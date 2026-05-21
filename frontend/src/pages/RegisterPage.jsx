import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { getBusinessType, BUSINESS_TYPE_OPTIONS } from '../utils/businessTypes';
import toast from 'react-hot-toast';

const RegisterPage = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    restaurantName: '',
    subdomain: '',
    businessType: 'RESTAURANT',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [trialDays, setTrialDays] = useState(7);

  useEffect(() => {
    const fetchTrialConfig = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_URL || '/api';
        const response = await fetch(`${apiBase}/trial-config?businessType=${encodeURIComponent(formData.businessType)}`);
        if (response.ok) {
          const data = await response.json();
          setTrialDays(data.days || 7);
        }
      } catch (err) {
        // console.error('Error fetching trial config:', err);
      }
    };
    fetchTrialConfig();
  }, [formData.businessType]);

  const handleChange = (e) => {
    let value = e.target.value;

    // Auto-format subdomain
    if (e.target.name === 'subdomain') {
      value = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    }

    setFormData({
      ...formData,
      [e.target.name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authService.register(formData);

      // Сохраняем данные пользователя
      setAuth(response.user, response.token);

      // Показываем успешное уведомление с типом бизнеса
      const businessTypeLabel = getBusinessType(formData.businessType).label;
      toast.success(
        `Добро пожаловать, ${response.user.name}! Объект "${formData.restaurantName}" (${businessTypeLabel}) создан.`
      );

      // Даём небольшую задержку для того, чтобы пользователь увидел уведомление
      setTimeout(() => {
        navigate('/dashboard');
      }, 500);
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка регистрации');
      toast.error(err.response?.data?.error || 'Ошибка регистрации');
      setLoading(false);
    } finally {
      // Не сбрасываем loading здесь, чтобы кнопка оставалась заблокированной во время редиректа
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="card max-w-2xl w-full">
        <h1 className="text-3xl font-bold text-center mb-6">Регистрация</h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Ваше имя *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="input-field"
                required
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Пароль *</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="input-field"
                minLength={6}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Телефон</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="input-field"
                placeholder="+7 (999) 123-45-67"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Название бизнеса *</label>
            <input
              type="text"
              name="restaurantName"
              value={formData.restaurantName}
              onChange={handleChange}
              className="input-field"
              placeholder={getBusinessType(formData.businessType).namePlaceholder}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Тип бизнеса *</label>
            <select
              name="businessType"
              value={formData.businessType}
              onChange={handleChange}
              className="input-field"
              required
            >
              {BUSINESS_TYPE_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-sm text-gray-500 mt-1">
              Выберите, что вы хотите зарегистрировать: ресторан, отель или сеть ресторанов.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Субдомен *</label>
            <div className="flex items-center">
              <input
                type="text"
                name="subdomain"
                value={formData.subdomain}
                onChange={handleChange}
                className="input-field rounded-r-none"
                placeholder={getBusinessType(formData.businessType).subdomainPlaceholder}
                minLength={3}
                required
              />
              <span className="bg-gray-100 border border-l-0 border-gray-300 px-4 py-2 rounded-r-lg text-gray-600">
                .oimoqr.com
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Только строчные буквы, цифры и дефисы
            </p>
          </div>

          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
            <p className="text-sm text-primary-800">
              🎉 Вы получите <strong>{trialDays} дней бесплатного пробного периода</strong>
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3"
          >
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </form>

        <p className="text-center mt-6 text-gray-600">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-primary-600 hover:underline">
            Войти
          </Link>
        </p>

        <Link
          to="/"
          className="block text-center mt-4 text-gray-600 hover:text-gray-800"
        >
          ← Вернуться на главную
        </Link>
      </div>
    </div>
  );
};

export default RegisterPage;
