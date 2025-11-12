import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import DashboardLayout from '../components/DashboardLayout';

const AdminPricingPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [tiers, setTiers] = useState([]);
  const [trialConfig, setTrialConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditingTrial, setIsEditingTrial] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    description: '',
    features: '',
    maxRestaurants: '',
    order: ''
  });
  const [trialFormData, setTrialFormData] = useState({
    name: '',
    days: '',
    message: ''
  });

  useEffect(() => {
    if (!user?.isAdmin) {
      navigate('/dashboard');
      return;
    }
    loadData();
  }, []);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [tiersRes, trialRes] = await Promise.all([
        api.get('/admin/pricing-tiers'),
        api.get('/admin/trial-config')
      ]);
      setTiers(tiersRes.data);
      setTrialConfig(trialRes.data);
    } catch (err) {
      showNotification('Ошибка при загрузке данных', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (tier) => {
    setEditingId(tier.id);
    setFormData({
      name: tier.name,
      price: tier.price.toString(),
      description: tier.description || '',
      features: tier.features || '',
      maxRestaurants: tier.maxRestaurants || '',
      order: tier.order || ''
    });
    setError('');
  };

  const handleNew = () => {
    setIsCreating(true);
    setFormData({
      name: '',
      price: '',
      description: '',
      features: '',
      maxRestaurants: '',
      order: ''
    });
    setError('');
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsCreating(false);
    setFormData({
      name: '',
      price: '',
      description: '',
      features: '',
      maxRestaurants: '',
      order: ''
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    if (!formData.name || formData.price === '') {
      showNotification('Название и цена обязательны', 'error');
      return;
    }

    setSaving(true);

    try {
      if (isCreating) {
        await api.post('/admin/pricing-tiers', {
          name: formData.name,
          price: parseFloat(formData.price),
          description: formData.description || null,
          features: formData.features || null,
          maxRestaurants: formData.maxRestaurants ? parseInt(formData.maxRestaurants) : null,
          order: formData.order ? parseInt(formData.order) : 0
        });
        showNotification('Тариф создан успешно!');
      } else {
        await api.put(`/admin/pricing-tiers/${editingId}`, {
          name: formData.name,
          price: parseFloat(formData.price),
          description: formData.description || null,
          features: formData.features || null,
          maxRestaurants: formData.maxRestaurants ? parseInt(formData.maxRestaurants) : null,
          order: formData.order ? parseInt(formData.order) : 0
        });
        showNotification('Тариф обновлен успешно!');
      }

      handleCancel();
      await loadData();
    } catch (err) {
      showNotification(err.response?.data?.error || 'Ошибка при сохранении', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот тариф?')) return;

    setSaving(true);
    try {
      await api.delete(`/admin/pricing-tiers/${id}`);
      showNotification('Тариф удален успешно!');
      await loadData();
    } catch (err) {
      showNotification(err.response?.data?.error || 'Ошибка при удалении', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEditTrial = () => {
    setIsEditingTrial(true);
    setTrialFormData({
      name: trialConfig?.name || '',
      days: trialConfig?.days.toString() || '7',
      message: trialConfig?.message || ''
    });
  };

  const handleSaveTrial = async () => {
    if (!trialFormData.days || trialFormData.days < 1) {
      showNotification('Количество дней должно быть >= 1', 'error');
      return;
    }

    setSaving(true);

    try {
      await api.put('/admin/trial-config', {
        name: trialFormData.name,
        days: parseInt(trialFormData.days),
        message: trialFormData.message
      });
      showNotification('Настройки Trial обновлены успешно!');
      setIsEditingTrial(false);
      await loadData();
    } catch (err) {
      showNotification(err.response?.data?.error || 'Ошибка при сохранении', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTrialInputChange = (e) => {
    const { name, value } = e.target;
    setTrialFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Загрузка...</div>
      </div>
    );
  }

  return (
    <DashboardLayout userData={{ restaurants: [] }} selectedRestaurantId={null}>
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg text-white ${
          notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } animate-fade-in-down`}>
          {notification.message}
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/admin')}
            className="text-gray-600 hover:text-gray-800 transition-colors"
            title="Назад к админ-панели"
          >
            ← Назад
          </button>
          <h1 className="text-3xl font-bold">Управление тарифами</h1>
        </div>

        {(editingId || isCreating) && (
          <div className="card p-6 mb-8 bg-blue-50 border-blue-200">
            <h2 className="text-xl font-bold mb-4">
              {isCreating ? 'Создать новый тариф' : 'Редактировать тариф'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Напр: Стартовый"
                  className="input w-full"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Цена (USD) *
                </label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0"
                  placeholder="20.00"
                  className="input w-full"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Описание
                </label>
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Краткое описание тарифа"
                  className="input w-full"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Возможности
                </label>
                <input
                  type="text"
                  name="features"
                  value={formData.features}
                  onChange={handleInputChange}
                  placeholder="Напр: До 5 ресторанов"
                  className="input w-full"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Макс. ресторанов
                </label>
                <input
                  type="number"
                  name="maxRestaurants"
                  value={formData.maxRestaurants}
                  onChange={handleInputChange}
                  min="1"
                  placeholder="5"
                  className="input w-full"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Порядок отображения
                </label>
                <input
                  type="number"
                  name="order"
                  value={formData.order}
                  onChange={handleInputChange}
                  min="0"
                  placeholder="0"
                  className="input w-full"
                  disabled={saving}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleCancel}
                className="btn-secondary flex-1"
                disabled={saving}
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                className="btn-primary flex-1"
                disabled={saving}
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-4 mb-8">
          {tiers.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-600 mb-4">Тарифы не установлены</p>
              <button
                onClick={handleNew}
                className="btn-primary"
              >
                Создать первый тариф
              </button>
            </div>
          ) : (
            tiers.map(tier => (
              <div key={tier.id} className="card p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{tier.name}</h3>
                    <div className="mt-3 space-y-2">
                      <p className="text-2xl font-bold text-primary-600">
                        ${tier.price.toFixed(2)}/месяц
                      </p>
                      {tier.description && (
                        <p className="text-gray-600">{tier.description}</p>
                      )}
                      {tier.features && (
                        <p className="text-sm text-gray-500">📋 {tier.features}</p>
                      )}
                      {tier.maxRestaurants && (
                        <p className="text-sm text-gray-500">🏪 До {tier.maxRestaurants} ресторанов</p>
                      )}
                      <p className="text-xs text-gray-400">
                        Обновлено: {new Date(tier.updatedAt).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(tier)}
                      className="btn-secondary"
                      disabled={saving}
                    >
                      ✏️ Редакт.
                    </button>
                    <button
                      onClick={() => handleDelete(tier.id)}
                      className="btn-secondary text-red-600 hover:bg-red-50"
                      disabled={saving}
                    >
                      🗑️ Удалить
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {!isCreating && !editingId && (
          <button
            onClick={handleNew}
            className="btn-primary"
          >
            + Добавить тариф
          </button>
        )}

        <hr className="my-12" />

        {isEditingTrial && (
          <div className="card p-6 mb-8 bg-yellow-50 border-yellow-200">
            <h2 className="text-xl font-bold mb-4">Настройки пробного периода (Trial)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название
                </label>
                <input
                  type="text"
                  name="name"
                  value={trialFormData.name}
                  onChange={handleTrialInputChange}
                  placeholder="Пробный период"
                  className="input w-full"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Количество дней *
                </label>
                <input
                  type="number"
                  name="days"
                  value={trialFormData.days}
                  onChange={handleTrialInputChange}
                  min="1"
                  placeholder="7"
                  className="input w-full"
                  disabled={saving}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Сообщение для пользователей
                </label>
                <textarea
                  name="message"
                  value={trialFormData.message}
                  onChange={handleTrialInputChange}
                  placeholder="Вы получите 7 дней бесплатного пробного периода"
                  rows="3"
                  className="input w-full"
                  disabled={saving}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setIsEditingTrial(false)}
                className="btn-secondary flex-1"
                disabled={saving}
              >
                Отмена
              </button>
              <button
                onClick={handleSaveTrial}
                className="btn-primary flex-1"
                disabled={saving}
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        )}

        {!isEditingTrial && trialConfig && (
          <div className="card p-6 bg-blue-50 border-blue-200">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-lg font-semibold">⏱️ Настройки пробного периода</h3>
                <div className="mt-3 space-y-2">
                  <p className="text-xl font-bold text-primary-600">
                    {trialConfig.days} дней
                  </p>
                  <p className="text-gray-600">{trialConfig.name}</p>
                  <p className="text-sm text-gray-500">📝 {trialConfig.message}</p>
                </div>
              </div>

              <div className="flex gap-2 ml-4">
                <button
                  onClick={handleEditTrial}
                  className="btn-secondary"
                  disabled={saving}
                >
                  ✏️ Редакт.
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminPricingPage;
