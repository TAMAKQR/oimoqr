import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { restaurantService } from '../services/restaurantService';
import RestaurantSelector from '../components/RestaurantSelector';
import DashboardLayout from '../components/DashboardLayout';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const RestaurantSettingsPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [userData, setUserData] = useState(null);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [currency, setCurrency] = useState('₽');
  const [menuCardStyle, setMenuCardStyle] = useState('horizontal');
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [deliveryRadius, setDeliveryRadius] = useState('');
  const [bannerFile, setBannerFile] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUploadProgress, setLogoUploadProgress] = useState(0);
  
  // Максимальный размер файла (10MB)
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB в байтах
  
  // Working hours state
  const [isTemporarilyClosed, setIsTemporarilyClosed] = useState(false);
  const [closureReason, setClosureReason] = useState('');
  const [workingHours, setWorkingHours] = useState({
    monday: { open: '09:00', close: '22:00', isOpen: true },
    tuesday: { open: '09:00', close: '22:00', isOpen: true },
    wednesday: { open: '09:00', close: '22:00', isOpen: true },
    thursday: { open: '09:00', close: '22:00', isOpen: true },
    friday: { open: '09:00', close: '22:00', isOpen: true },
    saturday: { open: '10:00', close: '23:00', isOpen: true },
    sunday: { open: '10:00', close: '23:00', isOpen: true },
  });



  // Available currencies
  const currencies = [
    { symbol: '₽', name: 'Российский рубль', code: 'RUB' },
    { symbol: '₸', name: 'Казахстанский тенге', code: 'KZT' },
    { symbol: '$', name: 'Доллар США', code: 'USD' },
    { symbol: '€', name: 'Евро', code: 'EUR' },
    { symbol: '£', name: 'Фунт стерлингов', code: 'GBP' },
    { symbol: '₴', name: 'Украинская гривна', code: 'UAH' },
    { symbol: '₺', name: 'Турецкая лира', code: 'TRY' },
    { symbol: '֏', name: 'Армянский драм', code: 'AMD' },
    { symbol: '₾', name: 'Грузинский лари', code: 'GEL' },
    { symbol: 'so\'m', name: 'Узбекский сум', code: 'UZS' },
    { symbol: 'с', name: 'Кыргызский сом', code: 'KGS' },
    { symbol: '₫', name: 'Вьетнамский донг', code: 'VND' },
  ];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (userData && selectedRestaurantId) {
      const restaurant = getSelectedRestaurant();
      if (restaurant) {
        loadRestaurantData(restaurant);
      }
    }
  }, [selectedRestaurantId]);

  useEffect(() => {
    if (userData && !selectedRestaurantId) {
      const allRestaurants = [
        ...(userData.restaurants || []),
        ...(userData.restaurantStaff?.map(s => s.restaurant) || [])
      ];
      if (allRestaurants.length > 0) {
        setSelectedRestaurantId(allRestaurants[0].id);
      }
    }
  }, [userData, selectedRestaurantId]);

  // Валидация размера файла
  const validateFileSize = (file) => {
    if (file && file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(2);
      alert(`Файл слишком большой (${sizeMB} МБ). Максимальный размер: 10 МБ.\n\nПожалуйста, сожмите изображение перед загрузкой.`);
      return false;
    }
    return true;
  };

  // Обработчик выбора баннера
  const handleBannerFileChange = (e) => {
    const file = e.target.files[0];
    if (file && validateFileSize(file)) {
      setBannerFile(file);
    } else {
      e.target.value = ''; // Очищаем input
    }
  };

  // Обработчик выбора логотипа
  const handleLogoFileChange = (e) => {
    const file = e.target.files[0];
    if (file && validateFileSize(file)) {
      setLogoFile(file);
    } else {
      e.target.value = ''; // Очищаем input
    }
  };

  const getSelectedRestaurant = () => {
    if (!userData || !selectedRestaurantId) return null;
    
    const owned = userData.restaurants?.find(r => r.id === selectedRestaurantId);
    if (owned) return owned;
    
    const staff = userData.restaurantStaff?.find(s => s.restaurant.id === selectedRestaurantId);
    return staff?.restaurant || null;
  };

  const isOwner = () => {
    if (!userData || !selectedRestaurantId) return false;
    return userData.restaurants?.some(r => r.id === selectedRestaurantId) || false;
  };

  const loadData = async () => {
    try {
      const data = await authService.getMe();
      setUserData(data);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRestaurantData = async (restaurant) => {
    const r = restaurant;
    setName(r.name || '');
    setDescription(r.description || '');
    setAddress(r.address || '');
    setPhone(r.phone || '');
    setWhatsapp(r.whatsapp || '');
    setInstagram(r.socialLinks?.instagram || '');
    setFacebook(r.facebook || '');
    setCurrency(r.currency || '₽');
    setMenuCardStyle(r.menuCardStyle || 'horizontal');
    setDeliveryEnabled(r.deliveryEnabled || false);
    setDeliveryFee(r.deliveryFee || '');
    setMinOrderAmount(r.minOrderAmount || '');
    setLatitude(r.latitude || '');
    setLongitude(r.longitude || '');
    setDeliveryRadius(r.deliveryRadius || '');
    
    // Load working hours with defaults to ensure all days are defined
    const defaultWorkingHours = {
      monday: { open: '09:00', close: '22:00', isOpen: true },
      tuesday: { open: '09:00', close: '22:00', isOpen: true },
      wednesday: { open: '09:00', close: '22:00', isOpen: true },
      thursday: { open: '09:00', close: '22:00', isOpen: true },
      friday: { open: '09:00', close: '22:00', isOpen: true },
      saturday: { open: '10:00', close: '23:00', isOpen: true },
      sunday: { open: '10:00', close: '23:00', isOpen: true },
    };
    
    if (r.workingHours) {
      // Merge API data with defaults to ensure all days exist
      setWorkingHours({
        ...defaultWorkingHours,
        ...r.workingHours
      });
    } else {
      setWorkingHours(defaultWorkingHours);
    }
    
    setIsTemporarilyClosed(r.isTemporarilyClosed || false);
    setClosureReason(r.closureReason || '');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDeleteBanner = async (bannerUrl) => {
    if (!confirm('Удалить этот баннер?')) return;
    
    try {
      await restaurantService.deleteBanner(selectedRestaurantId, bannerUrl);
      alert('Баннер удален');
      const restaurant = getSelectedRestaurant();
      if (restaurant) loadRestaurantData(restaurant);
    } catch (err) {
      alert('Ошибка при удалении баннера');
      console.error(err);
    }
  };

  const handleDeleteLogo = async () => {
    if (!confirm('Удалить логотип?')) return;
    
    try {
      await restaurantService.deleteLogo(selectedRestaurantId);
      alert('Логотип удален');
      const restaurant = getSelectedRestaurant();
      if (restaurant) loadRestaurantData(restaurant);
    } catch (err) {
      alert('Ошибка при удалении логотипа');
      console.error(err);
    }
  };

  const handleDeleteRestaurant = async () => {
    const restaurant = getSelectedRestaurant();
    if (!restaurant) return;

    const confirmText = `Вы уверены, что хотите УДАЛИТЬ ресторан "${restaurant.name}"?`;
    const confirmText2 = 'Это действие НЕОБРАТИМО! Все данные (меню, категории, блюда, модификаторы) будут удалены навсегда.';
    
    if (!confirm(`${confirmText}\n\n${confirmText2}\n\nНажмите OK для подтверждения удаления.`)) {
      return;
    }

    // Дополнительное подтверждение
    const finalConfirm = prompt(`Введите название ресторана "${restaurant.name}" для подтверждения удаления:`);
    if (finalConfirm !== restaurant.name) {
      alert('Название не совпадает. Удаление отменено.');
      return;
    }

    try {
      setSaving(true);
      await restaurantService.deleteRestaurant(selectedRestaurantId);
      alert('Ресторан успешно удален');
      // Обновляем данные и переходим на dashboard
      await loadData();
      navigate('/dashboard');
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data?.error || 'Ошибка при удалении ресторана';
      alert(errorMsg);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const data = {
        name,
        description,
        address,
        phone,
        whatsapp,
        instagram,
        facebook,
        currency,
        menuCardStyle,
        deliveryEnabled,
        deliveryFee: deliveryFee ? parseFloat(deliveryFee) : null,
        minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        deliveryRadius: deliveryRadius ? parseFloat(deliveryRadius) : null,
        workingHours,
        isTemporarilyClosed,
        closureReason: isTemporarilyClosed ? closureReason : null,
      };

      await restaurantService.updateRestaurant(selectedRestaurantId, data);

      // Upload logo if selected
      if (logoFile) {
        setUploadingLogo(true);
        setLogoUploadProgress(0);
        try {
          await restaurantService.uploadLogo(selectedRestaurantId, logoFile, (progress) => {
            setLogoUploadProgress(progress);
          });
          setLogoFile(null);
        } finally {
          setUploadingLogo(false);
          setLogoUploadProgress(0);
        }
      }

      // Upload banner if selected
      if (bannerFile) {
        setUploadingBanner(true);
        setUploadProgress(0);
        try {
          await restaurantService.uploadBanner(selectedRestaurantId, bannerFile, (progress) => {
            setUploadProgress(progress);
          });
          setBannerFile(null); // Clear the file input after successful upload
        } finally {
          setUploadingBanner(false);
          setUploadProgress(0);
        }
      }

      alert('Настройки сохранены!');
      await loadData();
    } catch (err) {
      alert('Ошибка при сохранении настроек');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Загрузка...</div>
      </div>
    );
  }

  return (
    <DashboardLayout userData={userData} selectedRestaurantId={selectedRestaurantId}>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6">Настройки ресторана</h1>

        {/* Restaurant Selector */}
        {userData && (
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">Выберите ресторан</label>
            <RestaurantSelector
              selectedRestaurantId={selectedRestaurantId}
              onSelectRestaurant={setSelectedRestaurantId}
            />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Основная информация</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Название ресторана *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Описание</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input w-full"
                  rows="3"
                  placeholder="Краткое описание вашего ресторана"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Адрес</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="input w-full"
                  placeholder="г. Алматы, ул. Абая 123"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Телефон</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input w-full"
                  placeholder="+7 (777) 123-45-67"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Валюта</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="input w-full"
                >
                  {currencies.map((curr) => (
                    <option key={curr.code} value={curr.code}>
                      {curr.symbol} - {curr.name} ({curr.code})
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  Валюта будет отображаться рядом с ценами в меню
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Стиль отображения карточек меню</label>
                <select
                  value={menuCardStyle}
                  onChange={(e) => setMenuCardStyle(e.target.value)}
                  className="input w-full"
                >
                  <option value="horizontal">Горизонтальный (фото слева)</option>
                  <option value="vertical">Вертикальный (фото сверху)</option>
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  Выберите, как будут отображаться карточки блюд в публичном меню
                </p>
              </div>
            </div>
          </div>

          {/* Logo */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Логотип ресторана</h2>
            
            {getSelectedRestaurant()?.logo && (
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Текущий логотип:</p>
                <div className="relative inline-block group">
                  <img
                    src={getSelectedRestaurant().logo}
                    alt="Логотип"
                    className="w-32 h-32 object-contain rounded border-2 border-gray-200 bg-white p-2"
                  />
                  <button
                    type="button"
                    onClick={handleDeleteLogo}
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 shadow-lg transition-all opacity-0 group-hover:opacity-100"
                    title="Удалить логотип"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">
                {getSelectedRestaurant()?.logo ? 'Изменить логотип' : 'Загрузить логотип'}
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoFileChange}
                className="input w-full"
              />
              <p className="text-sm text-gray-500 mt-1">
                Рекомендуемый размер: 200x200 пикселей. Максимум: 10 МБ.
              </p>
              {logoFile && !uploadingLogo && (
                <div className="mt-2">
                  <img
                    src={URL.createObjectURL(logoFile)}
                    alt="Предпросмотр"
                    className="w-32 h-32 object-contain rounded border-2 border-gray-200 bg-white p-2 mb-2"
                  />
                  <p className="text-sm text-green-600">
                    ✓ Выбран файл: {logoFile.name}
                  </p>
                </div>
              )}
              {uploadingLogo && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-blue-600 font-medium">
                      Загрузка логотипа...
                    </span>
                    <span className="text-sm text-blue-600 font-bold">
                      {logoUploadProgress}%
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${logoUploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Banner */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Баннеры</h2>
            
            {getSelectedRestaurant()?.banners && getSelectedRestaurant().banners.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Текущие баннеры:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {getSelectedRestaurant().banners.map((banner, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={banner}
                        alt={`Banner ${index + 1}`}
                        className="w-full h-32 object-cover rounded"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteBanner(banner)}
                        className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 shadow-lg transition-all opacity-0 group-hover:opacity-100"
                        title="Удалить баннер"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">
                Загрузить новый баннер
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleBannerFileChange}
                className="input w-full"
              />
              <p className="text-sm text-gray-500 mt-1">
                Рекомендуемый размер: 1200x400 пикселей. Максимум: 10 МБ.
              </p>
              {bannerFile && !uploadingBanner && (
                <div className="mt-2">
                  <img
                    src={URL.createObjectURL(bannerFile)}
                    alt="Предпросмотр"
                    className="w-full h-32 object-cover rounded mb-2"
                  />
                  <p className="text-sm text-green-600">
                    ✓ Выбран файл: {bannerFile.name}
                  </p>
                </div>
              )}
              {uploadingBanner && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-blue-600 font-medium">
                      Загрузка баннера...
                    </span>
                    <span className="text-sm text-blue-600 font-bold">
                      {uploadProgress}%
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Social Media */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Социальные сети</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">WhatsApp</label>
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="input w-full"
                  placeholder="+77771234567"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Номер для приема заказов через WhatsApp
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Instagram</label>
                <input
                  type="text"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  className="input w-full"
                  placeholder="@your_restaurant"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Facebook</label>
                <input
                  type="text"
                  value={facebook}
                  onChange={(e) => setFacebook(e.target.value)}
                  className="input w-full"
                  placeholder="facebook.com/your-restaurant"
                />
              </div>
            </div>
          </div>

          {/* Delivery Settings */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Настройки доставки</h2>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="deliveryEnabled"
                  checked={deliveryEnabled}
                  onChange={(e) => setDeliveryEnabled(e.target.checked)}
                  className="w-5 h-5"
                />
                <label htmlFor="deliveryEnabled" className="font-medium">
                  Включить доставку
                </label>
              </div>

              {deliveryEnabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Стоимость доставки ({currency})
                    </label>
                    <input
                      type="number"
                      value={deliveryFee}
                      onChange={(e) => setDeliveryFee(e.target.value)}
                      className="input w-full"
                      step="0.01"
                      placeholder="500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Минимальная сумма заказа ({currency})
                    </label>
                    <input
                      type="number"
                      value={minOrderAmount}
                      onChange={(e) => setMinOrderAmount(e.target.value)}
                      className="input w-full"
                      step="0.01"
                      placeholder="2000"
                    />
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="font-medium mb-3">📍 Геолокация и зона доставки</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Укажите координаты вашего ресторана для определения зоны доставки
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Широта (Latitude)
                        </label>
                        <input
                          type="number"
                          value={latitude}
                          onChange={(e) => setLatitude(e.target.value)}
                          className="input w-full"
                          step="0.000001"
                          placeholder="55.751244"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Долгота (Longitude)
                        </label>
                        <input
                          type="number"
                          value={longitude}
                          onChange={(e) => setLongitude(e.target.value)}
                          className="input w-full"
                          step="0.000001"
                          placeholder="37.618423"
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium mb-1">
                        Радиус доставки (км)
                      </label>
                      <input
                        type="number"
                        value={deliveryRadius}
                        onChange={(e) => setDeliveryRadius(e.target.value)}
                        className="input w-full"
                        step="0.1"
                        placeholder="5"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Максимальное расстояние доставки от вашего ресторана
                      </p>
                    </div>

                    <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800">
                        💡 <strong>Совет:</strong> Используйте{' '}
                        <a
                          href="https://www.google.com/maps"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          Google Maps
                        </a>
                        {' '}или{' '}
                        <a
                          href="https://yandex.ru/maps"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          Яндекс Карты
                        </a>
                        {' '}чтобы найти координаты вашего ресторана
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Working Hours */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4">⏰ Режим работы</h2>
            
            {/* Temporary Closure */}
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  id="isTemporarilyClosed"
                  checked={isTemporarilyClosed}
                  onChange={(e) => setIsTemporarilyClosed(e.target.checked)}
                  className="w-5 h-5"
                />
                <label htmlFor="isTemporarilyClosed" className="font-medium text-gray-700">
                  🚫 Ресторан временно закрыт
                </label>
              </div>
              
              {isTemporarilyClosed && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">Причина закрытия</label>
                  <input
                    type="text"
                    value={closureReason}
                    onChange={(e) => setClosureReason(e.target.value)}
                    className="input w-full"
                    placeholder="Например: Технический перерыв до 15:00, Ремонт, Выходной..."
                  />
                  <p className="text-sm text-gray-600 mt-1">
                    Эта информация будет отображаться в меню для клиентов
                  </p>
                </div>
              )}
            </div>

            {/* Days of Week */}
            <div className="space-y-3">
              {Object.entries({
                monday: 'Понедельник',
                tuesday: 'Вторник',
                wednesday: 'Среда',
                thursday: 'Четверг',
                friday: 'Пятница',
                saturday: 'Суббота',
                sunday: 'Воскресенье',
              }).map(([day, label]) => (
                <div key={day} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <div className="w-32 font-medium text-gray-700">{label}</div>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`${day}-isOpen`}
                      checked={workingHours[day].isOpen}
                      onChange={(e) => setWorkingHours({
                        ...workingHours,
                        [day]: { ...workingHours[day], isOpen: e.target.checked }
                      })}
                      className="w-4 h-4"
                    />
                    <label htmlFor={`${day}-isOpen`} className="text-sm text-gray-600 w-20">
                      {workingHours[day].isOpen ? 'Открыто' : 'Выходной'}
                    </label>
                  </div>

                  {workingHours[day].isOpen && (
                    <>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">С</label>
                        <input
                          type="time"
                          value={workingHours[day].open}
                          onChange={(e) => setWorkingHours({
                            ...workingHours,
                            [day]: { ...workingHours[day], open: e.target.value }
                          })}
                          className="input w-28 text-sm"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">До</label>
                        <input
                          type="time"
                          value={workingHours[day].close}
                          onChange={(e) => setWorkingHours({
                            ...workingHours,
                            [day]: { ...workingHours[day], close: e.target.value }
                          })}
                          className="input w-28 text-sm"
                        />
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <p className="text-sm text-gray-600 mt-4">
              💡 Режим работы будет отображаться в меню. Статус "Открыто/Закрыто" рассчитывается автоматически на основе текущего времени.
            </p>
          </div>

          {/* Save Button */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="btn-secondary flex-1"
              disabled={saving || uploadingBanner}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={saving || uploadingBanner}
            >
              {uploadingBanner ? 'Загрузка баннера...' : saving ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </div>
        </form>

        {/* Danger Zone - Delete Restaurant - только для владельцев */}
        {isOwner() && (
          <div className="card border-2 border-red-200 bg-red-50 mt-8">
            <h2 className="text-xl font-bold text-red-600 mb-2">⚠️ Опасная зона</h2>
            <p className="text-sm text-gray-700 mb-4">
              Удаление ресторана необратимо. Все данные (меню, категории, блюда, модификаторы) будут удалены навсегда.
            </p>
            <button
              type="button"
              onClick={handleDeleteRestaurant}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              disabled={saving}
            >
              🗑️ Удалить ресторан
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default RestaurantSettingsPage;