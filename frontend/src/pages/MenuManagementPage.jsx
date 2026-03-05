import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { menuService } from '../services/menuService';
import { restaurantService } from '../services/restaurantService';
import modifierTemplateService from '../services/modifierTemplateService';
import api from '../services/api';
import toast from 'react-hot-toast';
import { confirmDialog } from '../utils/confirmDialog';
import RestaurantSelector from '../components/RestaurantSelector';
import DashboardLayout from '../components/DashboardLayout';
import CategoryGroupsModal from '../components/CategoryGroupsModal';
import ImageWithLoader from '../components/ImageWithLoader';
import { useUserData } from '../hooks/useUserData';
import { useSelectedRestaurant } from '../hooks/useSelectedRestaurant';

const MenuManagementPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { userData, loading } = useUserData();
  const { selectedRestaurantId, setSelectedRestaurantId, selectedRestaurant } = useSelectedRestaurant(userData);
  const [categories, setCategories] = useState([]);
  const [dishes, setDishes] = useState({});
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
  const [dataTimestamp, setDataTimestamp] = useState(Date.now());
  const [showOptionStopModal, setShowOptionStopModal] = useState(false);
  const [selectedDishForOptionStops, setSelectedDishForOptionStops] = useState(null);
  const [optionStopLoadingId, setOptionStopLoadingId] = useState(null);

  // Автоматически выбираем ресторан при загрузке (handled by useSelectedRestaurant)

  const getSelectedRestaurant = () => selectedRestaurant;
  const isSharedMenuConsumer = Boolean(
    selectedRestaurant?.sharedMenuSourceRestaurantId &&
    selectedRestaurant?.sharedMenuSourceRestaurantId !== selectedRestaurantId
  );
  const isManagerForSelectedRestaurant = Boolean(
    selectedRestaurantId &&
    userData?.restaurantStaff?.some(
      (staff) => staff.restaurantId === selectedRestaurantId && staff.role === 'manager'
    )
  );

  const ensureMenuEditAllowed = () => {
    if (isSharedMenuConsumer) {
      toast.error('Для общей витрины редактируйте меню в ресторане-источнике');
      return false;
    }

    if (isManagerForSelectedRestaurant) {
      toast.error('Для менеджера доступен только стоп-лист точки');
      return false;
    }

    return true;
  };

  const dishHasModifierOptions = (dish) => (
    Array.isArray(dish?.modifiers) && dish.modifiers.some(
      (modifier) => Array.isArray(modifier?.options) && modifier.options.length > 0
    )
  );

  const getStopTargetRestaurantId = () => {
    if (isManagerForSelectedRestaurant) {
      return selectedRestaurantId;
    }
    if (isSharedMenuConsumer) {
      return selectedRestaurant?.sharedMenuSourceRestaurantId || selectedRestaurantId;
    }
    return selectedRestaurantId;
  };

  const findDishInCategories = (categoriesList, dishId) => {
    for (const category of categoriesList || []) {
      const found = (category?.dishes || []).find((dish) => dish.id === dishId);
      if (found) return found;
    }
    return null;
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
      return cats;
    } catch (err) {
      console.error('Error loading categories:', err);
      return [];
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
    if (!ensureMenuEditAllowed()) return;
    setEditingCategory(null);
    setShowCategoryModal(true);
  };

  const handleCopyMenu = async () => {
    if (!ensureMenuEditAllowed()) return;

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
    if (!ensureMenuEditAllowed()) return;
    setEditingCategory(category);
    setShowCategoryModal(true);
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!ensureMenuEditAllowed()) return;
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
    if (!ensureMenuEditAllowed()) return;
    setSelectedCategoryId(categoryId);
    setEditingDish(null);
    setShowDishModal(true);
  };

  const handleEditDish = (dish) => {
    if (!ensureMenuEditAllowed()) return;
    setSelectedCategoryId(dish.categoryId);
    setEditingDish(dish);
    setShowDishModal(true);
  };

  const handleDeleteDish = async (dishId) => {
    if (!ensureMenuEditAllowed()) return;
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

  const handleToggleAvailability = async (dish) => {
    if (!dish?.id) return;

    try {
      if (isSharedMenuConsumer || isManagerForSelectedRestaurant) {
        const sourceRestaurantId = selectedRestaurant?.sharedMenuSourceRestaurantId || selectedRestaurantId;
        const targetRestaurantId = isManagerForSelectedRestaurant ? selectedRestaurantId : sourceRestaurantId;
        const isStoppedForTarget = isManagerForSelectedRestaurant
          ? Boolean(dish.stoppedAtLocalRestaurant)
          : Boolean(dish.stoppedAtMenuSource);
        const nextStoppedState = !isStoppedForTarget;
        let reason = dish.stopReason || null;

        if (nextStoppedState) {
          const promptValue = window.prompt('Причина стоп-листа (необязательно):', dish.stopReason || '');
          if (promptValue === null) {
            return;
          }
          reason = promptValue.trim() || null;
        }

        await restaurantService.setDishStop(targetRestaurantId, dish.id, nextStoppedState, reason);
        toast.success(
          nextStoppedState
            ? (isManagerForSelectedRestaurant ? 'Блюдо добавлено в локальный стоп-лист точки' : 'Блюдо добавлено в глобальный стоп-лист')
            : (isManagerForSelectedRestaurant ? 'Блюдо снято с локального стоп-листа точки' : 'Блюдо снято с глобального стоп-листа')
        );
        await loadCategories(selectedRestaurantId);
        return;
      }

      const updatedDishes = { ...dishes };
      Object.keys(updatedDishes).forEach((categoryId) => {
        updatedDishes[categoryId] = updatedDishes[categoryId].map((item) =>
          item.id === dish.id ? { ...item, available: !item.available } : item
        );
      });
      setDishes(updatedDishes);
      await menuService.toggleDishAvailability(dish.id);
      await loadCategories(selectedRestaurantId);
    } catch (err) {
      toast.error('Ошибка при изменении статуса блюда');
      await loadCategories(selectedRestaurantId);
      console.error(err);
    }
  };

  const getOptionStoppedStateForScope = (option) => {
    if (isManagerForSelectedRestaurant) {
      return Boolean(option?.stoppedAtLocalRestaurant);
    }
    if (isSharedMenuConsumer) {
      return Boolean(option?.stoppedAtMenuSource);
    }
    return Boolean(option?.stoppedAtRestaurant);
  };

  const handleOpenOptionStopModal = (dish) => {
    if (!dishHasModifierOptions(dish)) {
      toast.error('У этого блюда нет опций модификаторов');
      return;
    }
    setSelectedDishForOptionStops(dish);
    setShowOptionStopModal(true);
  };

  const handleCloseOptionStopModal = () => {
    setShowOptionStopModal(false);
    setSelectedDishForOptionStops(null);
    setOptionStopLoadingId(null);
  };

  const handleToggleModifierOptionStop = async (option) => {
    if (!selectedDishForOptionStops?.id || !option?.id) return;

    if (isManagerForSelectedRestaurant && option.stoppedAtMenuSource) {
      toast.error('Опция в глобальном стоп-листе. Снимите его в главном ресторане.');
      return;
    }

    const targetRestaurantId = getStopTargetRestaurantId();
    if (!targetRestaurantId) {
      toast.error('Не удалось определить точку для стоп-листа');
      return;
    }

    const isStoppedForScope = getOptionStoppedStateForScope(option);
    const nextStoppedState = !isStoppedForScope;
    let reason = option.stopReason || null;

    if (nextStoppedState) {
      const promptValue = window.prompt('Причина стоп-листа для опции (необязательно):', option.stopReason || '');
      if (promptValue === null) return;
      reason = promptValue.trim() || null;
    }

    try {
      setOptionStopLoadingId(option.id);
      await restaurantService.setModifierOptionStop(targetRestaurantId, option.id, nextStoppedState, reason);
      toast.success(nextStoppedState ? 'Опция добавлена в стоп-лист' : 'Опция снята со стоп-листа');

      const refreshedCategories = await loadCategories(selectedRestaurantId);
      const refreshedDish = findDishInCategories(refreshedCategories, selectedDishForOptionStops.id);
      if (!refreshedDish) {
        handleCloseOptionStopModal();
        return;
      }
      setSelectedDishForOptionStops(refreshedDish);
    } catch (err) {
      toast.error('Ошибка при изменении статуса опции');
      console.error(err);
    } finally {
      setOptionStopLoadingId(null);
    }
  };

  const handleCategoryDragStart = (e, categoryId) => {
    if (!ensureMenuEditAllowed()) {
      e.preventDefault();
      return;
    }

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

    if (!ensureMenuEditAllowed()) {
      setDraggedCategoryId(null);
      return;
    }

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
    if (!ensureMenuEditAllowed()) {
      e.preventDefault();
      return;
    }

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

    if (!ensureMenuEditAllowed()) {
      setDraggedDishId(null);
      return;
    }

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
      <div className="max-w-6xl mx-auto">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Управление меню</h1>
          <p className="text-gray-500 text-sm mt-1">Категории, блюда и модификаторы</p>
        </div>
        {/* Restaurant Selector */}
        {userData && (
          <div className="mb-6">
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

        {selectedRestaurantId && isSharedMenuConsumer && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Для этой точки используется общее меню главного ресторана. Редактирование категорий и блюд отключено, доступен только локальный стоп-лист.
          </div>
        )}

        {selectedRestaurantId && isManagerForSelectedRestaurant && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Вы вошли как менеджер. Доступно только управление стоп-листом текущей точки.
          </div>
        )}

        {/* Add Category Button */}
        <div className="mb-4 flex justify-between items-center gap-2 flex-wrap">
          <h2 className="text-lg font-semibold text-gray-900">Категории и блюда</h2>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowCategoryGroupsModal(true)} className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
              <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
              Группы категорий
            </button>
            <button
              onClick={() => setShowCopyModal(true)}
              disabled={isSharedMenuConsumer || isManagerForSelectedRestaurant}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.5a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg>
              Копировать меню
            </button>
            <button
              onClick={handleAddCategory}
              disabled={isSharedMenuConsumer || isManagerForSelectedRestaurant}
              title={isSharedMenuConsumer ? 'Редактирование делается в ресторане-источнике' : isManagerForSelectedRestaurant ? 'Менеджер может управлять только стоп-листом' : 'Добавить категорию'}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Добавить категорию
            </button>
          </div>
        </div>

        {/* Categories List */}
        {categories.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Меню пусто</h3>
            <p className="text-gray-500 text-sm mb-4">Начните с создания первой категории</p>
            <button
              onClick={handleAddCategory}
              disabled={isSharedMenuConsumer || isManagerForSelectedRestaurant}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Создать категорию
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {categories.map((category) => (
              <div
                key={category.id}
                className={`bg-white rounded-xl border transition-all ${draggedCategoryId === category.id ? 'opacity-50' : ''} ${dragOverCategoryId === category.id ? 'border-blue-400 bg-blue-50' : 'border-gray-100'}`}
                draggable={!isSharedMenuConsumer && !isManagerForSelectedRestaurant}
                onDragStart={(e) => handleCategoryDragStart(e, category.id)}
                onDragOver={(e) => handleCategoryDragOver(e, category.id)}
                onDragLeave={handleCategoryDragLeave}
                onDrop={(e) => handleCategoryDrop(e, category.id)}
              >
                {/* Category Header */}
                <div className={`flex items-center justify-between px-5 py-4 ${(isSharedMenuConsumer || isManagerForSelectedRestaurant) ? '' : 'cursor-move'}`}>
                  <div className="flex items-center gap-3 flex-1 min-w-0" onClick={() => toggleCategory(category.id)}>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ${expandedCategories.has(category.id) ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-gray-900 break-words">{category.name}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {dishes[category.id]?.length || 0} блюд
                      </p>
                    </div>
                  </div>
                  {/* Action Buttons */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleAddDish(category.id)}
                      disabled={isSharedMenuConsumer || isManagerForSelectedRestaurant}
                      className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                      Блюдо
                    </button>
                    <button
                      onClick={() => handleEditCategory(category)}
                      disabled={isSharedMenuConsumer || isManagerForSelectedRestaurant}
                      className="p-1.5 border border-gray-200 rounded-lg text-gray-400 hover:text-orange-500 hover:border-orange-200 bg-white hover:bg-orange-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Редактировать"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      disabled={isSharedMenuConsumer || isManagerForSelectedRestaurant}
                      className="p-1.5 border border-gray-200 rounded-lg text-gray-400 hover:text-red-500 hover:border-red-200 bg-white hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Удалить"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                    </button>
                  </div>
                </div>

                {/* Dishes List */}
                {expandedCategories.has(category.id) && (
                  <div className="border-t border-gray-100">
                    {dishes[category.id]?.length === 0 ? (
                      <p className="text-gray-400 text-sm py-6 text-center">Нет блюд в этой категории</p>
                    ) : (
                      dishes[category.id]?.map((dish, idx) => (
                        <div
                          key={dish.id}
                          className={`flex items-center gap-4 px-5 py-3 transition-colors ${(isSharedMenuConsumer || isManagerForSelectedRestaurant) ? '' : 'cursor-move'} ${draggedDishId === dish.id ? 'opacity-50' : ''} ${dragOverDishId === dish.id ? 'bg-blue-50' : 'hover:bg-gray-50'} ${idx > 0 ? 'border-t border-gray-50' : ''}`}
                          draggable={!isSharedMenuConsumer && !isManagerForSelectedRestaurant}
                          onDragStart={(e) => handleDishDragStart(e, dish.id)}
                          onDragOver={(e) => handleDishDragOver(e, dish.id)}
                          onDragLeave={handleDishDragLeave}
                          onDrop={(e) => handleDishDrop(e, dish.id, category.id)}
                        >
                          {/* Drag handle */}
                          <div className="flex-shrink-0 text-gray-300 hidden sm:block">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-8a2 2 0 10-.001-4.001A2 2 0 0013 6zm0 2a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z" /></svg>
                          </div>

                          {/* Image */}
                          <div className="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden">
                            {dish.imageUrl ? (
                              <ImageWithLoader
                                src={`${dish.imageUrl}?t=${dataTimestamp}`}
                                alt={dish.name}
                                className="w-12 h-12 object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gray-100 flex items-center justify-center">
                                <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V5.25a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                                </svg>
                              </div>
                            )}
                            {dish.badge && (
                              <div className="absolute top-0 left-0 bg-orange-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-br">
                                {dish.badge}
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-medium text-gray-900 truncate">{dish.name}</h4>
                              {dish.stoppedAtRestaurant && (
                                <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-semibold rounded">
                                  СТОП
                                </span>
                              )}
                              {!dish.stoppedAtRestaurant && !dish.available && (
                                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded">
                                  НЕДОСТУПНО
                                </span>
                              )}
                            </div>
                            {dish.description && (
                              <p className="text-xs text-gray-400 truncate mt-0.5">{dish.description}</p>
                            )}
                          </div>

                          {/* Price */}
                          <div className="flex-shrink-0 text-right tabular-nums">
                            <div className="sm:hidden text-xs font-semibold text-gray-900">
                              {dish.price}/{dish.deliveryPrice ?? dish.price} {currency}
                            </div>
                            <div className="hidden sm:block text-sm font-semibold text-gray-900">
                              Зал: {dish.price} {currency}
                            </div>
                            <div className="hidden sm:block text-xs text-gray-500">
                              Доставка: {dish.deliveryPrice ?? dish.price} {currency}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {dishHasModifierOptions(dish) && (
                              <button
                                onClick={() => handleOpenOptionStopModal(dish)}
                                className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors"
                                title="Стоп по опциям"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6.75h15m-15 5.25h15m-15 5.25h15" />
                                  <circle cx="8" cy="6.75" r="1.25" fill="currentColor" />
                                  <circle cx="15.5" cy="12" r="1.25" fill="currentColor" />
                                  <circle cx="11" cy="17.25" r="1.25" fill="currentColor" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={() => handleToggleAvailability(dish)}
                              className={`p-1.5 rounded-lg transition-colors ${isManagerForSelectedRestaurant
                                ? (dish.stoppedAtLocalRestaurant ? 'text-red-500 hover:bg-red-50' : 'text-green-500 hover:bg-green-50')
                                : isSharedMenuConsumer
                                  ? (dish.stoppedAtMenuSource ? 'text-red-500 hover:bg-red-50' : 'text-green-500 hover:bg-green-50')
                                  : (!dish.available ? 'text-red-500 hover:bg-red-50' : 'text-green-500 hover:bg-green-50')}`}
                              title={isSharedMenuConsumer
                                ? (dish.stoppedAtMenuSource ? 'Снять с глобального стоп-листа' : 'Поставить в глобальный стоп-лист')
                                : isManagerForSelectedRestaurant
                                  ? (dish.stoppedAtLocalRestaurant ? 'Снять с локального стоп-листа точки' : 'Поставить в локальный стоп-лист точки')
                                  : (dish.available ? 'Поставить на стоп' : 'Вернуть в меню')}
                            >
                              {(isManagerForSelectedRestaurant
                                ? dish.stoppedAtLocalRestaurant
                                : isSharedMenuConsumer
                                  ? dish.stoppedAtMenuSource
                                  : !dish.available) ? (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" /></svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                              )}
                            </button>
                            <button
                              onClick={() => handleEditDish(dish)}
                              disabled={isSharedMenuConsumer || isManagerForSelectedRestaurant}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Редактировать"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                            </button>
                            <button
                              onClick={() => handleDeleteDish(dish.id)}
                              disabled={isSharedMenuConsumer || isManagerForSelectedRestaurant}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Удалить"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
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

      {/* Modifier Option Stop Modal */}
      {showOptionStopModal && selectedDishForOptionStops && (
        <ModifierOptionStopModal
          dish={selectedDishForOptionStops}
          currency={currency}
          isManagerForSelectedRestaurant={isManagerForSelectedRestaurant}
          isSharedMenuConsumer={isSharedMenuConsumer}
          loadingOptionId={optionStopLoadingId}
          onToggleOptionStop={handleToggleModifierOptionStop}
          onClose={handleCloseOptionStopModal}
        />
      )}

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
  const [deliveryPrice, setDeliveryPrice] = useState(dish?.deliveryPrice || '');
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
  const [optionEditorByModifier, setOptionEditorByModifier] = useState({});

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
    setOptionEditorByModifier({});
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
      console.log('🔄 Loading dishes for restaurant:', restaurantId);
      const response = await api.get(`/dishes/restaurant/${restaurantId}/all`);
      const data = response.data;
      console.log(`✅ Loaded ${data.length} dishes`);
      setAllDishes(data);
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
      setTemplates(Array.isArray(data) ? data : (data.templates || []));
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
        const created = await menuService.createModifier(dish.id, { ...modifierData, restaurantId });
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
        await menuService.deleteModifier(modifier.id, restaurantId);
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
      await modifierTemplateService.applyToDish(template.id, dish.id, restaurantId);
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
  const openOptionEditor = (modifier, option = null) => {
    const editorState = option
      ? {
        optionId: option.id,
        name: option.name || '',
        price: String(option.price ?? 0),
        deliveryPrice: option.deliveryPrice === null || option.deliveryPrice === undefined
          ? ''
          : String(option.deliveryPrice)
      }
      : {
        optionId: null,
        name: '',
        price: '0',
        deliveryPrice: ''
      };

    setOptionEditorByModifier(prev => ({
      ...prev,
      [modifier.id]: editorState
    }));
  };

  const closeOptionEditor = (modifierId) => {
    setOptionEditorByModifier(prev => {
      const next = { ...prev };
      delete next[modifierId];
      return next;
    });
  };

  const updateOptionEditorField = (modifierId, field, value) => {
    setOptionEditorByModifier(prev => ({
      ...prev,
      [modifierId]: {
        ...(prev[modifierId] || { optionId: null, name: '', price: '0', deliveryPrice: '' }),
        [field]: value
      }
    }));
  };

  const handleSaveOption = async (modifier) => {
    const editor = optionEditorByModifier[modifier.id];
    if (!editor) return;

    const optionName = (editor.name || '').trim();
    if (!optionName) {
      toast.error('Название опции обязательно');
      return;
    }

    const parsedPrice = parseFloat(editor.price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      toast.error('Цена в зале должна быть числом больше или равным 0');
      return;
    }

    let parsedDeliveryPrice = null;
    if (String(editor.deliveryPrice || '').trim() !== '') {
      parsedDeliveryPrice = parseFloat(editor.deliveryPrice);
      if (isNaN(parsedDeliveryPrice) || parsedDeliveryPrice < 0) {
        toast.error('Цена доставки должна быть числом больше или равным 0');
        return;
      }
    }

    const optionData = {
      name: optionName,
      price: parsedPrice,
      deliveryPrice: parsedDeliveryPrice
    };

    if (editor.optionId) {
      const existingOption = (modifier.options || []).find(o => o.id === editor.optionId);

      if (existingOption && !existingOption.isNew && dish?.id) {
        try {
          const updated = await menuService.updateModifierOption(existingOption.id, { ...optionData, restaurantId }, restaurantId);
          setModifiers(prev => prev.map(m =>
            m.id === modifier.id
              ? { ...m, options: (m.options || []).map(o => o.id === existingOption.id ? { ...o, ...updated } : o) }
              : m
          ));
          toast.success('Опция обновлена');
        } catch (err) {
          toast.error('Ошибка при обновлении опции');
          console.error(err);
          return;
        }
      } else {
        setModifiers(prev => prev.map(m =>
          m.id === modifier.id
            ? { ...m, options: (m.options || []).map(o => o.id === editor.optionId ? { ...o, ...optionData } : o) }
            : m
        ));
      }

      closeOptionEditor(modifier.id);
      return;
    }

    if (!modifier.isNew && dish?.id) {
      try {
        const created = await menuService.createModifierOption(modifier.id, { ...optionData, restaurantId });
        setModifiers(prev => prev.map(m =>
          m.id === modifier.id
            ? { ...m, options: [...(m.options || []), created] }
            : m
        ));
        toast.success('Опция добавлена. Теперь можно загрузить фото 📷');
      } catch (err) {
        toast.error('Ошибка при добавлении опции');
        console.error(err);
        return;
      }
    } else {
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
      toast('💡 Сохраните блюдо, чтобы добавить фото к опциям', { icon: 'ℹ️' });
    }

    closeOptionEditor(modifier.id);
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
        await menuService.deleteModifierOption(option.id, restaurantId);
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
      }, restaurantId);

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
      await menuService.deleteModifierOptionImage(option.id, restaurantId);
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

    const parsedDeliveryPrice = deliveryPrice ? parseFloat(deliveryPrice) : null;
    if (parsedDeliveryPrice !== null && (isNaN(parsedDeliveryPrice) || parsedDeliveryPrice < 0)) {
      toast.error('Цена доставки должна быть числом больше или равным 0');
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
        deliveryPrice: parsedDeliveryPrice,
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
          isRequired: modifier.isRequired,
          restaurantId
        });

        // Создаем опции для модификатора
        const newOptions = (modifier.options || []).filter(o => o.isNew);
        for (const option of newOptions) {
          await menuService.createModifierOption(createdModifier.id, {
            name: option.name,
            price: option.price,
            deliveryPrice: option.deliveryPrice,
            restaurantId
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Цена в зале ({currency})</label>
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
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Цена доставки ({currency})</label>
              <input
                type="number"
                value={deliveryPrice}
                onChange={(e) => setDeliveryPrice(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                className="input w-full"
                step="0.01"
                min="0"
                placeholder="Как в зале"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 -mt-2">Если цена доставки не указана, используется цена в зале</p>

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
                              <div className="text-xs text-gray-600">Зал: +{option.price} {currency}</div>
                            )}
                            {(option.deliveryPrice !== null && option.deliveryPrice !== undefined) && (
                              <div className="text-xs text-gray-600">Доставка: +{option.deliveryPrice} {currency}</div>
                            )}
                            {option.isNew && (
                              <div className="text-xs text-orange-600">💡 Сохраните блюдо, чтобы добавить фото</div>
                            )}
                          </div>

                          {/* Кнопки действий */}
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => openOptionEditor(modifier, option)}
                              className="text-gray-600 hover:text-gray-800 text-sm px-2"
                              title="Редактировать опцию"
                            >
                              ✏️
                            </button>
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
                        onClick={() => openOptionEditor(modifier)}
                        className="w-full text-left text-sm text-blue-600 hover:text-blue-800 p-2 border border-dashed rounded hover:bg-blue-50"
                      >
                        + Добавить опцию
                      </button>

                      {optionEditorByModifier[modifier.id] && (
                        <div className="bg-white border rounded p-3 space-y-2">
                          <input
                            type="text"
                            value={optionEditorByModifier[modifier.id].name}
                            onChange={(e) => updateOptionEditorField(modifier.id, 'name', e.target.value)}
                            placeholder="Название опции"
                            className="input w-full text-sm"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={optionEditorByModifier[modifier.id].price}
                              onChange={(e) => updateOptionEditorField(modifier.id, 'price', e.target.value)}
                              placeholder="Цена в зале"
                              className="input w-full text-sm"
                            />
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={optionEditorByModifier[modifier.id].deliveryPrice}
                              onChange={(e) => updateOptionEditorField(modifier.id, 'deliveryPrice', e.target.value)}
                              placeholder="Цена доставки"
                              className="input w-full text-sm"
                            />
                          </div>
                          <p className="text-xs text-gray-500">Если цена доставки пустая, используется цена в зале</p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleSaveOption(modifier)}
                              className="btn-primary text-sm flex-1"
                            >
                              {optionEditorByModifier[modifier.id].optionId ? 'Сохранить опцию' : 'Добавить опцию'}
                            </button>
                            <button
                              type="button"
                              onClick={() => closeOptionEditor(modifier.id)}
                              className="btn-secondary text-sm"
                            >
                              Отмена
                            </button>
                          </div>
                        </div>
                      )}
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
              <div className="max-h-72 overflow-y-auto border rounded-lg bg-gray-50">
                {allDishes
                  .filter(d => d.id !== dish?.id) // Исключаем текущее блюдо
                  .map((availableDish) => {
                    const isSelected = recommendationIds.includes(availableDish.id);
                    return (
                      <label
                        key={availableDish.id}
                        className={`flex items-center gap-3 p-3 border-b last:border-b-0 cursor-pointer transition-colors ${isSelected
                          ? 'bg-green-50'
                          : 'bg-white hover:bg-gray-50'
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
                          className="w-4 h-4 flex-shrink-0 accent-green-500"
                        />
                        <div className="w-10 h-10 flex-shrink-0 rounded overflow-hidden bg-gray-200">
                          {availableDish.image ? (
                            <ImageWithLoader
                              src={availableDish.image}
                              alt={availableDish.name}
                              className="w-10 h-10 object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-10 h-10 flex items-center justify-center text-gray-400 text-lg">🍽</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="font-medium text-sm truncate">{availableDish.name}</div>
                          <div className="text-xs text-gray-500 truncate">
                            {availableDish.category?.name}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-gray-700 flex-shrink-0 whitespace-nowrap">
                          {availableDish.price} {currency}
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

const ModifierOptionStopModal = ({
  dish,
  currency = '₽',
  isManagerForSelectedRestaurant = false,
  isSharedMenuConsumer = false,
  loadingOptionId = null,
  onToggleOptionStop,
  onClose
}) => {
  const modifiersWithOptions = (dish?.modifiers || []).filter(
    (modifier) => Array.isArray(modifier?.options) && modifier.options.length > 0
  );

  const getStoppedStateForScope = (option) => {
    if (isManagerForSelectedRestaurant) return Boolean(option?.stoppedAtLocalRestaurant);
    if (isSharedMenuConsumer) return Boolean(option?.stoppedAtMenuSource);
    return Boolean(option?.stoppedAtRestaurant);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-lg w-full max-w-xl max-h-[90vh] overflow-y-auto p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-bold">Стоп по опциям</h3>
            <p className="text-sm text-gray-600 break-words">{dish?.name}</p>
          </div>
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

        {modifiersWithOptions.length === 0 ? (
          <p className="text-sm text-gray-500">У блюда нет опций модификаторов.</p>
        ) : (
          <div className="space-y-4">
            {modifiersWithOptions.map((modifier) => (
              <div key={modifier.id} className="border border-gray-200 rounded-lg p-3">
                <div className="font-medium text-sm mb-2">
                  {modifier.name}
                  {modifier.isRequired && <span className="text-red-500 ml-1">*</span>}
                </div>
                <div className="space-y-2">
                  {(modifier.options || []).map((option) => {
                    const isStoppedForScope = getStoppedStateForScope(option);
                    const isGlobalStop = Boolean(option?.stoppedAtMenuSource);
                    const isToggleLocked = isManagerForSelectedRestaurant && isGlobalStop;
                    const isLoading = loadingOptionId === option.id;

                    return (
                      <div key={option.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium break-words">{option.name}</div>
                          <div className="text-xs text-gray-500">
                            {option.price > 0 ? `+${option.price} ${currency}` : 'Без доплаты'}
                          </div>
                          {option.stopReason && (option.stoppedAtRestaurant || option.stoppedAtMenuSource || option.stoppedAtLocalRestaurant) && (
                            <div className="text-xs text-gray-500 mt-1 break-words">Причина: {option.stopReason}</div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isStoppedForScope && (
                            <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 text-[11px] font-semibold">
                              СТОП
                            </span>
                          )}
                          <button
                            type="button"
                            disabled={isLoading || isToggleLocked}
                            onClick={() => onToggleOptionStop(option)}
                            className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${isStoppedForScope
                              ? 'border-red-200 text-red-600 hover:bg-red-50'
                              : 'border-green-200 text-green-700 hover:bg-green-50'} disabled:opacity-50 disabled:cursor-not-allowed`}
                            title={isToggleLocked ? 'Опция остановлена глобально' : undefined}
                          >
                            {isLoading
                              ? '...'
                              : isToggleLocked
                                ? 'Глобальный стоп'
                                : isStoppedForScope
                                  ? 'Снять стоп'
                                  : 'Поставить стоп'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MenuManagementPage;
