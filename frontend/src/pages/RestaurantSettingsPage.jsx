import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { restaurantService } from '../services/restaurantService';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const RestaurantSettingsPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [userData, setUserData] = useState(null);
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
  const [bannerFile, setBannerFile] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUploadProgress, setLogoUploadProgress] = useState(0);

  // Delivery locations state
  const [deliveryLocations, setDeliveryLocations] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [newLocation, setNewLocation] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    whatsapp: ''
  });
  const [showAddLocation, setShowAddLocation] = useState(false);

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

  const loadData = async () => {
    try {
      const data = await authService.getMe();
      setUserData(data);
      
      if (data.restaurant) {
        const r = data.restaurant;
        setName(r.name || '');
        setDescription(r.description || '');
        setAddress(r.address || '');
        setPhone(r.phone || '');
        setWhatsapp(r.whatsapp || '');
        setInstagram(r.instagram || '');
        setFacebook(r.facebook || '');
        setCurrency(r.currency || '₽');
        setMenuCardStyle(r.menuCardStyle || 'horizontal');
        setDeliveryEnabled(r.deliveryEnabled || false);
        setDeliveryFee(r.deliveryFee || '');
        setMinOrderAmount(r.minOrderAmount || '');
        
        await loadDeliveryLocations(r.id);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDeliveryLocations = async (restaurantId) => {
    try {
      setLoadingLocations(true);
      const response = await fetch(`${API_URL}/restaurants/${restaurantId}/delivery-locations`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const locations = await response.json();
      setDeliveryLocations(locations);
    } catch (err) {
      console.error('Error loading delivery locations:', err);
    } finally {
      setLoadingLocations(false);
    }
  };

  const handleAddLocation = async () => {
    if (!newLocation.name || !newLocation.address || !newLocation.latitude || !newLocation.longitude || !newLocation.whatsapp) {
      alert('Заполните все обязательные поля');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/restaurants/${userData.restaurant.id}/delivery-locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLocation)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setNewLocation({ name: '', address: '', latitude: '', longitude: '', whatsapp: '' });
      setShowAddLocation(false);
      await loadDeliveryLocations(userData.restaurant.id);
      alert('Точка добавлена');
    } catch (err) {
      alert('Ошибка при добавлении точки: ' + err.message);
      console.error(err);
    }
  };

  const handleDeleteLocation = async (locationId) => {
    if (!confirm('Удалить эту точку доставки?')) return;

    try {
      const response = await fetch(`${API_URL}/restaurants/${userData.restaurant.id}/delivery-locations/${locationId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      await loadDeliveryLocations(userData.restaurant.id);
      alert('Точка удалена');
    } catch (err) {
      alert('Ошибка при удалении точки: ' + err.message);
      console.error(err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDeleteBanner = async (bannerUrl) => {
    if (!confirm('Удалить этот баннер?')) return;
    
    try {
      await restaurantService.deleteBanner(userData.restaurant.id, bannerUrl);
      alert('Баннер удален');
      await loadData();
    } catch (err) {
      alert('Ошибка при удалении баннера');
      console.error(err);
    }
  };

  const handleDeleteLogo = async () => {
    if (!confirm('Удалить логотип?')) return;
    
    try {
      await restaurantService.deleteLogo(userData.restaurant.id);
      alert('Логотип удален');
      await loadData();
    } catch (err) {
      alert('Ошибка при удалении логотипа');
      console.error(err);
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
      };

      await restaurantService.updateRestaurant(userData.restaurant.id, data);

      // Upload logo if selected
      if (logoFile) {
        setUploadingLogo(true);
        setLogoUploadProgress(0);
        try {
          await restaurantService.uploadLogo(userData.restaurant.id, logoFile, (progress) => {
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
          await restaurantService.uploadBanner(userData.restaurant.id, bannerFile, (progress) => {
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="text-gray-600 hover:text-gray-900">
              ← Назад
            </button>
            <h1 className="text-2xl font-bold text-primary-600">Настройки ресторана</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">{user?.name}</span>
            <button onClick={handleLogout} className="btn-secondary">
              Выход
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-3xl">
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
                    <option key={curr.code} value={curr.symbol}>
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
            
            {userData?.restaurant?.logo && (
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Текущий логотип:</p>
                <div className="relative inline-block group">
                  <img
                    src={userData.restaurant.logo}
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
                {userData?.restaurant?.logo ? 'Изменить логотип' : 'Загрузить логотип'}
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setLogoFile(e.target.files[0])}
                className="input w-full"
              />
              <p className="text-sm text-gray-500 mt-1">
                Рекомендуемый размер: 200x200 пикселей. Логотип будет отображаться в меню.
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
            
            {userData?.restaurant?.banners && userData.restaurant.banners.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Текущие баннеры:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userData.restaurant.banners.map((banner, index) => (
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
                onChange={(e) => setBannerFile(e.target.files[0])}
                className="input w-full"
              />
              <p className="text-sm text-gray-500 mt-1">
                Рекомендуемый размер: 1200x400 пикселей. Баннер будет добавлен к существующим.
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
                </>
              )}
            </div>
          </div>

          {/* Delivery Locations */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Точки доставки</h2>
              <button
                type="button"
                onClick={() => setShowAddLocation(!showAddLocation)}
                className="btn-primary text-sm"
              >
                {showAddLocation ? '✕ Отмена' : '+ Добавить точку'}
              </button>
            </div>

            {showAddLocation && (
              <div className="bg-gray-50 p-4 rounded-lg mb-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Название точки *</label>
                  <input
                    type="text"
                    value={newLocation.name}
                    onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                    className="input w-full"
                    placeholder="Филиал на Абая"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Адрес *</label>
                  <input
                    type="text"
                    value={newLocation.address}
                    onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })}
                    className="input w-full"
                    placeholder="г. Алматы, ул. Абая 123"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Широта *</label>
                    <input
                      type="number"
                      value={newLocation.latitude}
                      onChange={(e) => setNewLocation({ ...newLocation, latitude: e.target.value })}
                      className="input w-full"
                      placeholder="43.2350"
                      step="0.0001"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Долгота *</label>
                    <input
                      type="number"
                      value={newLocation.longitude}
                      onChange={(e) => setNewLocation({ ...newLocation, longitude: e.target.value })}
                      className="input w-full"
                      placeholder="76.9399"
                      step="0.0001"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">WhatsApp для менеджера *</label>
                  <input
                    type="tel"
                    value={newLocation.whatsapp}
                    onChange={(e) => setNewLocation({ ...newLocation, whatsapp: e.target.value })}
                    className="input w-full"
                    placeholder="+77771234567"
                    required
                  />
                </div>

                <button type="button" onClick={handleAddLocation} className="btn-primary w-full">
                  Добавить точку
                </button>
              </div>
            )}

            {loadingLocations ? (
              <div className="text-center py-8 text-gray-500">Загрузка...</div>
            ) : deliveryLocations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Не добавлено ни одной точки доставки
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-3 px-2">Название</th>
                      <th className="text-left py-3 px-2">Адрес</th>
                      <th className="text-left py-3 px-2">WhatsApp</th>
                      <th className="text-center py-3 px-2">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryLocations.map((location) => (
                      <tr key={location.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="py-3 px-2 font-medium">{location.name}</td>
                        <td className="py-3 px-2 text-sm text-gray-600">{location.address}</td>
                        <td className="py-3 px-2 text-sm">{location.whatsapp}</td>
                        <td className="py-3 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteLocation(location.id)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Удалить
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
      </div>
    </div>
  );
};

export default RestaurantSettingsPage;