import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';

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
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

    console.log('🚀 Submitting registration:', formData);

    try {
      const response = await authService.register(formData);
      console.log('✅ Registration successful:', response);
      setAuth(response.user, response.token);
      navigate('/dashboard');
    } catch (err) {
      console.error('❌ Registration error:', err);
      console.error('Error response:', err.response);
      setError(err.response?.data?.error || 'Ошибка регистрации');
    } finally {
      setLoading(false);
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
            <label className="block text-sm font-medium mb-1">Название ресторана *</label>
            <input
              type="text"
              name="restaurantName"
              value={formData.restaurantName}
              onChange={handleChange}
              className="input-field"
              required
            />
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
                placeholder="myrestaurant"
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
              🎉 Вы получите <strong>7 дней бесплатного пробного периода</strong>
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