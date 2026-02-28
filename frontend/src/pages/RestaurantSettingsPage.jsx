import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { restaurantService } from '../services/restaurantService';
import toast from 'react-hot-toast';
import { confirmDialog } from '../utils/confirmDialog';
import RestaurantSelector from '../components/RestaurantSelector';
import DashboardLayout from '../components/DashboardLayout';
import ThemeSwitcher from '../components/ThemeSwitcher';
import ImageWithLoader from '../components/ImageWithLoader';
import ImageUploader from '../components/ImageUploader';
import { compressImage, formatFileSize, validateImage, shouldCompress } from '../utils/imageCompression';
import { useUserData } from '../hooks/useUserData';
import { useSelectedRestaurant } from '../hooks/useSelectedRestaurant';
import { QRCodeSVG } from 'qrcode.react';
import { getBusinessType } from '../utils/businessTypes';
import MapPicker from '../components/MapPicker';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const RestaurantSettingsPage = () => {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuthStore();
  const { userData, loading, refresh: refreshUserData } = useUserData();
  const { selectedRestaurantId, setSelectedRestaurantId, selectedRestaurant, isOwner: isOwnerFlag } = useSelectedRestaurant(userData);
  const [saving, setSaving] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [currency, setCurrency] = useState('KGS');
  const [menuCardStyle, setMenuCardStyle] = useState('horizontal');
  const [primaryColor, setPrimaryColor] = useState('#374B6A');
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [deliveryRadius, setDeliveryRadius] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [bannerFile, setBannerFile] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUploadProgress, setLogoUploadProgress] = useState(0);

  // Telegram settings
  const [telegramGroupId, setTelegramGroupId] = useState('');
  const [testingTelegram, setTestingTelegram] = useState(false);

  // QR code settings
  const [qrTableCount, setQrTableCount] = useState(5);
  const qrContainerRef = useRef(null);

  // Максимальный размер файла (10MB)
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB в байтах

  // Working hours state
  const [isTemporarilyClosed, setIsTemporarilyClosed] = useState(false);
  const [closureReason, setClosureReason] = useState('');
  const [workingHours, setWorkingHours] = useState({
    monday: { open: '09:00', close: '22:00', isOpen: true, is247: false },
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
    if (userData && selectedRestaurantId) {
      const restaurant = getSelectedRestaurant();
      if (restaurant) {
        loadRestaurantData(restaurant);
      }
    }
  }, [selectedRestaurantId, userData]);

  // Обработчики выбора файлов (обновлены для работы с ImageUploader)
  const handleBannerFileSelect = (file) => {
    setBannerFile(file);
  };

  const handleLogoFileSelect = (file) => {
    setLogoFile(file);
  };

  const getSelectedRestaurant = () => selectedRestaurant;
  const isOwner = () => isOwnerFlag;
  const isInheritedSettingsRestaurant = Boolean(
    selectedRestaurant?.sharedMenuSourceRestaurantId &&
    selectedRestaurant?.sharedMenuSourceRestaurantId !== selectedRestaurantId
  );

  const loadRestaurantData = async (restaurant) => {
    console.log('📝 Loading restaurant data into form:', restaurant);
    const r = restaurant;
    setName(r.name || '');
    setDescription(r.description || '');
    setAddress(r.address || '');
    setCountry(r.country || '');
    setCity(r.city || '');
    setPhone(r.phone || '');
    setWhatsapp(r.whatsapp || '');
    setInstagram(r.instagram || '');
    setFacebook(r.facebook || '');
    setCurrency(r.currency || 'KGS');
    setMenuCardStyle(r.cardStyle || 'horizontal');
    setPrimaryColor(r.primaryColor || '#374B6A');
    setDeliveryEnabled(r.deliveryEnabled || false);
    setDeliveryFee(r.deliveryFee || '');
    setMinOrderAmount(r.minOrderAmount || '');
    setFreeDeliveryThreshold(r.freeDeliveryThreshold || '');
    setLatitude(r.latitude || '');
    setLongitude(r.longitude || '');
    setDeliveryRadius(r.deliveryRadius || '');
    setTelegramGroupId(r.telegramGroupId || '');

    // Load working hours with defaults to ensure all days are defined
    const defaultWorkingHours = {
      monday: { open: '09:00', close: '22:00', isOpen: true, is247: false },
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
    const confirmed = await confirmDialog('Удалить этот баннер?', {
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      icon: '🗑️'
    });
    if (!confirmed) return;

    try {
      await restaurantService.deleteBanner(selectedRestaurantId, bannerUrl);
      toast.success('Баннер удален');
      const restaurant = getSelectedRestaurant();
      if (restaurant) loadRestaurantData(restaurant);
    } catch (err) {
      toast.error('Ошибка при удалении баннера');
      console.error(err);
    }
  };

  const handleDeleteLogo = async () => {
    const confirmed = await confirmDialog('Удалить логотип?', {
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      icon: '🗑️'
    });
    if (!confirmed) return;

    try {
      await restaurantService.deleteLogo(selectedRestaurantId);
      toast.success('Логотип удален');
      const restaurant = getSelectedRestaurant();
      if (restaurant) loadRestaurantData(restaurant);
    } catch (err) {
      toast.error('Ошибка при удалении логотипа');
      console.error(err);
    }
  };

  const handleDeleteRestaurant = async () => {
    const restaurant = getSelectedRestaurant();
    if (!restaurant) return;

    const confirmText = `Вы уверены, что хотите УДАЛИТЬ ресторан "${restaurant.name}"?`;
    const confirmText2 = 'Это действие НЕОБРАТИМО! Все данные (меню, категории, блюда, модификаторы) будут удалены навсегда.';

    const confirmed = await confirmDialog(`${confirmText}\n\n${confirmText2}`, {
      confirmText: 'Удалить навсегда',
      cancelText: 'Отмена',
      icon: '⚠️',
      duration: 10000
    });

    if (!confirmed) {
      return;
    }

    // Дополнительное подтверждение
    const finalConfirm = prompt(`Введите название ресторана "${restaurant.name}" для подтверждения удаления:`);
    if (finalConfirm !== restaurant.name) {
      toast.error('Название не совпадает. Удаление отменено.');
      return;
    }

    try {
      setSaving(true);
      await restaurantService.deleteRestaurant(selectedRestaurantId);
      toast.success('Ресторан успешно удален');
      // Обновляем данные и переходим на dashboard
      await refreshUserData();
      navigate('/dashboard');
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data?.error || 'Ошибка при удалении ресторана';
      toast.error(errorMsg);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!telegramGroupId) {
      toast.error('Введите ID группы Telegram');
      return;
    }

    if (!selectedRestaurantId) {
      toast.error('Выберите ресторан');
      return;
    }

    setTestingTelegram(true);
    try {
      // Get token from auth-storage
      const authStorage = localStorage.getItem('auth-storage');
      const token = authStorage ? JSON.parse(authStorage).state.token : null;

      const response = await fetch(`${API_URL}/restaurants/${selectedRestaurantId}/telegram/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ chatId: telegramGroupId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка подключения');
      }

      toast.success('✅ Подключение успешно! Проверьте Telegram группу.');
    } catch (err) {
      toast.error(err.message || 'Ошибка при тестировании подключения');
      console.error(err);
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const currentRestaurantId = selectedRestaurantId;

    try {
      const data = {
        name,
        address,
        phone,
        whatsapp,
        instagram,
        facebook,
        deliveryEnabled,
        deliveryFee: deliveryFee ? parseFloat(deliveryFee) : null,
        minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : null,
        freeDeliveryThreshold: freeDeliveryThreshold ? parseFloat(freeDeliveryThreshold) : null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        deliveryRadius: deliveryRadius ? parseFloat(deliveryRadius) : null,
        workingHours,
        isTemporarilyClosed,
        closureReason: isTemporarilyClosed ? closureReason : null,
        telegramGroupId: telegramGroupId || null,
      };

      if (!isInheritedSettingsRestaurant) {
        data.description = description;
        data.country = country || null;
        data.city = city || null;
        data.currency = currency;
        data.menuCardStyle = menuCardStyle;
        data.primaryColor = primaryColor || null;
      }

      await restaurantService.updateRestaurant(selectedRestaurantId, data);

      // Upload logo if selected
      if (logoFile && !isInheritedSettingsRestaurant) {
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
      if (bannerFile && !isInheritedSettingsRestaurant) {
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

      toast.success('Настройки сохранены!');
      await refreshUserData();

      // Сохраняем выбранный ресторан после refresh, чтобы не перескакивало на главный
      if (currentRestaurantId) {
        setSelectedRestaurantId(currentRestaurantId);
      }
    } catch (err) {
      toast.error('Ошибка при сохранении настроек');
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
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Настройки ресторана</h1>
          <p className="text-gray-500 text-sm mt-1">Основные параметры и внешний вид</p>
        </div>

        {/* Restaurant Selector */}
        {userData && (
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">Выберите ресторан</label>
            <RestaurantSelector
              userData={userData}
              selectedRestaurantId={selectedRestaurantId}
              onSelectRestaurant={(id) => {
                setSelectedRestaurantId(id);
                localStorage.setItem('selectedRestaurantId', id);
              }}
            />
          </div>
        )}

        {selectedRestaurantId && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {isInheritedSettingsRestaurant
              ? 'Часть настроек (описание, страна/город, валюта, логотип, баннеры, тема и стиль карточек) наследуется от главного ресторана и недоступна для изменения в филиале.'
              : 'Вы редактируете главный ресторан. Все настройки доступны.'}
          </div>
        )}

        {selectedRestaurantId && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
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
                    placeholder="Например: Краткое описание вашего ресторана"
                    disabled={isInheritedSettingsRestaurant}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Страна и город</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="input w-full"
                      disabled={isInheritedSettingsRestaurant}
                    >
                      <option value="">Выберите страну</option>
                      <option value="Кыргызстан">🇰🇬 Кыргызстан</option>
                      <option value="Турция">🇹🇷 Турция</option>
                      <option value="Казахстан">🇰🇿 Казахстан</option>
                      <option value="Узбекистан">🇺🇿 Узбекистан</option>
                      <option value="Россия">🇷🇺 Россия</option>
                      <option value="Таджикистан">🇹🇯 Таджикистан</option>
                    </select>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="input w-full"
                      placeholder="Город"
                      disabled={isInheritedSettingsRestaurant}
                    />
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Используется для автодополнения адресов доставки
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Адрес</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="input w-full"
                    placeholder="Например: ул. Абая 123"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Телефон</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input w-full"
                    placeholder="Например: +7 (777) 123-45-67"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Валюта</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="input w-full"
                    disabled={isInheritedSettingsRestaurant}
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
                    disabled={isInheritedSettingsRestaurant}
                  >
                    <option value="horizontal">Горизонтальный (фото слева)</option>
                    <option value="vertical">Вертикальный (фото сверху)</option>
                    <option value="grid">Сетка 2 колонки (компактный)</option>
                    <option value="gallery">Галерея 2 колонки (минимальные отступы)</option>
                  </select>
                  <p className="text-sm text-gray-500 mt-1">
                    Выберите, как будут отображаться карточки блюд в публичном меню
                  </p>
                </div>
              </div>
            </div>

            {/* Logo */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-xl font-bold mb-4">Логотип ресторана</h2>

              {getSelectedRestaurant()?.logo ? (
                /* Compact view when logo exists */
                <div>
                  <div className="flex items-center gap-4">
                    <div className="relative group flex-shrink-0">
                      <img
                        src={getSelectedRestaurant().logo}
                        alt="Логотип"
                        className="w-20 h-20 object-contain rounded-lg border border-gray-200 bg-white p-1.5"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        ref={(el) => { if (el) el._logoInput = true; }}
                        className="hidden"
                        id="logo-replace-input"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          const validation = validateImage(file, { maxSizeMB: 10 });
                          if (!validation.valid) { toast.error(validation.error); return; }
                          if (shouldCompress(file, 0.5)) {
                            try {
                              const compressed = await compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.9, maxSizeMB: 0.5 });
                              toast.success(`Сжато: ${formatFileSize(file.size)} → ${formatFileSize(compressed.size)}`);
                              handleLogoFileSelect(compressed);
                            } catch { handleLogoFileSelect(file); }
                          } else { handleLogoFileSelect(file); }
                          e.target.value = '';
                        }}
                      />
                      {!uploadingLogo ? (
                        <>
                          <button
                            type="button"
                            onClick={() => document.getElementById('logo-replace-input').click()}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                            disabled={isInheritedSettingsRestaurant}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                            </svg>
                            Заменить
                          </button>
                          <button
                            type="button"
                            onClick={handleDeleteLogo}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                            disabled={isInheritedSettingsRestaurant}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Удалить
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-32 bg-blue-200 rounded-full h-2">
                            <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${logoUploadProgress}%` }}></div>
                          </div>
                          <span className="text-sm text-blue-600 font-bold">{logoUploadProgress}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Full uploader when no logo */
                <div>
                  {!uploadingLogo ? (
                    <ImageUploader
                      onFileSelect={handleLogoFileSelect}
                      maxSizeMB={10}
                      compressOptions={{
                        maxWidth: 800,
                        maxHeight: 800,
                        quality: 0.9,
                        maxSizeMB: 0.5
                      }}
                      label="Загрузите логотип"
                      showPreview={true}
                      currentImage={null}
                      disabled={uploadingLogo || isInheritedSettingsRestaurant}
                    />
                  ) : (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-blue-600 font-medium">Загрузка...</span>
                        <span className="text-sm text-blue-600 font-bold">{logoUploadProgress}%</span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${logoUploadProgress}%` }}></div>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1.5">200×200 px, авто-сжатие до 0.5 МБ</p>
                </div>
              )}
            </div>

            {/* Banner */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-xl font-bold mb-4">Баннеры</h2>

              {getSelectedRestaurant()?.banners && getSelectedRestaurant().banners.length > 0 ? (
                /* Compact view when banners exist */
                <div>
                  <div className="flex items-start gap-4">
                    <div className="flex gap-3 flex-wrap flex-1">
                      {getSelectedRestaurant().banners.map((banner, index) => (
                        <div key={index} className="relative group flex-shrink-0">
                          <ImageWithLoader
                            src={banner}
                            alt={`Banner ${index + 1}`}
                            className="w-28 h-16 object-cover rounded-lg border border-gray-200"
                            loading="lazy"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteBanner(banner);
                            }}
                            className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-lg transition-all opacity-0 group-hover:opacity-100"
                            title="Удалить баннер"
                            disabled={isInheritedSettingsRestaurant}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id="banner-add-input"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          const validation = validateImage(file, { maxSizeMB: 10 });
                          if (!validation.valid) { toast.error(validation.error); return; }
                          if (shouldCompress(file, 1)) {
                            try {
                              const compressed = await compressImage(file, { maxWidth: 1920, maxHeight: 800, quality: 0.85, maxSizeMB: 1 });
                              toast.success(`Сжато: ${formatFileSize(file.size)} → ${formatFileSize(compressed.size)}`);
                              handleBannerFileSelect(compressed);
                            } catch { handleBannerFileSelect(file); }
                          } else { handleBannerFileSelect(file); }
                          e.target.value = '';
                        }}
                      />
                      {!uploadingBanner ? (
                        <button
                          type="button"
                          onClick={() => document.getElementById('banner-add-input').click()}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                          disabled={isInheritedSettingsRestaurant}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                          Добавить
                        </button>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-32 bg-blue-200 rounded-full h-2">
                            <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                          </div>
                          <span className="text-sm text-blue-600 font-bold">{uploadProgress}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Full uploader when no banners */
                <div>
                  {!uploadingBanner ? (
                    <ImageUploader
                      onFileSelect={handleBannerFileSelect}
                      maxSizeMB={10}
                      compressOptions={{
                        maxWidth: 1920,
                        maxHeight: 800,
                        quality: 0.85,
                        maxSizeMB: 1
                      }}
                      label="Загрузите баннер"
                      showPreview={true}
                      disabled={uploadingBanner || isInheritedSettingsRestaurant}
                    />
                  ) : (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-blue-600 font-medium">Загрузка...</span>
                        <span className="text-sm text-blue-600 font-bold">{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1.5">1200×400 px, авто-сжатие до 1 МБ</p>
                </div>
              )}
            </div>

            {/* Тема оформления */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-xl font-bold mb-2">Тема оформления меню</h2>
              <p className="text-sm text-gray-600 mb-4">Выберите цветовую гамму для клиентского меню.</p>

              <div className="flex flex-wrap items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700">Основной цвет</label>
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-12 border border-gray-200 rounded cursor-pointer bg-white"
                    aria-label="Основной цвет меню"
                    disabled={isInheritedSettingsRestaurant}
                  />
                  <span className="text-sm font-mono text-gray-700">{primaryColor}</span>
                </div>
                <p className="text-xs text-gray-500">Цвет сохранится для этого ресторана и будет применяться в меню.</p>
              </div>

              <ThemeSwitcher inline />
              <ThemeSwitcher inline />
              <p className="text-xs text-gray-500 mt-3">Переключатель ниже используется для предпросмотра темы на этом устройстве.</p>
            </div>

            {/* Social Media */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-xl font-bold mb-4">Социальные сети</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">WhatsApp</label>
                  <input
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="input w-full"
                    placeholder="Например: +77771234567"
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
                    placeholder="Например: @your_restaurant"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Facebook</label>
                  <input
                    type="text"
                    value={facebook}
                    onChange={(e) => setFacebook(e.target.value)}
                    className="input w-full"
                    placeholder="Например: facebook.com/your-restaurant"
                  />
                </div>
              </div>
            </div>

            {/* Delivery Settings */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
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

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Бесплатная доставка от ({currency})
                      </label>
                      <input
                        type="number"
                        value={freeDeliveryThreshold}
                        onChange={(e) => setFreeDeliveryThreshold(e.target.value)}
                        className="input w-full"
                        step="0.01"
                        placeholder="3000"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Если сумма заказа больше или равна этой суммы — доставка бесплатная
                      </p>
                    </div>

                    <div className="border-t pt-4">
                      <h3 className="font-medium mb-3">📍 Геолокация и зона доставки</h3>

                      {/* Кнопки управления */}
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        <button
                          type="button"
                          onClick={async () => {
                            const fullAddress = [city, address, country].filter(Boolean).join(', ');
                            if (!fullAddress || (!address && !city)) {
                              toast.error('Укажите адрес и город в основной информации');
                              return;
                            }
                            setGeocoding(true);
                            try {
                              const resp = await fetch(`${API_URL}/geolocation/geocode?address=${encodeURIComponent(fullAddress)}`);
                              const data = await resp.json();
                              if (data.found) {
                                setLatitude(data.latitude);
                                setLongitude(data.longitude);
                                toast.success(`Координаты определены: ${data.formattedAddress}`);
                              } else {
                                toast.error('Не удалось определить координаты. Проверьте адрес.');
                              }
                            } catch (err) {
                              console.error('Geocode error:', err);
                              toast.error('Ошибка при определении координат');
                            } finally {
                              setGeocoding(false);
                            }
                          }}
                          className="btn-primary text-sm py-2 px-4 flex items-center gap-2"
                          disabled={geocoding}
                        >
                          {geocoding ? (
                            <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Определяем...</>
                          ) : (
                            <>📍 Определить по адресу</>
                          )}
                        </button>
                        {latitude && longitude && (
                          <button
                            type="button"
                            onClick={() => {
                              setLatitude('');
                              setLongitude('');
                              toast.success('Координаты удалены');
                            }}
                            className="text-sm py-2 px-3 text-red-600 hover:bg-red-50 rounded-lg border border-red-200 flex items-center gap-1"
                          >
                            ✕ Удалить
                          </button>
                        )}
                        {latitude && longitude && (
                          <span className="text-sm text-green-600 font-medium">
                            ✅ {Number(latitude).toFixed(6)}, {Number(longitude).toFixed(6)}
                          </span>
                        )}
                      </div>

                      {/* Интерактивная карта */}
                      <div className="mb-4">
                        <p className="text-sm text-gray-500 mb-2">Кликните на карте чтобы указать точку вручную</p>
                        <MapPicker
                          latitude={latitude}
                          longitude={longitude}
                          radius={deliveryRadius}
                          onChange={(lat, lng) => {
                            setLatitude(lat);
                            setLongitude(lng);
                          }}
                        />
                      </div>

                      <div>
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
                          Максимальное расстояние доставки от вашего ресторана. Зона показана на карте.
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Telegram Notifications */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-xl font-bold mb-4">Уведомления Telegram</h2>

              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-semibold text-blue-900 mb-2">Как настроить уведомления:</h3>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Создайте группу в Telegram</li>
                    <li>Добавьте бота <strong>@OimoQR_bot</strong> в группу</li>
                    <li>Отправьте команду <code className="bg-blue-100 px-1 rounded">/getid</code> в группе</li>
                    <li>Скопируйте ID группы и вставьте ниже</li>
                    <li>Нажмите "Проверить подключение"</li>
                  </ol>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">ID группы Telegram</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={telegramGroupId}
                      onChange={(e) => setTelegramGroupId(e.target.value)}
                      className="input flex-1"
                      placeholder="-1001234567890"
                    />
                    <button
                      type="button"
                      onClick={handleTestTelegram}
                      disabled={testingTelegram || !telegramGroupId}
                      className="px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors text-sm whitespace-nowrap"
                    >
                      {testingTelegram ? '⏳ Проверка...' : '✓ Проверить'}
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    После настройки вы будете получать уведомления о новых заказах в Telegram группу
                  </p>
                </div>
              </div>
            </div>

            {/* QR Codes */}
            {getSelectedRestaurant()?.subdomain && (() => {
              const bt = getBusinessType(getSelectedRestaurant()?.businessType);
              return (
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <h2 className="text-xl font-bold mb-2">QR-коды</h2>
                  <p className="text-sm text-gray-600 mb-5">
                    {bt.qrDescription}
                  </p>

                  {/* General QR */}
                  <div className={`flex items-center gap-5 p-4 border border-gray-200 rounded-xl ${bt.hasTableQR ? 'mb-6' : ''}`}>
                    <QRCodeSVG
                      value={`${window.location.origin}/${bt.route}/${getSelectedRestaurant().subdomain}`}
                      size={140}
                      level="M"
                      includeMargin={false}
                      className="flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg text-gray-900 mb-1">
                        {bt.qrMainTitle}
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">
                        {bt.qrMainDescription}
                      </p>

                      <button
                        type="button"
                        onClick={() => {
                          const url = `${window.location.origin}/${bt.route}/${getSelectedRestaurant().subdomain}`;
                          const printWindow = window.open('', '_blank');
                          const svgEl = document.getElementById('general-qr-svg');
                          printWindow.document.write(`
                        <html><head><title>QR — ${getSelectedRestaurant().name}</title>
                        <style>
                          body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
                          .card { text-align: center; padding: 40px; }
                          .card h2 { margin: 20px 0 8px; font-size: 24px; }
                          .card p { margin: 0; color: #6b7280; font-size: 14px; }
                        </style></head><body>
                        <div class="card">
                          ${svgEl?.outerHTML || ''}
                          <h2>${getSelectedRestaurant().name}</h2>
                          <p>Отсканируйте для ${bt.qrScanLabel}</p>
                        </div>
                        </body></html>
                      `);
                          printWindow.document.close();
                          printWindow.focus();
                          setTimeout(() => { printWindow.print(); }, 300);
                        }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 12h.008v.008h-.008V12zm-2.25 0h.008v.008H16.5V12z" />
                        </svg>
                        Печать
                      </button>
                    </div>
                    <QRCodeSVG
                      id="general-qr-svg"
                      value={`${window.location.origin}/${bt.route}/${getSelectedRestaurant().subdomain}`}
                      size={200}
                      level="M"
                      className="hidden"
                    />
                  </div>

                  {/* Table/Room QR Codes — only when hasTableQR */}
                  {bt.hasTableQR && (<>
                    {/* Table QR Codes */}
                    <h3 className="font-semibold text-gray-900 mb-3">QR-коды по столам</h3>
                    <p className="text-sm text-gray-600 mb-3">Каждый QR привязан к номеру стола — заказ клиента сразу покажет стол.</p>

                    <div className="flex items-center gap-3 mb-4">
                      <label className="text-sm font-medium text-gray-700">Количество столов:</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={qrTableCount}
                        onChange={(e) => setQrTableCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                        className="input w-20 text-center"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const container = qrContainerRef.current;
                          if (!container) return;
                          const printWindow = window.open('', '_blank');
                          printWindow.document.write(`
                      <html><head><title>QR коды — ${getSelectedRestaurant().name}</title>
                      <style>
                        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
                        .card { border: 2px solid #e5e7eb; border-radius: 12px; padding: 20px; text-align: center; page-break-inside: avoid; }
                        .card h3 { margin: 12px 0 4px; font-size: 18px; }
                        @media print { .grid { grid-template-columns: repeat(3, 1fr); } }
                      </style></head><body>
                      <div class="grid">${container.innerHTML}</div>
                      </body></html>
                    `);
                          printWindow.document.close();
                          printWindow.focus();
                          setTimeout(() => { printWindow.print(); }, 300);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 12h.008v.008h-.008V12zm-2.25 0h.008v.008H16.5V12z" />
                        </svg>
                        Печать
                      </button>
                    </div>

                    <div ref={qrContainerRef} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {Array.from({ length: qrTableCount }, (_, i) => i + 1).map(tableNum => {
                        const menuUrl = `${window.location.origin}/menu/${getSelectedRestaurant().subdomain}?table=${tableNum}`;
                        return (
                          <div key={tableNum} className="card border border-gray-200 rounded-xl p-4 text-center hover:shadow-md transition-shadow">
                            <QRCodeSVG
                              value={menuUrl}
                              size={120}
                              level="M"
                              includeMargin={false}
                              className="mx-auto"
                            />
                            <h3 className="font-bold text-lg mt-3 text-gray-900">{bt.tableLabel} {tableNum}</h3>
                          </div>
                        );
                      })}
                    </div>
                  </>)}

                </div>
              );
            })()}

            {/* Working Hours */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-xl font-bold mb-4">Режим работы</h2>

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
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`${day}-is247`}
                          checked={workingHours[day].is247 || false}
                          onChange={(e) => setWorkingHours({
                            ...workingHours,
                            [day]: { ...workingHours[day], is247: e.target.checked }
                          })}
                          className="w-4 h-4"
                        />
                        <label htmlFor={`${day}-is247`} className="text-sm text-gray-600">Круглосуточно</label>
                      </div>
                    )}

                    {workingHours[day].isOpen && !workingHours[day].is247 && (
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
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors text-sm font-medium"
                disabled={saving || uploadingBanner}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                disabled={saving || uploadingBanner}
              >
                {uploadingBanner ? 'Загрузка баннера...' : saving ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
            </div>
          </form>
        )}

        {/* Danger Zone - Delete Restaurant - только для владельцев */}
        {
          isOwner() && (
            <div className="bg-red-50 rounded-xl border-2 border-red-200 p-5 mt-8">
              <h2 className="text-xl font-bold text-red-600 mb-2">Опасная зона</h2>
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
          )
        }
      </div >
    </DashboardLayout >
  );
};

export default RestaurantSettingsPage;