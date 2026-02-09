import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { menuService } from '../services/menuService';
import { restaurantService } from '../services/restaurantService';
import modifierTemplateService from '../services/modifierTemplateService';
import toast from 'react-hot-toast';
import { confirmDialog } from '../utils/confirmDialog';
import RestaurantSelector from '../components/RestaurantSelector';
import DashboardLayout from '../components/DashboardLayout';
import CategoryGroupsModal from '../components/CategoryGroupsModal';
import ImageWithLoader from '../components/ImageWithLoader';

const MenuManagementPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [userData, setUserData] = useState(null);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(() => {
    // Восстанавливаем последний выбранный ресторан из localStorage
    return localStorage.getItem('selectedRestaurantId') || null;
  });
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
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [sourceRestaurantId, setSourceRestaurantId] = useState('');
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [draggedCategoryId, setDraggedCategoryId] = useState(null);
  const [draggedDishId, setDraggedDishId] = useState(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState(null);
  const [dragOverDishId, setDragOverDishId] = useState(null);
  const [showCategoryGroupsModal, setShowCategoryGroupsModal] = useState(false);
  const [categoryGroups, setCategoryGroups] = useState([]);
  const [dataTimestamp, setDataTimestamp] = useState(Date.now()); // Для cache-busting изображений

  useEffect(() => {
    loadData();
  }, []);

  // Автоматически выбираем ресторан при загрузке
  useEffect(() => {
    if (userData && (userData.restaurants?.length > 0 || userData.restaurantStaff?.length > 0)) {
      const allRestaurants = [
        ...(userData.restaurants || []),
        ...(userData.restaurantStaff?.map(s => s.restaurant) || [])
      ];

      if (allRestaurants.length > 0) {
        // Проверяем есть ли сохраненный ресторан в доступных
        const savedRestaurantId = localStorage.getItem('selectedRestaurantId');
        const savedRestaurantExists = savedRestaurantId && allRestaurants.some(r => r.id === savedRestaurantId);

        if (savedRestaurantExists) {
          // Если сохраненный ресторан существует - используем его
          setSelectedRestaurantId(savedRestaurantId);
        } else if (!selectedRestaurantId) {
          // Если нет сохраненного или он недоступен - выбираем первый
          const firstRestaurantId = allRestaurants[0].id;
          setSelectedRestaurantId(firstRestaurantId);
          localStorage.setItem('selectedRestaurantId', firstRestaurantId);
        }
      }
    }
  }, [userData]);

  const getSelectedRestaurant = () => {
    if (!userData || !selectedRestaurantId) return null;

    const owned = userData.restaurants?.find(r => r.id === selectedRestaurantId);
    if (owned) return owned;

    const staff = userData.restaurantStaff?.find(s => s.restaurant.id === selectedRestaurantId);
    return staff?.restaurant || null;
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
      setDataTimestamp(Date.now()); // Обновляем timestamp для cache-busting
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const loadCategoryGroups = async (restaurantId) => {
    try {
      const { categoryGroupService } = await import('../services/categoryGroupService');
      const groups = await categoryGroupService.getCategoryGroups(restaurantId);
      console.log('📂 Loaded category groups:', groups);
      setCategoryGroups(groups);
    } catch (err) {
      console.error('Error loading category groups:', err);
    }
  };

  useEffect(() => {
    if (userData && selectedRestaurantId) {
      const restaurant = getSelectedRestaurant();
      if (restaurant) {
        setCurrency(restaurant.currency || '₽');
        loadCategories(selectedRestaurantId);
        loadCategoryGroups(selectedRestaurantId);
      }
    }
  }, [selectedRestaurantId, userData]);

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

  const handleCopyMenu = async () => {
    if (!sourceRestaurantId) {
      setCopyError('Выберите ресторан-источник');
      return;
    }

    setCopying(true);
    setCopyError('');

    try {
      await restaurantService.copyMenu(selectedRestaurantId, sourceRestaurantId);
      setShowCopyModal(false);
      setSourceRestaurantId('');
      await loadCategories(selectedRestaurantId);
    } catch (err) {
      setCopyError(err.message || 'Ошибка при копировании меню');
      toast.error(err.message || 'Ошибка при копировании меню');
    } finally {
      setCopying(false);
    }
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setShowCategoryModal(true);
  };

  const handleDeleteCategory = async (categoryId) => {
    const confirmed = await confirmDialog('Удалить категорию и все блюда в ней?', {
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      icon: '🗑️'
    });
    if (!confirmed) return;

    try {
      await menuService.deleteCategory(categoryId);
      await loadCategories(selectedRestaurantId);
    } catch (err) {
      toast.error('Ошибка при удалении категории');
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
    const confirmed = await confirmDialog('Удалить блюдо?', {
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      icon: '🗑️'
    });
    if (!confirmed) return;

    try {
      await menuService.deleteDish(dishId);
      toast.success('Блюдо удалено');
      setDataTimestamp(Date.now()); // Обновляем timestamp для cache-busting
      await loadCategories(selectedRestaurantId);
    } catch (err) {
      // Show more detailed error message if available
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Ошибка при удалении блюда';
      toast.error(errorMessage, { duration: 6000 }); // Дольше показываем сообщение
      console.error(err);
      // Don't reload categories on error to avoid duplicate requests
    }
  };

  const handleToggleAvailability = async (dishId) => {
    try {
      const dishToUpdate = Object.values(dishes)
        .flat()
        .find(d => d.id === dishId);

      if (!dishToUpdate) return;

      const previousState = { ...dishes };
      const updatedDishes = { ...dishes };

      Object.keys(updatedDishes).forEach(categoryId => {
        updatedDishes[categoryId] = updatedDishes[categoryId].map(dish =>
          dish.id === dishId ? { ...dish, available: !dish.available } : dish
        );
      });

      setDishes(updatedDishes);

      await menuService.toggleDishAvailability(dishId);
      await loadCategories(selectedRestaurantId);
    } catch (err) {
      toast.error('Ошибка при изменении статуса блюда');
      await loadCategories(selectedRestaurantId);
      console.error(err);
    }
  };

  const handleCategoryDragStart = (e, categoryId) => {
    setDraggedCategoryId(categoryId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleCategoryDragOver = (e, categoryId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCategoryId(categoryId);
  };

  const handleCategoryDragLeave = () => {
    setDragOverCategoryId(null);
  };

  const handleCategoryDrop = async (e, dropCategoryId) => {
    e.preventDefault();
    setDragOverCategoryId(null);

    if (!draggedCategoryId || draggedCategoryId === dropCategoryId) {
      setDraggedCategoryId(null);
      return;
    }

    try {
      const draggedIndex = categories.findIndex(c => c.id === draggedCategoryId);
      const dropIndex = categories.findIndex(c => c.id === dropCategoryId);

      if (draggedIndex === -1 || dropIndex === -1) return;

      const newCategories = [...categories];
      const [removed] = newCategories.splice(draggedIndex, 1);
      newCategories.splice(dropIndex, 0, removed);

      setCategories(newCategories);

      const categoryIds = newCategories.map(c => c.id);
      await menuService.reorderCategories(selectedRestaurantId, categoryIds);
    } catch (err) {
      toast.error('Ошибка при перемещении категории');
      console.error(err);
      await loadCategories(selectedRestaurantId);
    } finally {
      setDraggedCategoryId(null);
    }
  };

  const handleDishDragStart = (e, dishId) => {
    setDraggedDishId(dishId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDishDragOver = (e, dishId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDishId(dishId);
  };

  const handleDishDragLeave = () => {
    setDragOverDishId(null);
  };

  const handleDishDrop = async (e, dropDishId, categoryId) => {
    e.preventDefault();
    setDragOverDishId(null);

    if (!draggedDishId || draggedDishId === dropDishId) {
      setDraggedDishId(null);
      return;
    }

    try {
      const categoryDishes = dishes[categoryId];
      const draggedIndex = categoryDishes.findIndex(d => d.id === draggedDishId);
      const dropIndex = categoryDishes.findIndex(d => d.id === dropDishId);

      if (draggedIndex === -1 || dropIndex === -1) return;

      const newDishes = [...categoryDishes];
      const [removed] = newDishes.splice(draggedIndex, 1);
      newDishes.splice(dropIndex, 0, removed);

      setDishes({ ...dishes, [categoryId]: newDishes });

      const dishIds = newDishes.map(d => d.id);
      await menuService.reorderDishes(categoryId, dishIds);
    } catch (err) {
      toast.error('Ошибка при перемещении блюда');
      console.error(err);
      await loadCategories(selectedRestaurantId);
    } finally {
      setDraggedDishId(null);
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
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">Управление меню</h1>
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

        {/* Add Category Button */}
        <div className="mb-6 flex justify-between items-center gap-2 flex-wrap">
          <h2 className="text-2xl font-bold">Категории и блюда</h2>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowCategoryGroupsModal(true)} className="btn-secondary">
              📂 Группы категорий
            </button>
            <button onClick={() => setShowCopyModal(true)} className="btn-secondary">
              📋 Копировать меню
            </button>
            <button onClick={handleAddCategory} className="btn-primary">
              + Добавить категорию
            </button>
          </div>
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
              <div
                key={category.id}
                className={`card cursor-move transition-all ${draggedCategoryId === category.id ? 'opacity-50' : ''} ${dragOverCategoryId === category.id ? 'border-2 border-blue-500 bg-blue-50' : ''}`}
                draggable
                onDragStart={(e) => handleCategoryDragStart(e, category.id)}
                onDragOver={(e) => handleCategoryDragOver(e, category.id)}
                onDragLeave={handleCategoryDragLeave}
                onDrop={(e) => handleCategoryDrop(e, category.id)}
              >
                {/* Category Header - Desktop: flex row, Mobile: flex column */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className="text-2xl hover:bg-gray-100 rounded p-1 flex-shrink-0"
                    >
                      {expandedCategories.has(category.id) ? '▼' : '▶'}
                    </button>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-semibold break-words">{category.name}</h3>
                      <p className="text-sm text-gray-600">
                        {dishes[category.id]?.length || 0} блюд
                      </p>
                    </div>
                  </div>
                  {/* Action Buttons - Below on mobile, Right on desktop */}
                  <div className="flex gap-2 sm:flex-shrink-0">
                    <button
                      onClick={() => handleAddDish(category.id)}
                      className="btn-secondary text-sm flex-1 sm:flex-initial whitespace-nowrap"
                    >
                      + Блюдо
                    </button>
                    <button
                      onClick={() => handleEditCategory(category)}
                      className="btn-secondary text-sm flex-1 sm:flex-initial"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      className="btn-secondary text-sm text-red-600 hover:bg-red-50 flex-1 sm:flex-initial"
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
                          className={`p-3 rounded-lg cursor-move transition-all ${draggedDishId === dish.id ? 'opacity-50' : ''} ${dragOverDishId === dish.id ? 'bg-blue-100 border-2 border-blue-400' : 'bg-gray-50 hover:bg-gray-100'}`}
                          draggable
                          onDragStart={(e) => handleDishDragStart(e, dish.id)}
                          onDragOver={(e) => handleDishDragOver(e, dish.id)}
                          onDragLeave={handleDishDragLeave}
                          onDrop={(e) => handleDishDrop(e, dish.id, category.id)}
                        >
                          {/* Desktop: flex row, Mobile: flex column */}
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            {/* Dish Info */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="relative w-16 h-16 flex-shrink-0">
                                {dish.imageUrl ? (
                                  <ImageWithLoader
                                    src={`${dish.imageUrl}?t=${dataTimestamp}`}
                                    alt={dish.name}
                                    className="w-16 h-16 object-cover rounded border-2 border-green-500"
                                    title="Фото загружено"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center border-2 border-gray-300" title="Фото отсутствует">
                                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                )}
                                {dish.badge && (
                                  <div className="absolute top-0 left-0 bg-gradient-to-br from-orange-400 to-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-tl rounded-br shadow-lg">
                                    {dish.badge}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-medium break-words">{dish.name}</h4>
                                  {!dish.available && (
                                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded whitespace-nowrap">
                                      СТОП
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 line-clamp-1">
                                  {dish.description}
                                </p>
                                <p className="text-primary-600 font-semibold">
                                  {dish.price} {currency}
                                </p>
                              </div>
                            </div>

                            {/* Action Buttons - Below on mobile, Right on desktop */}
                            <div className="flex gap-2 sm:flex-shrink-0">
                              <button
                                onClick={() => handleToggleAvailability(dish.id)}
                                className={`btn-secondary text-sm flex-1 sm:flex-initial ${!dish.available ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'
                                  }`}
                                title={dish.available ? 'Поставить на стоп' : 'Вернуть в меню'}
                              >
                                {dish.available ? '✓' : '⏸'}
                              </button>
                              <button
                                onClick={() => handleEditDish(dish)}
                                className="btn-secondary text-sm flex-1 sm:flex-initial"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDeleteDish(dish.id)}
                                className="btn-secondary text-sm text-red-600 hover:bg-red-50 flex-1 sm:flex-initial"
                              >
                                🗑️
                              </button>
                            </div>
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
      {showCategoryModal && selectedRestaurantId && (
        <CategoryModal
          category={editingCategory}
          restaurantId={selectedRestaurantId}
          categoryGroups={categoryGroups}
          onClose={() => setShowCategoryModal(false)}
          onSave={() => {
            setShowCategoryModal(false); // Закрываем модалку
            loadCategories(selectedRestaurantId);
            loadCategoryGroups(selectedRestaurantId);
          }}
        />
      )}

      {/* Dish Modal */}
      {showDishModal && selectedRestaurantId && (
        <DishModal
          dish={editingDish}
          categoryId={selectedCategoryId}
          currency={currency}
          restaurantId={selectedRestaurantId}
          onClose={() => setShowDishModal(false)}
          onSave={() => {
            setShowDishModal(false); // Закрываем модалку
            // Автоматически раскрываем категорию после добавления/редактирования блюда
            if (selectedCategoryId) {
              setExpandedCategories(prev => new Set([...prev, selectedCategoryId]));
            }
            loadCategories(selectedRestaurantId); // Обновляем список
            setDataTimestamp(Date.now()); // Обновляем timestamp для изображений
            toast.success(editingDish ? 'Блюдо обновлено' : 'Блюдо добавлено');
          }}
        />
      )}

      {/* Category Groups Modal */}
      {showCategoryGroupsModal && selectedRestaurantId && (
        <CategoryGroupsModal
          restaurantId={selectedRestaurantId}
          categories={categories}
          onClose={() => setShowCategoryGroupsModal(false)}
          onSave={() => {
            setShowCategoryGroupsModal(false);
            loadCategories(selectedRestaurantId);
            loadCategoryGroups(selectedRestaurantId);
          }}
        />
      )}

      {/* Copy Menu Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Копировать меню</h2>

            {copyError && (
              <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">
                {copyError}
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Выберите ресторан-источник
              </label>
              <select
                value={sourceRestaurantId}
                onChange={(e) => setSourceRestaurantId(e.target.value)}
                className="input w-full"
                disabled={copying}
              >
                <option value="">-- Выберите ресторан --</option>
                {userData?.restaurants?.map(r => (
                  r.id !== selectedRestaurantId && (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  )
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-2">
                ⚠️ Существующее меню будет перезаписано
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCopyModal(false);
                  setSourceRestaurantId('');
                  setCopyError('');
                }}
                className="btn-secondary flex-1"
                disabled={copying}
              >
                Отмена
              </button>
              <button
                onClick={handleCopyMenu}
                className="btn-primary flex-1"
                disabled={copying || !sourceRestaurantId}
              >
                {copying ? 'Копирование...' : 'Копировать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

// Category Modal Component
const CategoryModal = ({ category, restaurantId, onClose, onSave, categoryGroups }) => {
  const [name, setName] = useState(category?.name || '');
  const [sortOrder, setSortOrder] = useState(category?.order || 0);
  const [categoryGroupId, setCategoryGroupId] = useState(category?.categoryGroupId || '');
  const [saving, setSaving] = useState(false);

  console.log('📝 CategoryModal render:', {
    categoryId: category?.id,
    categoryName: category?.name,
    categoryGroupId: category?.categoryGroupId,
    currentCategoryGroupId: categoryGroupId,
    availableGroups: categoryGroups?.length
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Attempting to save category with data:', {
      category: category ? 'editing existing' : 'creating new',
      name,
      order: parseInt(sortOrder),
      categoryGroupId: categoryGroupId || null,
      restaurantId
    });
    setSaving(true);

    try {
      const data = {
        name,
        order: parseInt(sortOrder),
        restaurantId,
        categoryGroupId: categoryGroupId || null
      };

      if (category) {
        await menuService.updateCategory(category.id, data);
        toast.success('Категория обновлена');
      } else {
        await menuService.createCategory(data);
        toast.success('Категория создана');
      }

      onSave();
    } catch (err) {
      toast.error('Ошибка при сохранении категории');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">
            {category ? 'Редактировать категорию' : 'Новая категория'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            aria-label="Закрыть"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

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

          <div>
            <label className="block text-sm font-medium mb-1">
              Группа категорий (необязательно)
            </label>
            <select
              value={categoryGroupId}
              onChange={(e) => setCategoryGroupId(e.target.value)}
              className="input w-full"
            >
              <option value="">Без группы</option>
              {categoryGroups && categoryGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Категории в группе отображаются под её карточкой в QR-меню
            </p>
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
const DishModal = ({ dish, categoryId, currency = '₽', onClose, onSave, restaurantId }) => {
  const [name, setName] = useState(dish?.name || '');
  const [description, setDescription] = useState(dish?.description || '');
  const [price, setPrice] = useState(dish?.price || '');
  const [imageFile, setImageFile] = useState(null);
  const [currentImageUrl, setCurrentImageUrl] = useState(
    dish?.imageUrl ? `${dish.imageUrl}?t=${Date.now()}` : null
  );
  const [modifiers, setModifiers] = useState(dish?.modifiers || []);
  const [allergens, setAllergens] = useState(dish?.allergens ? JSON.parse(dish.allergens) : []);
  const [discount, setDiscount] = useState(dish?.discount || '');
  const [badge, setBadge] = useState(dish?.badge || '');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Состояние для модификаторов
  const [editingModifier, setEditingModifier] = useState(null);
  const [newModifierName, setNewModifierName] = useState('');
  const [newModifierType, setNewModifierType] = useState('single');
  const [newModifierRequired, setNewModifierRequired] = useState(false);

  // Состояние для библиотеки модификаторов
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Состояние для рекомендаций
  const [recommendationIds, setRecommendationIds] = useState(dish?.recommendationIds || []);
  const [allDishes, setAllDishes] = useState([]);
  const [loadingDishes, setLoadingDishes] = useState(false);

  // Обновляем фото при изменении dish (когда переоткрываем модалку)
  useEffect(() => {
    if (dish?.imageUrl) {
      setCurrentImageUrl(`${dish.imageUrl}?t=${Date.now()}`);
    }
  }, [dish?.imageUrl]);

  // Обновляем recommendationIds при изменении dish
  useEffect(() => {
    setRecommendationIds(dish?.recommendationIds || []);
  }, [dish?.id]);

  // Загрузка всех блюд ресторана (для выбора рекомендаций)
  useEffect(() => {
    if (restaurantId) {
      loadAllDishes();
    }
  }, [restaurantId]);

  const loadAllDishes = async () => {
    setLoadingDishes(true);
    try {
      const url = `/api/dishes/restaurant/${restaurantId}/all`;
      console.log('🔄 Loading dishes from:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      console.log('📡 Response status:', response.status);

      if (response.ok) {
        const text = await response.text();
        console.log('📄 Response text (first 500 chars):', text.substring(0, 500));

        try {
          const data = JSON.parse(text);
          console.log(`✅ Loaded ${data.length} dishes`);
          setAllDishes(data);
        } catch (parseError) {
          console.error('❌ JSON Parse Error:', parseError);
          console.log('Full response:', text);
        }
      } else {
        const text = await response.text();
        console.error('❌ Failed to load dishes, status:', response.status, 'Response:', text.substring(0, 200));
      }
    } catch (err) {
      console.error('❌ Error loading dishes:', err);
    } finally {
      setLoadingDishes(false);
    }
  };

  // Загрузка шаблонов модификаторов
  useEffect(() => {
    if (restaurantId && showTemplates) {
      loadTemplates();
    }
  }, [restaurantId, showTemplates]);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const data = await modifierTemplateService.getTemplates(restaurantId);
      setTemplates(data);
    } catch (err) {
      console.error('Error loading templates:', err);
      toast.error('Ошибка загрузки шаблонов');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const availableAllergens = [
    { id: 'gluten', name: 'Глютен', icon: '🌾' },
    { id: 'dairy', name: 'Молоко', icon: '🥛' },
    { id: 'nuts', name: 'Орехи', icon: '🥜' },
    { id: 'eggs', name: 'Яйца', icon: '🥚' },
    { id: 'fish', name: 'Рыба', icon: '🐟' },
    { id: 'shellfish', name: 'Морепродукты', icon: '🦐' },
    { id: 'soy', name: 'Соя', icon: '🫘' },
    { id: 'sesame', name: 'Кунжут', icon: '🌰' }
  ];

  const toggleAllergen = (allergenId) => {
    setAllergens(prev =>
      prev.includes(allergenId)
        ? prev.filter(a => a !== allergenId)
        : [...prev, allergenId]
    );
  };

  const handleDeleteImage = async () => {
    const confirmed = await confirmDialog('Удалить изображение блюда?', {
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      icon: '🖼️'
    });
    if (!confirmed) return;

    try {
      await menuService.deleteDishImage(dish.id);
      setCurrentImageUrl(null);
      toast.success('Изображение удалено');
    } catch (err) {
      toast.error('Ошибка при удалении изображения');
      console.error(err);
    }
  };

  const handleAddModifier = async () => {
    if (!newModifierName.trim()) {
      toast.error('Введите название модификатора');
      return;
    }

    const modifierData = {
      name: newModifierName,
      type: newModifierType,
      isRequired: newModifierRequired,
      options: [] // Пустой массив опций - будут добавляться отдельно
    };

    if (dish?.id) {
      // Если блюдо уже сохранено - создаем модификатор сразу
      try {
        const created = await menuService.createModifier(dish.id, modifierData);
        setModifiers(prev => [...prev, created]);
        toast.success('Модификатор создан');
      } catch (err) {
        toast.error('Ошибка при создании модификатора');
        console.error(err);
        return;
      }
    } else {
      // Если блюдо еще не сохранено - добавляем временный модификатор
      const newModifier = {
        ...modifierData,
        id: `temp-${Date.now()}`,
        isNew: true
      };
      setModifiers(prev => [...prev, newModifier]);
    }

    setNewModifierName('');
    setNewModifierType('single');
    setNewModifierRequired(false);
  };

  const handleDeleteModifier = async (modifier) => {
    const confirmed = await confirmDialog('Удалить модификатор и все его опции?', {
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      icon: '🗑️'
    });
    if (!confirmed) return;

    if (modifier.isNew || !dish?.id) {
      // Просто удаляем из локального состояния
      setModifiers(modifiers.filter(m => m.id !== modifier.id));
    } else {
      // Удаляем из базы данных
      try {
        await menuService.deleteModifier(modifier.id);
        setModifiers(modifiers.filter(m => m.id !== modifier.id));
        toast.success('Модификатор удален');
      } catch (err) {
        toast.error('Ошибка при удалении модификатора');
        console.error(err);
      }
    }
  };

  const handleApplyTemplate = async (template) => {
    if (!dish?.id) {
      toast.error('Сначала сохраните блюдо, чтобы применить шаблон');
      return;
    }

    try {
      await modifierTemplateService.applyToDish(template.id, dish.id);
      toast.success(`Шаблон "${template.name}" применен к блюду`);
      setShowTemplates(false);
      // Перезагружаем данные блюда
      onSave();
    } catch (err) {
      console.error('Error applying template:', err);
      toast.error('Ошибка при применении шаблона');
    }
  };

  // Управление опциями модификатора
  const handleAddOption = async (modifier) => {
    const optionName = prompt('Название опции (например: Клубника)');
    if (!optionName?.trim()) return;

    const optionPriceStr = prompt('Дополнительная цена (0 если без доплаты)');
    const optionPrice = parseFloat(optionPriceStr) || 0;

    const optionData = {
      name: optionName.trim(),
      price: optionPrice
    };

    if (!modifier.isNew && dish?.id) {
      // Создаем опцию сразу в базе
      try {
        const created = await menuService.createModifierOption(modifier.id, optionData);
        setModifiers(prev => prev.map(m =>
          m.id === modifier.id
            ? { ...m, options: [...(m.options || []), created] }
            : m
        ));
        toast.success('Опция добавлена. Теперь можно загрузить фото 📷');
      } catch (err) {
        toast.error('Ошибка при добавлении опции');
        console.error(err);
      }
    } else {
      // Добавляем временную опцию
      const newOption = {
        ...optionData,
        id: `temp-opt-${Date.now()}`,
        isNew: true
      };
      setModifiers(prev => prev.map(m =>
        m.id === modifier.id
          ? { ...m, options: [...(m.options || []), newOption] }
          : m
      ));
      toast.info('💡 Сохраните блюдо, чтобы добавить фото к опциям');
    }
  };

  const handleDeleteOption = async (modifier, option) => {
    const confirmed = await confirmDialog('Удалить опцию?', {
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      icon: '🗑️'
    });
    if (!confirmed) return;

    if (!option.isNew && dish?.id) {
      try {
        await menuService.deleteModifierOption(option.id);
        toast.success('Опция удалена');
      } catch (err) {
        toast.error('Ошибка при удалении опции');
        console.error(err);
      }
    }

    setModifiers(modifiers.map(m =>
      m.id === modifier.id
        ? { ...m, options: (m.options || []).filter(o => o.id !== option.id) }
        : m
    ));
  };

  const handleUploadOptionImage = async (modifier, option, file) => {
    console.log('📸 [Upload Start] Starting image upload...');
    console.log('📸 [Upload Start] File:', file?.name, 'Size:', file?.size, 'Type:', file?.type);
    console.log('📸 [Upload Start] Modifier:', modifier.id, modifier.name);
    console.log('📸 [Upload Start] Option:', option.id, option.name);
    console.log('📸 [Upload Start] Option.isNew:', option.isNew);

    if (!file) {
      console.error('❌ [Upload Error] No file provided');
      toast.error('Файл не выбран');
      return;
    }

    if (option.isNew) {
      console.error('❌ [Upload Error] Cannot upload image for unsaved option');
      toast.error('Сначала сохраните блюдо, чтобы добавить фото к опции');
      return;
    }

    try {
      console.log('📤 [Upload API] Calling uploadModifierOptionImage...');
      const result = await menuService.uploadModifierOptionImage(option.id, file, (progress) => {
        console.log(`📊 [Upload Progress] ${progress}%`);
      });

      console.log('✅ [Upload Success] Result:', result);
      console.log('✅ [Upload Success] Image URL:', result.imageUrl);

      // Обновляем URL изображения опции с cache-busting
      const newImageUrl = `${result.imageUrl}?t=${Date.now()}`;
      console.log('🔄 [Update State] Setting new image URL:', newImageUrl);

      setModifiers(modifiers.map(m =>
        m.id === modifier.id
          ? {
            ...m,
            options: (m.options || []).map(o =>
              o.id === option.id ? { ...o, image: newImageUrl } : o
            )
          }
          : m
      ));

      console.log('✅ [Upload Complete] Image uploaded successfully');
      toast.success('Фото загружено');
    } catch (err) {
      console.error('❌ [Upload Error] Full error:', err);
      console.error('❌ [Upload Error] Error message:', err.message);
      console.error('❌ [Upload Error] Error response:', err.response?.data);
      console.error('❌ [Upload Error] Error status:', err.response?.status);
      toast.error(`Ошибка при загрузке фото: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleDeleteOptionImage = async (modifier, option) => {
    const confirmed = await confirmDialog('Удалить фото опции?', {
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      icon: '🖼️'
    });
    if (!confirmed) return;

    try {
      await menuService.deleteModifierOptionImage(option.id);
      setModifiers(modifiers.map(m =>
        m.id === modifier.id
          ? {
            ...m,
            options: (m.options || []).map(o =>
              o.id === option.id ? { ...o, image: null } : o
            )
          }
          : m
      ));
      toast.success('Фото удалено');
    } catch (err) {
      toast.error('Ошибка при удалении фото');
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate price
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      toast.error('Цена должна быть числом больше или равным 0');
      return;
    }

    const parsedDiscount = discount ? parseInt(discount) : null;
    if (parsedDiscount !== null && (parsedDiscount < 0 || parsedDiscount > 100)) {
      toast.error('Скидка должна быть от 0 до 100%');
      return;
    }

    setSaving(true);

    try {
      const data = {
        name,
        description,
        price: parsedPrice,
        categoryId,
        allergens: allergens.length > 0 ? JSON.stringify(allergens) : null,
        discount: parsedDiscount,
        badge: badge || null,
        recommendationIds,
      };

      let savedDish;
      if (dish) {
        savedDish = await menuService.updateDish(dish.id, data);
      } else {
        savedDish = await menuService.createDish(data);
      }

      // Upload image if selected
      if (imageFile) {
        console.log('🖼️ [Dish Image] Starting upload...');
        console.log('🖼️ [Dish Image] File:', imageFile.name, 'Size:', imageFile.size, 'Type:', imageFile.type);
        console.log('🖼️ [Dish Image] Dish ID:', savedDish.id);

        setUploadingImage(true);
        setUploadProgress(0);
        try {
          console.log('📤 [Dish Image] Calling uploadDishImage...');
          const result = await menuService.uploadDishImage(savedDish.id, imageFile, (progress) => {
            console.log(`📊 [Dish Image] Progress: ${progress}%`);
            setUploadProgress(progress);
          });

          console.log('✅ [Dish Image] Upload successful:', result);
          console.log('✅ [Dish Image] Image URL:', result?.imageUrl);

          // ✅ Обновляем превью сразу с cache-busting
          if (result?.imageUrl) {
            const newUrl = `${result.imageUrl}?t=${Date.now()}`;
            console.log('🔄 [Dish Image] Setting image URL:', newUrl);
            setCurrentImageUrl(newUrl);
          }
        } catch (err) {
          console.error('❌ [Dish Image] Upload failed:', err);
          console.error('❌ [Dish Image] Error message:', err.message);
          console.error('❌ [Dish Image] Error response:', err.response?.data);
          toast.error(`Ошибка загрузки фото: ${err.response?.data?.error || err.message}`);
        } finally {
          setUploadingImage(false);
          setUploadProgress(0);
          setImageFile(null);
        }
      }

      // Save new modifiers with options
      const newModifiers = modifiers.filter(m => m.isNew);
      for (const modifier of newModifiers) {
        // Создаем модификатор
        const createdModifier = await menuService.createModifier(savedDish.id, {
          name: modifier.name,
          type: modifier.type,
          isRequired: modifier.isRequired
        });

        // Создаем опции для модификатора
        const newOptions = (modifier.options || []).filter(o => o.isNew);
        for (const option of newOptions) {
          await menuService.createModifierOption(createdModifier.id, {
            name: option.name,
            price: option.price
          });
        }
      }

      onSave();
    } catch (err) {
      toast.error('Ошибка при сохранении блюда');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">
            {dish ? 'Редактировать блюдо' : 'Новое блюдо'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            aria-label="Закрыть"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

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
              onWheel={(e) => e.currentTarget.blur()}
              className="input w-full"
              step="0.01"
              min="0"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Цена должна быть 0 или больше</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Скидка (%)</label>
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className="input w-full"
              min="0"
              max="100"
              placeholder="Например: 10, 20, 50"
            />
            <p className="text-xs text-gray-500 mt-1">Оставьте пустым, если скидки нет</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Аллергены</label>
            <div className="grid grid-cols-2 gap-2">
              {availableAllergens.map((allergen) => (
                <label
                  key={allergen.id}
                  className={`flex items-center gap-2 p-2 border rounded cursor-pointer transition-colors ${allergens.includes(allergen.id)
                    ? 'bg-orange-50 border-orange-300'
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={allergens.includes(allergen.id)}
                    onChange={() => toggleAllergen(allergen.id)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">
                    {allergen.icon} {allergen.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Бэдж (наклейка на фото)</label>
            <select
              value={badge}
              onChange={(e) => setBadge(e.target.value)}
              className="input w-full"
            >
              <option value="">Без бэджа</option>
              <option value="NEW">🆕 NEW</option>
              <option value="HIT">🔥 HIT</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Выбранный бэдж будет отображаться слева сверху на фото</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Фото</label>
            {currentImageUrl && !imageFile && (
              <div className="relative mb-2">
                <ImageWithLoader
                  src={currentImageUrl}
                  alt={dish?.name || 'Блюдо'}
                  className="w-full h-48 object-cover rounded"
                  loading="lazy"
                />
                {dish && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteImage();
                    }}
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
            <label className="block text-sm font-medium mb-2">
              Модификаторы (размер, добавки, вкусы)
            </label>

            {/* Список модификаторов */}
            {modifiers.length > 0 && (
              <div className="space-y-4 mb-4">
                {modifiers.map((modifier) => (
                  <div key={modifier.id} className="border rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-medium">{modifier.name}</div>
                        <div className="text-xs text-gray-600">
                          {modifier.type === 'single' ? '☑️ Один выбор' : '☑️ Множественный выбор'}
                          {modifier.isRequired && ' • Обязательно'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteModifier(modifier)}
                        className="text-red-600 hover:text-red-800 text-sm px-2"
                      >
                        🗑️
                      </button>
                    </div>

                    {/* Опции модификатора */}
                    <div className="space-y-2 mt-2">
                      {(modifier.options || []).map((option) => (
                        <div key={option.id} className="bg-white border rounded p-2 flex items-center gap-2">
                          {/* Фото опции */}
                          {option.image && (
                            <div className="relative w-12 h-12 flex-shrink-0">
                              <ImageWithLoader
                                src={option.image}
                                alt={option.name}
                                className="w-full h-full object-cover rounded"
                                loading="lazy"
                              />
                              {!option.isNew && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteOptionImage(modifier, option);
                                  }}
                                  className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5"
                                  title="Удалить фото"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          )}

                          {/* Информация об опции */}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{option.name}</div>
                            {option.price > 0 && (
                              <div className="text-xs text-gray-600">+{option.price} {currency}</div>
                            )}
                            {option.isNew && (
                              <div className="text-xs text-orange-600">💡 Сохраните блюдо, чтобы добавить фото</div>
                            )}
                          </div>

                          {/* Кнопки действий */}
                          <div className="flex gap-1 flex-shrink-0">
                            {!option.isNew && !option.image && (
                              <label className="cursor-pointer text-blue-600 hover:text-blue-800 text-sm px-2">
                                📷
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) handleUploadOptionImage(modifier, option, file);
                                  }}
                                />
                              </label>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteOption(modifier, option)}
                              className="text-red-600 hover:text-red-800 text-sm px-2"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Кнопка добавления опции */}
                      <button
                        type="button"
                        onClick={() => handleAddOption(modifier)}
                        className="w-full text-left text-sm text-blue-600 hover:text-blue-800 p-2 border border-dashed rounded hover:bg-blue-50"
                      >
                        + Добавить опцию
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Форма добавления модификатора */}
            <div className="border rounded-lg p-3 bg-white">
              <div className="text-sm font-medium mb-2">Новый модификатор</div>
              <div className="space-y-2">
                <input
                  type="text"
                  value={newModifierName}
                  onChange={(e) => setNewModifierName(e.target.value)}
                  placeholder="Название (например: Размер)"
                  className="input w-full text-sm"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddModifier();
                    }
                  }}
                />
                <div className="flex gap-2">
                  <select
                    value={newModifierType}
                    onChange={(e) => setNewModifierType(e.target.value)}
                    className="input flex-1 text-sm"
                  >
                    <option value="single">☑️ Один выбор</option>
                    <option value="multi">☑️ Несколько вариантов</option>
                  </select>
                  <label className="flex items-center gap-1 text-sm whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={newModifierRequired}
                      onChange={(e) => setNewModifierRequired(e.target.checked)}
                    />
                    Обязательно
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddModifier}
                    className="btn-secondary flex-1 text-sm"
                  >
                    + Добавить модификатор
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTemplates(!showTemplates)}
                    className="btn-secondary text-sm px-3 whitespace-nowrap"
                    title="Выбрать из библиотеки"
                  >
                    📚 Из библиотеки
                  </button>
                </div>
              </div>
            </div>

            {/* Список шаблонов модификаторов */}
            {showTemplates && (
              <div className="border rounded-lg p-3 bg-gray-50 mt-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">Шаблоны модификаторов</div>
                  <button
                    onClick={() => setShowTemplates(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
                {loadingTemplates ? (
                  <div className="text-center py-4 text-gray-500 text-sm">Загрузка...</div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    Нет доступных шаблонов. Создайте их в разделе "Модификаторы"
                  </div>
                ) : (
                  <div className="space-y-2">
                    {templates.map((template) => (
                      <div key={template.id} className="bg-white border rounded p-2">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{template.name}</div>
                            <div className="text-xs text-gray-600">
                              {template.modifiers?.length || 0} модификаторов
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleApplyTemplate(template)}
                            disabled={!dish?.id}
                            className="btn-primary text-xs px-3 py-1 disabled:opacity-50"
                            title={!dish?.id ? 'Сначала сохраните блюдо' : 'Применить шаблон'}
                          >
                            Применить
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Модификаторы позволяют клиентам выбирать размер, вкус, добавки и т.д. Вы можете добавить фото для каждой опции.
            </p>
          </div>

          {/* Рекомендации */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium mb-2">
              💡 Рекомендации (что предложить с этим блюдом?)
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Выберите блюда, которые будут показаны как рекомендации при просмотре этого блюда.
              Это увеличит средний чек! 🚀
            </p>

            {loadingDishes ? (
              <div className="text-center py-4 text-gray-500 text-sm">Загрузка блюд...</div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-2 bg-gray-50">
                {allDishes
                  .filter(d => d.id !== dish?.id) // Исключаем текущее блюдо
                  .map((availableDish) => {
                    const isSelected = recommendationIds.includes(availableDish.id);
                    return (
                      <label
                        key={availableDish.id}
                        className={`flex items-center gap-3 p-2 border rounded cursor-pointer transition-colors ${isSelected
                          ? 'bg-primary-50 border-primary-300'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setRecommendationIds([...recommendationIds, availableDish.id]);
                            } else {
                              setRecommendationIds(recommendationIds.filter(id => id !== availableDish.id));
                            }
                          }}
                          className="w-4 h-4"
                        />
                        {availableDish.image && (
                          <ImageWithLoader
                            src={availableDish.image}
                            alt={availableDish.name}
                            className="w-12 h-12 object-cover rounded"
                            loading="lazy"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{availableDish.name}</div>
                          <div className="text-xs text-gray-500">
                            {availableDish.category?.name} • {availableDish.price} {currency}
                          </div>
                        </div>
                      </label>
                    );
                  })}
              </div>
            )}

            {recommendationIds.length > 0 && (
              <div className="mt-2 text-xs text-green-600">
                ✓ Выбрано блюд: {recommendationIds.length}
              </div>
            )}
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
        </form >
      </div >
    </div >
  );
};

export default MenuManagementPage;
