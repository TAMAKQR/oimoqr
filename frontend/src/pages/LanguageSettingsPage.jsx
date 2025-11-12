import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import DashboardLayout from '../components/DashboardLayout';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const AVAILABLE_LANGUAGES = [
  { code: 'ru', name: '🇷🇺 Русский', label: 'Russian' },
  { code: 'en', name: '🇬🇧 English', label: 'English' },
  { code: 'kg', name: '🇰🇬 Kyrgyz', label: 'Kyrgyz' },
  { code: 'tr', name: '🇹🇷 Türkçe', label: 'Turkish' }
];

const LanguageSettingsPage = () => {
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const [userData, setUserData] = useState(null);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);
  const [restaurantLanguages, setRestaurantLanguages] = useState([]);
  const [defaultLanguage, setDefaultLanguage] = useState('ru');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedLang, setDraggedLang] = useState(null);
  const [dishes, setDishes] = useState([]);
  const [selectedDish, setSelectedDish] = useState(null);
  const [translations, setTranslations] = useState([]);
  const [editingTranslation, setEditingTranslation] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryTranslations, setCategoryTranslations] = useState([]);
  const [activeTab, setActiveTab] = useState('languages');
  const [translationType, setTranslationType] = useState('dishes'); // 'dishes' or 'categories'

  // Load user data
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const data = await authService.getMe();
      setUserData(data);
    } catch (err) {
      console.error('Error loading user data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-select first restaurant when userData is loaded
  useEffect(() => {
    if (userData && !selectedRestaurantId && (userData.restaurants?.length > 0 || userData.restaurantStaff?.length > 0)) {
      const allRestaurants = [
        ...(userData.restaurants || []),
        ...(userData.restaurantStaff?.map(s => s.restaurant) || [])
      ];
      if (allRestaurants.length > 0) {
        setSelectedRestaurantId(allRestaurants[0].id);
      }
    }
  }, [userData]);

  useEffect(() => {
    if (selectedRestaurantId) {
      setLoading(true);
      loadLanguages();
      loadDishes();
      loadCategories();
    }
  }, [selectedRestaurantId]);

  useEffect(() => {
    if (selectedDish && selectedRestaurantId) {
      loadTranslations();
    }
  }, [selectedDish, selectedRestaurantId]);

  useEffect(() => {
    if (selectedCategory && selectedRestaurantId) {
      loadCategoryTranslations();
    }
  }, [selectedCategory, selectedRestaurantId]);

  const loadLanguages = async () => {
    try {
      const response = await fetch(`${API_URL}/languages/restaurants/${selectedRestaurantId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load languages: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Handle new response format with languages and defaultLanguage
      if (data.languages && Array.isArray(data.languages)) {
        setRestaurantLanguages(data.languages);
        setDefaultLanguage(data.defaultLanguage || 'ru');
      } else {
        // Fallback for old format
        setRestaurantLanguages(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error loading languages:', err);
      setRestaurantLanguages([]);
      if (err.message.includes('401')) {
        alert('Сессия истекла. Пожалуйста, войдите снова.');
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadDishes = async () => {
    try {
      const response = await fetch(`${API_URL}/restaurants/${selectedRestaurantId}/dishes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load dishes: ${response.status}`);
      }
      
      const data = await response.json();
      setDishes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading dishes:', err);
      setDishes([]);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await fetch(
        `${API_URL}/restaurants/${selectedRestaurantId}/categories-list`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (!response.ok) {
        if (response.status === 401) {
          navigate('/login');
          return;
        }
        throw new Error('Failed to load categories');
      }

      const data = await response.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading categories:', err);
      setCategories([]);
    }
  };

  const loadTranslations = async () => {
    try {
      const response = await fetch(
        `${API_URL}/languages/restaurants/${selectedRestaurantId}/dishes/${selectedDish}/translations`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      setTranslations(data || []);
    } catch (err) {
      console.error('Error loading translations:', err);
    }
  };

  const loadCategoryTranslations = async () => {
    try {
      const response = await fetch(
        `${API_URL}/languages/restaurants/${selectedRestaurantId}/categories/${selectedCategory}/translations`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      setCategoryTranslations(data || []);
    } catch (err) {
      console.error('Error loading category translations:', err);
    }
  };

  const toggleLanguage = (code) => {
    const existing = restaurantLanguages.find(l => l.languageCode === code);
    if (existing) {
      setRestaurantLanguages(restaurantLanguages.filter(l => l.languageCode !== code));
    } else {
      setRestaurantLanguages([
        ...restaurantLanguages,
        { languageCode: code, isEnabled: true, order: restaurantLanguages.length }
      ]);
    }
  };

  const handleDragStart = (lang) => {
    setDraggedLang(lang);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (targetLang) => {
    if (!draggedLang || draggedLang.languageCode === targetLang.languageCode) return;

    const draggedIdx = restaurantLanguages.findIndex(l => l.languageCode === draggedLang.languageCode);
    const targetIdx = restaurantLanguages.findIndex(l => l.languageCode === targetLang.languageCode);

    const newLanguages = [...restaurantLanguages];
    [newLanguages[draggedIdx], newLanguages[targetIdx]] = [newLanguages[targetIdx], newLanguages[draggedIdx]];

    setRestaurantLanguages(newLanguages.map((lang, i) => ({ ...lang, order: i })));
    setDraggedLang(null);
  };

  const saveLanguages = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/languages/restaurants/${selectedRestaurantId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          languages: restaurantLanguages,
          defaultLanguage: defaultLanguage
        })
      });

      if (!response.ok) throw new Error('Failed to save languages');
      alert('Языки сохранены успешно!');
      loadLanguages();
    } catch (err) {
      alert('Ошибка при сохранении языков');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const saveTranslation = async (translation) => {
    try {
      const response = await fetch(
        `${API_URL}/languages/restaurants/${selectedRestaurantId}/dishes/${selectedDish}/translations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(translation)
        }
      );

      if (!response.ok) throw new Error('Failed to save translation');
      alert('Перевод сохранен!');
      setEditingTranslation(null);
      loadTranslations();
    } catch (err) {
      alert('Ошибка при сохранении перевода');
      console.error(err);
    }
  };

  const saveCategoryTranslation = async (translation) => {
    try {
      const response = await fetch(
        `${API_URL}/languages/restaurants/${selectedRestaurantId}/categories/${selectedCategory}/translations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(translation)
        }
      );

      if (!response.ok) throw new Error('Failed to save category translation');
      alert('Перевод категории сохранен!');
      setEditingTranslation(null);
      loadCategoryTranslations();
    } catch (err) {
      alert('Ошибка при сохранении перевода категории');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Загрузка...</div>
      </div>
    );
  }

  const allRestaurants = [
    ...(userData?.restaurants || []),
    ...(userData?.restaurantStaff?.map(s => s.restaurant) || [])
  ];

  if (!userData || allRestaurants.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600 mb-4">У вас нет ресторанов</p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary">
            На главную
          </button>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout userData={userData} selectedRestaurantId={selectedRestaurantId}>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6">Управление языками</h1>

        {allRestaurants.length > 1 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Выберите ресторан</label>
            <select
              value={selectedRestaurantId || ''}
              onChange={(e) => setSelectedRestaurantId(e.target.value)}
              className="input w-full"
            >
              <option value="">Выберите ресторан</option>
              {allRestaurants.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        )}

        {selectedRestaurantId && (
          <div>
          <div className="tabs flex gap-4 mb-6 border-b">
            <button
              onClick={() => setActiveTab('languages')}
              className={`px-4 py-2 font-medium ${
                activeTab === 'languages'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Языки ресторана
            </button>
            <button
              onClick={() => setActiveTab('translations')}
              className={`px-4 py-2 font-medium ${
                activeTab === 'translations'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Переводы
            </button>
          </div>

          {/* Languages Tab */}
          {activeTab === 'languages' && (
            <div className="space-y-6">
              <div className="card">
                <h2 className="text-xl font-bold mb-4">Доступные языки</h2>
                <div className="space-y-3">
                  {AVAILABLE_LANGUAGES.map(lang => (
                    <label key={lang.code} className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={restaurantLanguages.some(l => l.languageCode === lang.code)}
                        onChange={() => toggleLanguage(lang.code)}
                        className="w-5 h-5 rounded border-gray-300"
                      />
                      <span className="text-lg">{lang.name}</span>
                      <span className="text-gray-500 ml-auto">{lang.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {restaurantLanguages.length > 0 && (
                <>
                  <div className="card">
                    <h2 className="text-xl font-bold mb-4">Порядок языков (перетаскивайте для переупорядочения)</h2>
                    <div className="space-y-2">
                      {restaurantLanguages.map(lang => {
                        const langInfo = AVAILABLE_LANGUAGES.find(l => l.code === lang.languageCode);
                        return (
                          <div
                            key={lang.languageCode}
                            draggable
                            onDragStart={() => handleDragStart(lang)}
                            onDragOver={handleDragOver}
                            onDrop={() => handleDrop(lang)}
                            className="p-3 bg-white border rounded cursor-move hover:bg-gray-50 flex items-center gap-3"
                          >
                            <span className="text-lg">⋮⋮</span>
                            <span className="text-lg">{langInfo?.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="card">
                    <h2 className="text-xl font-bold mb-4">Язык по умолчанию в QR меню</h2>
                    <p className="text-gray-600 mb-4">Выберите язык, который будет отображаться при первом открытии меню</p>
                    <select
                      value={defaultLanguage}
                      onChange={(e) => setDefaultLanguage(e.target.value)}
                      className="input w-full"
                    >
                      {AVAILABLE_LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <button
                onClick={saveLanguages}
                disabled={saving}
                className="btn-primary w-full"
              >
                {saving ? 'Сохранение...' : 'Сохранить языки'}
              </button>
            </div>
          )}

          {/* Translations Tab */}
          {activeTab === 'translations' && (
            <div className="space-y-6">
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => {
                    setTranslationType('dishes');
                    setSelectedDish(null);
                    setEditingTranslation(null);
                  }}
                  className={`px-4 py-2 rounded ${
                    translationType === 'dishes'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Блюда
                </button>
                <button
                  onClick={() => {
                    setTranslationType('categories');
                    setSelectedCategory(null);
                    setEditingTranslation(null);
                  }}
                  className={`px-4 py-2 rounded ${
                    translationType === 'categories'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Категории
                </button>
              </div>

              {translationType === 'dishes' && (
                <>
                  <div className="card">
                    <h2 className="text-xl font-bold mb-4">Выберите блюдо для перевода</h2>
                    <select
                      value={selectedDish || ''}
                      onChange={(e) => setSelectedDish(e.target.value)}
                      className="input w-full"
                    >
                      <option value="">Выберите блюдо</option>
                      {dishes.map(dish => (
                        <option key={dish.id} value={dish.id}>{dish.name}</option>
                      ))}
                    </select>
                  </div>

                  {selectedDish && (
                <div className="space-y-4">
                  {restaurantLanguages.filter(lang => lang.languageCode !== 'ru').map(lang => {
                    const langInfo = AVAILABLE_LANGUAGES.find(l => l.code === lang.languageCode);
                    const translation = translations.find(t => t.languageCode === lang.languageCode);
                    const isEditing = editingTranslation?.languageCode === lang.languageCode;

                    return (
                      <div key={lang.languageCode} className="card">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-semibold">{langInfo?.name}</h3>
                          {!isEditing && (
                            <button
                              onClick={() => setEditingTranslation({ languageCode: lang.languageCode, name: translation?.name || '', description: translation?.description || '' })}
                              className="text-primary-600 hover:text-primary-700"
                            >
                              Редактировать
                            </button>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium mb-1">Название</label>
                              <input
                                type="text"
                                value={editingTranslation.name}
                                onChange={(e) => setEditingTranslation({ ...editingTranslation, name: e.target.value })}
                                className="input w-full"
                                placeholder="Название блюда"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Описание</label>
                              <textarea
                                value={editingTranslation.description || ''}
                                onChange={(e) => setEditingTranslation({ ...editingTranslation, description: e.target.value })}
                                className="input w-full"
                                rows="3"
                                placeholder="Описание блюда"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveTranslation(editingTranslation)}
                                className="btn-primary flex-1"
                              >
                                Сохранить
                              </button>
                              <button
                                onClick={() => setEditingTranslation(null)}
                                className="btn-secondary flex-1"
                              >
                                Отмена
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-gray-700 space-y-1">
                            <p><span className="font-medium">Название:</span> {translation?.name || '—'}</p>
                            <p><span className="font-medium">Описание:</span> {translation?.description || '—'}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
                </>
              )}

              {translationType === 'categories' && (
                <>
                  <div className="card">
                    <h2 className="text-xl font-bold mb-4">Выберите категорию для перевода</h2>
                    <select
                      value={selectedCategory || ''}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="input w-full"
                    >
                      <option value="">Выберите категорию</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </div>

                  {selectedCategory && (
                    <div className="space-y-4">
                      {restaurantLanguages.filter(lang => lang.languageCode !== 'ru').map(lang => {
                        const langInfo = AVAILABLE_LANGUAGES.find(l => l.code === lang.languageCode);
                        const translation = categoryTranslations.find(t => t.languageCode === lang.languageCode);
                        const isEditing = editingTranslation?.languageCode === lang.languageCode;

                        return (
                          <div key={lang.languageCode} className="card">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-lg font-semibold">{langInfo?.name}</h3>
                              {!isEditing && (
                                <button
                                  onClick={() => setEditingTranslation({ languageCode: lang.languageCode, name: translation?.name || '', description: translation?.description || '' })}
                                  className="text-primary-600 hover:text-primary-700"
                                >
                                  Редактировать
                                </button>
                              )}
                            </div>

                            {isEditing ? (
                              <div className="space-y-3">
                                <div>
                                  <label className="block text-sm font-medium mb-1">Название</label>
                                  <input
                                    type="text"
                                    value={editingTranslation.name}
                                    onChange={(e) => setEditingTranslation({ ...editingTranslation, name: e.target.value })}
                                    className="input w-full"
                                    placeholder="Название категории"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium mb-1">Описание</label>
                                  <textarea
                                    value={editingTranslation.description || ''}
                                    onChange={(e) => setEditingTranslation({ ...editingTranslation, description: e.target.value })}
                                    className="input w-full"
                                    rows="3"
                                    placeholder="Описание категории"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => saveCategoryTranslation(editingTranslation)}
                                    className="btn-primary flex-1"
                                  >
                                    Сохранить
                                  </button>
                                  <button
                                    onClick={() => setEditingTranslation(null)}
                                    className="btn-secondary flex-1"
                                  >
                                    Отмена
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="text-gray-700 space-y-1">
                                <p><span className="font-medium">Название:</span> {translation?.name || '—'}</p>
                                <p><span className="font-medium">Описание:</span> {translation?.description || '—'}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default LanguageSettingsPage;
