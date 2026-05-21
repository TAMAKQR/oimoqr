import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { confirmDialog } from '../utils/confirmDialog';
import DashboardLayout from '../components/DashboardLayout';
import toast from 'react-hot-toast';

const TRIAL_TYPE_OPTIONS = [
  { value: 'RESTAURANT', label: '🍽 Ресторан' },
  { value: 'ONLINE_STORE', label: '🛍 Магазин' },
  { value: 'HOTEL', label: '🏨 Отель' },
  { value: 'ALL', label: '📦 По умолчанию' },
];

const AdminPricingPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [tiers, setTiers] = useState([]);
  const [trialConfigs, setTrialConfigs] = useState([]);
  const [selectedTrialBusinessType, setSelectedTrialBusinessType] = useState('RESTAURANT');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditingTrial, setIsEditingTrial] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    description: '',
    features: '',
    maxRestaurants: '',
    bonusProgramEnabled: false,
    bonusAccrualRate: '0',
    bonusExpiryDays: '90',
    bonusBronzeLabel: 'Bronze',
    bonusSilverLabel: 'Silver',
    bonusGoldLabel: 'Gold',
    bonusSilverFromOrders: '8',
    bonusGoldFromOrders: '20',
    businessType: 'RESTAURANT',
    order: ''
  });
  const [trialFormData, setTrialFormData] = useState({
    name: '',
    days: '',
    message: ''
  });

  const trialConfig = trialConfigs.find((config) => config.businessType === selectedTrialBusinessType) || null;

  useEffect(() => {
    if (!user?.isAdmin) {
      navigate('/dashboard');
      return;
    }
    loadData();
  }, []);

  const showNotification = (message, type = 'success') => {
    if (type === 'error') toast.error(message);
    else toast.success(message);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [tiersRes, trialRes] = await Promise.all([
        api.get('/admin/pricing-tiers'),
        api.get('/admin/trial-config?all=true')
      ]);
      setTiers(tiersRes.data);
      setTrialConfigs(Array.isArray(trialRes.data) ? trialRes.data : []);
    } catch (err) {
      showNotification('Ошибка при загрузке данных', 'error');
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
      bonusProgramEnabled: Boolean(tier.bonusProgramEnabled),
      bonusAccrualRate: (((tier.bonusAccrualRate ?? 0) * 100)).toString(),
      bonusExpiryDays: tier.bonusExpiryDays?.toString?.() || '90',
      bonusBronzeLabel: tier.bonusBronzeLabel || 'Bronze',
      bonusSilverLabel: tier.bonusSilverLabel || 'Silver',
      bonusGoldLabel: tier.bonusGoldLabel || 'Gold',
      bonusSilverFromOrders: tier.bonusSilverFromOrders?.toString?.() || '8',
      bonusGoldFromOrders: tier.bonusGoldFromOrders?.toString?.() || '20',
      businessType: tier.businessType || 'RESTAURANT',
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
      bonusProgramEnabled: false,
      bonusAccrualRate: '0',
      bonusExpiryDays: '90',
      bonusBronzeLabel: 'Bronze',
      bonusSilverLabel: 'Silver',
      bonusGoldLabel: 'Gold',
      bonusSilverFromOrders: '8',
      bonusGoldFromOrders: '20',
      businessType: 'RESTAURANT',
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
      bonusProgramEnabled: false,
      bonusAccrualRate: '0',
      bonusExpiryDays: '90',
      bonusBronzeLabel: 'Bronze',
      bonusSilverLabel: 'Silver',
      bonusGoldLabel: 'Gold',
      bonusSilverFromOrders: '8',
      bonusGoldFromOrders: '20',
      businessType: 'RESTAURANT',
      order: ''
    });
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
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
          bonusProgramEnabled: Boolean(formData.bonusProgramEnabled),
          bonusAccrualRate: formData.bonusAccrualRate === '' ? 0 : parseFloat(formData.bonusAccrualRate) / 100,
          bonusExpiryDays: formData.bonusExpiryDays ? parseInt(formData.bonusExpiryDays) : 90,
          bonusBronzeLabel: formData.bonusBronzeLabel || 'Bronze',
          bonusSilverLabel: formData.bonusSilverLabel || 'Silver',
          bonusGoldLabel: formData.bonusGoldLabel || 'Gold',
          bonusSilverFromOrders: formData.bonusSilverFromOrders ? parseInt(formData.bonusSilverFromOrders) : 8,
          bonusGoldFromOrders: formData.bonusGoldFromOrders ? parseInt(formData.bonusGoldFromOrders) : 20,
          businessType: formData.businessType || 'RESTAURANT',
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
          bonusProgramEnabled: Boolean(formData.bonusProgramEnabled),
          bonusAccrualRate: formData.bonusAccrualRate === '' ? 0 : parseFloat(formData.bonusAccrualRate) / 100,
          bonusExpiryDays: formData.bonusExpiryDays ? parseInt(formData.bonusExpiryDays) : 90,
          bonusBronzeLabel: formData.bonusBronzeLabel || 'Bronze',
          bonusSilverLabel: formData.bonusSilverLabel || 'Silver',
          bonusGoldLabel: formData.bonusGoldLabel || 'Gold',
          bonusSilverFromOrders: formData.bonusSilverFromOrders ? parseInt(formData.bonusSilverFromOrders) : 8,
          bonusGoldFromOrders: formData.bonusGoldFromOrders ? parseInt(formData.bonusGoldFromOrders) : 20,
          businessType: formData.businessType || 'RESTAURANT',
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
    const confirmed = await confirmDialog('Вы уверены, что хотите удалить этот тариф?', {
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      icon: '🗑️'
    });
    if (!confirmed) return;

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
        businessType: selectedTrialBusinessType,
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

  const bonusRatePercent = Number.isFinite(parseFloat(formData.bonusAccrualRate))
    ? Math.max(0, parseFloat(formData.bonusAccrualRate))
    : 0;
  const silverFromOrders = Number.isFinite(parseInt(formData.bonusSilverFromOrders))
    ? Math.max(1, parseInt(formData.bonusSilverFromOrders))
    : 8;
  const goldFromOrders = Number.isFinite(parseInt(formData.bonusGoldFromOrders))
    ? Math.max(1, parseInt(formData.bonusGoldFromOrders))
    : 20;
  const bronzeLabel = (formData.bonusBronzeLabel || 'Bronze').trim() || 'Bronze';
  const silverLabel = (formData.bonusSilverLabel || 'Silver').trim() || 'Silver';
  const goldLabel = (formData.bonusGoldLabel || 'Gold').trim() || 'Gold';
  const isTierThresholdValid = goldFromOrders > silverFromOrders;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Загрузка...</div>
      </div>
    );
  }

  return (
    <DashboardLayout userData={{ restaurants: [] }} selectedRestaurantId={null}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/admin')}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Назад к админ-панели"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Управление тарифами</h1>
            <p className="text-gray-500 text-sm mt-1">Создавайте и редактируйте тарифные планы</p>
          </div>
        </div>

        {(editingId || isCreating) && (
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-5 mb-6">
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

              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    name="bonusProgramEnabled"
                    checked={formData.bonusProgramEnabled}
                    onChange={handleInputChange}
                    disabled={saving}
                  />
                  Включить бонусную программу для этого тарифа
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Если выключено — клиентам бонусы не начисляются, и блок бонусной системы будет скрыт.
                </p>
              </div>

              <div className="md:col-span-2 rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-sm font-semibold text-gray-800 mb-1">Как работают уровни клиента</p>
                <p className="text-xs text-gray-600">
                  До {silverFromOrders - 1 >= 0 ? silverFromOrders - 1 : 0} заказов — <strong>{bronzeLabel}</strong>,
                  от {silverFromOrders} — <strong>{silverLabel}</strong>,
                  от {goldFromOrders} — <strong>{goldLabel}</strong>.
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Начисление за выполненный заказ: <strong>{bonusRatePercent}%</strong> от суммы заказа.
                </p>
                {!isTierThresholdValid && (
                  <p className="text-xs text-red-600 mt-1">
                    Порог Gold должен быть больше порога Silver.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Начисление бонусов (%)
                </label>
                <input
                  type="number"
                  name="bonusAccrualRate"
                  value={formData.bonusAccrualRate}
                  onChange={handleInputChange}
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="5"
                  className="input w-full"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Срок жизни бонусов (дни)
                </label>
                <input
                  type="number"
                  name="bonusExpiryDays"
                  value={formData.bonusExpiryDays}
                  onChange={handleInputChange}
                  min="1"
                  step="1"
                  placeholder="90"
                  className="input w-full"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название начального уровня (Bronze)
                </label>
                <input
                  type="text"
                  name="bonusBronzeLabel"
                  value={formData.bonusBronzeLabel}
                  onChange={handleInputChange}
                  className="input w-full"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название среднего уровня (Silver)
                </label>
                <input
                  type="text"
                  name="bonusSilverLabel"
                  value={formData.bonusSilverLabel}
                  onChange={handleInputChange}
                  className="input w-full"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название максимального уровня (Gold)
                </label>
                <input
                  type="text"
                  name="bonusGoldLabel"
                  value={formData.bonusGoldLabel}
                  onChange={handleInputChange}
                  className="input w-full"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Порог для уровня Silver (заказов)
                </label>
                <input
                  type="number"
                  name="bonusSilverFromOrders"
                  value={formData.bonusSilverFromOrders}
                  onChange={handleInputChange}
                  min="1"
                  step="1"
                  className="input w-full"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Порог для уровня Gold (заказов)
                </label>
                <input
                  type="number"
                  name="bonusGoldFromOrders"
                  value={formData.bonusGoldFromOrders}
                  onChange={handleInputChange}
                  min="1"
                  step="1"
                  className="input w-full"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Тип бизнеса
                </label>
                <select
                  name="businessType"
                  value={formData.businessType}
                  onChange={handleInputChange}
                  className="input w-full"
                  disabled={saving}
                >
                  <option value="RESTAURANT">🍽 Ресторан</option>
                  <option value="ONLINE_STORE">🛍 Магазин</option>
                  <option value="HOTEL">🏨 Отель</option>
                  <option value="ALL">📦 Универсальный</option>
                </select>
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
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors text-sm font-medium"
                disabled={saving}
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                disabled={saving}
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-4 mb-8">
          {tiers.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 text-center py-12">
              <p className="text-gray-600 mb-4">Тарифы не установлены</p>
              <button
                onClick={handleNew}
                className="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                Создать первый тариф
              </button>
            </div>
          ) : (
            tiers.map(tier => (
              <div key={tier.id} className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{tier.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tier.businessType === 'ONLINE_STORE' ? 'bg-purple-100 text-purple-700' :
                        tier.businessType === 'HOTEL' ? 'bg-green-100 text-green-700' :
                          tier.businessType === 'ALL' ? 'bg-gray-100 text-gray-700' :
                            'bg-blue-100 text-blue-700'
                        }`}>
                        {tier.businessType === 'ONLINE_STORE' ? '🛍 Магазин' : tier.businessType === 'HOTEL' ? '🏨 Отель' : tier.businessType === 'ALL' ? '📦 Все' : '🍽 Ресторан'}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      <p className="text-2xl font-bold text-primary-600">
                        ${tier.price.toFixed(2)}/месяц
                      </p>
                      {tier.description && (
                        <p className="text-gray-600">{tier.description}</p>
                      )}
                      {tier.features && (
                        <p className="text-sm text-gray-500">{tier.features}</p>
                      )}
                      {tier.maxRestaurants && (
                        <p className="text-sm text-gray-500">До {tier.maxRestaurants} ресторанов</p>
                      )}
                      <p className="text-sm text-gray-500">
                        Бонусы: {tier.bonusProgramEnabled ? `вкл, ${Math.round((tier.bonusAccrualRate || 0) * 100)}% · ${tier.bonusExpiryDays || 90} дн.` : 'выкл'}
                      </p>
                      {tier.bonusProgramEnabled && (
                        <p className="text-sm text-gray-500">
                          Уровни: {tier.bonusBronzeLabel || 'Bronze'} → {tier.bonusSilverLabel || 'Silver'} от {tier.bonusSilverFromOrders || 8}, {tier.bonusGoldLabel || 'Gold'} от {tier.bonusGoldFromOrders || 20}
                        </p>
                      )}
                      <p className="text-xs text-gray-400">
                        Обновлено: {new Date(tier.updatedAt).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(tier)}
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors text-sm"
                      disabled={saving}
                    >
                      Редакт.
                    </button>
                    <button
                      onClick={() => handleDelete(tier.id)}
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-red-600 bg-white hover:bg-red-50 transition-colors text-sm"
                      disabled={saving}
                    >
                      Удалить
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
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Добавить тариф
          </button>
        )}

        <hr className="my-12" />

        {isEditingTrial && (
          <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-5 mb-6">
            <h2 className="text-xl font-bold mb-4">Настройки пробного периода (Trial)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Тип бизнеса
                </label>
                <select
                  value={selectedTrialBusinessType}
                  onChange={(e) => setSelectedTrialBusinessType(e.target.value)}
                  className="input w-full"
                  disabled={saving}
                >
                  {TRIAL_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

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
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors text-sm font-medium"
                disabled={saving}
              >
                Отмена
              </button>
              <button
                onClick={handleSaveTrial}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                disabled={saving}
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        )}

        {!isEditingTrial && (
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-lg font-semibold">Настройки пробного периода</h3>
                <div className="flex flex-wrap gap-2 mt-3">
                  {TRIAL_TYPE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSelectedTrialBusinessType(option.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedTrialBusinessType === option.value
                        ? 'bg-primary-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-200'
                        }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 space-y-2">
                  <p className="text-xl font-bold text-primary-600">
                    {trialConfig?.days || 7} дней
                  </p>
                  <p className="text-gray-600">{trialConfig?.name || 'Пробный период'}</p>
                  <p className="text-sm text-gray-500">{trialConfig?.message || 'Вы получите пробный период'}</p>
                </div>
              </div>

              <div className="flex gap-2 ml-4">
                <button
                  onClick={handleEditTrial}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors text-sm"
                  disabled={saving}
                >
                  Редакт.
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
