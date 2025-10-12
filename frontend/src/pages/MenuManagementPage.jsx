import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { menuService } from '../services/menuService';

const MenuManagementPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [userData, setUserData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [dishes, setDishes] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDishModal, setShowDishModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingDish, setEditingDish] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [currency, setCurrency] = useState('₽');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await authService.getMe();
      setUserData(data);
      if (data.restaurant) {
        setCurrency(data.restaurant.currency || '₽');
        await loadCategories(data.restaurant.id);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async (restaurantId) => {
    try {
      const cats = await menuService.getCategories(restaurantId);
      setCategories(cats);
      
      // Extract dishes from categories (they're already included in the response)
      const dishesData = {};
      for (const cat of cats) {
        dishesData[cat.id] = cat.dishes || [];
      }
      setDishes(dishesData);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleCategory = (categoryId) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const handleAddCategory = () => {
    setEditingCategory(null);
    setShowCategoryModal(true);
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setShowCategoryModal(true);
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!confirm('Удалить категорию и все блюда в ней?')) return;
    
    try {
      await menuService.deleteCategory(categoryId);
      await loadCategories(userData.restaurant.id);
    } catch (err) {
      alert('Ошибка при удалении категории');
      console.error(err);
    }
  };

  const handleAddDish = (categoryId) => {
    setSelectedCategoryId(categoryId);
    setEditingDish(null);
    setShowDishModal(true);
  };

  const handleEditDish = (dish) => {
    setSelectedCategoryId(dish.categoryId);
    setEditingDish(dish);
    setShowDishModal(true);
  };

  const handleDeleteDish = async (dishId) => {
    if (!confirm('Удалить блюдо?')) return;
    
    try {
      await menuService.deleteDish(dishId);
      await loadCategories(userData.restaurant.id);
    } catch (err) {
      alert('Ошибка при удалении блюда');
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="text-gray-600 hover:text-gray-900">
              ← Назад
            </button>
            <h1 className="text-2xl font-bold text-primary-600">Управление меню</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">{user?.name}</span>
            <button onClick={handleLogout} className="btn-secondary">
              Выход
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Add Category Button */}
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold">Категории и блюда</h2>
          <button onClick={handleAddCategory} className="btn-primary">
            + Добавить категорию
          </button>
        </div>

        {/* Categories List */}
        {categories.length === 0 ? (
          <div className="card text-center py-12">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-xl font-semibold mb-2">Меню пусто</h3>
            <p className="text-gray-600 mb-4">Начните с создания первой категории</p>
            <button onClick={handleAddCategory} className="btn-primary">
              Создать категорию
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {categories.map((category) => (
              <div key={category.id} className="card">
                {/* Category Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1">
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className="text-2xl hover:bg-gray-100 rounded p-1"
                    >
                      {expandedCategories.has(category.id) ? '▼' : '▶'}
                    </button>
                    <div>
                      <h3 className="text-xl font-semibold">{category.name}</h3>
                      <p className="text-sm text-gray-600">
                        {dishes[category.id]?.length || 0} блюд
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAddDish(category.id)}
                      className="btn-secondary text-sm"
                    >
                      + Блюдо
                    </button>
                    <button
                      onClick={() => handleEditCategory(category)}
                      className="btn-secondary text-sm"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      className="btn-secondary text-sm text-red-600 hover:bg-red-50"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Dishes List */}
                {expandedCategories.has(category.id) && (
                  <div className="ml-12 space-y-2">
                    {dishes[category.id]?.length === 0 ? (
                      <p className="text-gray-500 text-sm py-4">Нет блюд в этой категории</p>
                    ) : (
                      dishes[category.id]?.map((dish) => (
                        <div
                          key={dish.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            {dish.imageUrl ? (
                              <img
                                src={dish.imageUrl}
                                alt={dish.name}
                                className="w-16 h-16 object-cover rounded border-2 border-green-500"
                                title="Фото загружено"
                              />
                            ) : (
                              <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center border-2 border-gray-300" title="Фото отсутствует">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                            <div>
                              <h4 className="font-medium">{dish.name}</h4>
                              <p className="text-sm text-gray-600 line-clamp-1">
                                {dish.description}
                              </p>
                              <p className="text-primary-600 font-semibold">
                                {dish.price} {currency}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditDish(dish)}
                              className="btn-secondary text-sm"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteDish(dish.id)}
                              className="btn-secondary text-sm text-red-600 hover:bg-red-50"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category Modal */}
      {showCategoryModal && (
        <CategoryModal
          category={editingCategory}
          restaurantId={userData.restaurant.id}
          onClose={() => setShowCategoryModal(false)}
          onSave={() => {
            setShowCategoryModal(false);
            loadCategories(userData.restaurant.id);
          }}
        />
      )}

      {/* Dish Modal */}
      {showDishModal && (
        <DishModal
          dish={editingDish}
          categoryId={selectedCategoryId}
          currency={currency}
          onClose={() => setShowDishModal(false)}
          onSave={() => {
            setShowDishModal(false);
            loadCategories(userData.restaurant.id);
          }}
        />
      )}
    </div>
  );
};

// Category Modal Component
const CategoryModal = ({ category, restaurantId, onClose, onSave }) => {
  const [name, setName] = useState(category?.name || '');
  const [sortOrder, setSortOrder] = useState(category?.sortOrder || 0);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const data = { name, sortOrder: parseInt(sortOrder), restaurantId };
      
      if (category) {
        await menuService.updateCategory(category.id, data);
      } else {
        await menuService.createCategory(data);
      }
      
      onSave();
    } catch (err) {
      alert('Ошибка при сохранении категории');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-bold mb-4">
          {category ? 'Редактировать категорию' : 'Новая категория'}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Название</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Порядок сортировки
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="input w-full"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={saving}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={saving}
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Dish Modal Component
const DishModal = ({ dish, categoryId, currency = '₽', onClose, onSave }) => {
  const [name, setName] = useState(dish?.name || '');
  const [description, setDescription] = useState(dish?.description || '');
  const [price, setPrice] = useState(dish?.price || '');
  const [imageFile, setImageFile] = useState(null);
  const [currentImageUrl, setCurrentImageUrl] = useState(dish?.imageUrl || null);
  const [modifiers, setModifiers] = useState(dish?.modifiers || []);
  const [newModifierName, setNewModifierName] = useState('');
  const [newModifierPrice, setNewModifierPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleDeleteImage = async () => {
    if (!confirm('Удалить изображение блюда?')) return;
    
    try {
      await menuService.deleteDishImage(dish.id);
      setCurrentImageUrl(null);
      alert('Изображение удалено');
    } catch (err) {
      alert('Ошибка при удалении изображения');
      console.error(err);
    }
  };

  const handleAddModifier = () => {
    if (!newModifierName.trim()) {
      alert('Введите название модификатора');
      return;
    }

    const modifierPrice = parseFloat(newModifierPrice) || 0;
    if (modifierPrice < 0) {
      alert('Цена модификатора не может быть отрицательной');
      return;
    }

    const newModifier = {
      id: `temp-${Date.now()}`, // Временный ID для новых модификаторов
      name: newModifierName,
      price: modifierPrice,
      isNew: true
    };

    setModifiers([...modifiers, newModifier]);
    setNewModifierName('');
    setNewModifierPrice('');
  };

  const handleDeleteModifier = async (modifier) => {
    if (modifier.isNew) {
      // Просто удаляем из локального состояния
      setModifiers(modifiers.filter(m => m.id !== modifier.id));
    } else {
      // Удаляем из базы данных
      if (!confirm('Удалить модификатор?')) return;
      
      try {
        await menuService.deleteModifier(modifier.id);
        setModifiers(modifiers.filter(m => m.id !== modifier.id));
      } catch (err) {
        alert('Ошибка при удалении модификатора');
        console.error(err);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate price
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      alert('Цена должна быть числом больше или равным 0');
      return;
    }
    
    setSaving(true);

    try {
      const data = {
        name,
        description,
        price: parsedPrice,
        categoryId,
      };
      
      let savedDish;
      if (dish) {
        savedDish = await menuService.updateDish(dish.id, data);
      } else {
        savedDish = await menuService.createDish(data);
      }

      // Upload image if selected
      if (imageFile) {
        setUploadingImage(true);
        setUploadProgress(0);
        try {
          await menuService.uploadDishImage(savedDish.id, imageFile, (progress) => {
            setUploadProgress(progress);
          });
        } finally {
          setUploadingImage(false);
          setUploadProgress(0);
        }
      }

      // Save new modifiers
      const newModifiers = modifiers.filter(m => m.isNew);
      for (const modifier of newModifiers) {
        await menuService.createModifier(savedDish.id, {
          name: modifier.name,
          price: modifier.price
        });
      }
      
      onSave();
    } catch (err) {
      alert('Ошибка при сохранении блюда');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-4">
          {dish ? 'Редактировать блюдо' : 'Новое блюдо'}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Название</label>
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
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Цена ({currency})</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="input w-full"
              step="0.01"
              min="0"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Цена должна быть 0 или больше</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Фото</label>
            {currentImageUrl && !imageFile && (
              <div className="relative mb-2">
                <img
                  src={currentImageUrl}
                  alt={dish?.name || 'Блюдо'}
                  className="w-full h-48 object-cover rounded"
                />
                {dish && (
                  <button
                    type="button"
                    onClick={handleDeleteImage}
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 shadow-lg transition-colors"
                    title="Удалить изображение"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )}
            {imageFile && (
              <div className="mb-2">
                <img
                  src={URL.createObjectURL(imageFile)}
                  alt="Предпросмотр"
                  className="w-full h-48 object-cover rounded"
                />
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files[0])}
              className="input w-full"
            />
            {imageFile && !uploadingImage && (
              <p className="text-sm text-green-600 mt-1">
                ✓ Выбран файл: {imageFile.name}
              </p>
            )}
            {uploadingImage && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-blue-600 font-medium">
                    Загрузка изображения...
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

          {/* Модификаторы */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium mb-2">Модификаторы (добавки)</label>
            
            {/* Список модификаторов */}
            {modifiers.length > 0 && (
              <div className="space-y-2 mb-3">
                {modifiers.map((modifier) => (
                  <div
                    key={modifier.id}
                    className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded border gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm sm:text-base break-words">{modifier.name}</span>
                      {modifier.price > 0 && (
                        <span className="text-gray-600 text-xs sm:text-sm ml-2 whitespace-nowrap">
                          +{modifier.price} {currency}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteModifier(modifier)}
                      className="text-red-600 hover:text-red-800 active:text-red-900 text-sm px-2 flex-shrink-0"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Форма добавления модификатора */}
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newModifierName}
                onChange={(e) => setNewModifierName(e.target.value)}
                placeholder="Название (например: Сыр)"
                className="input flex-1 text-sm sm:text-base"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddModifier();
                  }
                }}
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  value={newModifierPrice}
                  onChange={(e) => setNewModifierPrice(e.target.value)}
                  placeholder="Цена"
                  className="input flex-1 sm:w-24 text-sm sm:text-base"
                  step="0.01"
                  min="0"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddModifier();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddModifier}
                  className="btn-secondary whitespace-nowrap text-sm sm:text-base px-3 sm:px-4"
                >
                  + Добавить
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Модификаторы позволяют клиентам добавлять дополнения к блюду
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={saving || uploadingImage}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={saving || uploadingImage}
            >
              {uploadingImage ? 'Загрузка фото...' : saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MenuManagementPage;