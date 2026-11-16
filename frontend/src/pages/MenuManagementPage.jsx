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
import { getBusinessType } from '../utils/businessTypes';
import { cacheBustImage } from '../utils/imageCache';

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
  const [showDishStopMatrixModal, setShowDishStopMatrixModal] = useState(false);
  const [selectedDishForStops, setSelectedDishForStops] = useState(null);
  const [dishStopMatrix, setDishStopMatrix] = useState(null);
  const [loadingDishStopMatrix, setLoadingDishStopMatrix] = useState(false);
  const [savingDishStopMatrix, setSavingDishStopMatrix] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');

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
  const isOwnerForSelectedRestaurant = Boolean(
    userData?.isAdmin ||
    (selectedRestaurantId && userData?.restaurants?.some((restaurant) => restaurant.id === selectedRestaurantId))
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
    if (isManagerForSelectedRestaurant || isSharedMenuConsumer) {
      return selectedRestaurantId;
    }
    return selectedRestaurantId;
  };

  const isLocalStopScope = () => isManagerForSelectedRestaurant && !isOwnerForSelectedRestaurant;
  const canManageDishStopMatrix = () => Boolean(isOwnerForSelectedRestaurant && selectedRestaurantId);

  const getDishStoppedStateForScope = (dish) => {
    if (isLocalStopScope()) {
      return Boolean(dish?.stoppedAtLocalRestaurant);
    }
    return Boolean(dish?.stoppedAtRestaurant || !dish?.available);
  };

  const getDishStopButtonTitle = (dish) => {
    if (isLocalStopScope()) {
      if (dish?.stoppedAtMenuSource && !dish?.stoppedAtLocalRestaurant) {
        return 'Блюдо в глобальном стоп-листе. Снимите стоп в ресторане-источнике';
      }
      return dish?.stoppedAtLocalRestaurant
        ? 'Снять с локального стоп-листа точки'
        : 'Поставить в локальный стоп-лист точки';
    }

    return canManageDishStopMatrix()
      ? 'Управлять стоп-листом по точкам'
      : (dish?.available ? 'Поставить на стоп' : 'Вернуть в меню');
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
      setCategoriesLoading(true);
      setCategoriesError('');
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
      setCategoriesError(err.response?.data?.error || 'Не удалось загрузить меню');
      return [];
    } finally {
      setCategoriesLoading(false);
    }
  };

  const loadCategoryGroups = async (restaurantId) => {
    try {
      const { categoryGroupService } = await import('../services/categoryGroupService');
      const groups = await categoryGroupService.getCategoryGroups(restaurantId);
      console.log('Loaded category groups:', groups);
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

  const handleOpenDishStopMatrixModal = async (dish) => {
    if (!dish?.id || !selectedRestaurantId) return;

    setSelectedDishForStops(dish);
    setDishStopMatrix(null);
    setShowDishStopMatrixModal(true);
    setLoadingDishStopMatrix(true);

    try {
      const matrix = await restaurantService.getDishStopMatrix(selectedRestaurantId, dish.id);
      setDishStopMatrix(matrix);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Ошибка при загрузке стоп-листа');
      setShowDishStopMatrixModal(false);
      setSelectedDishForStops(null);
      console.error(err);
    } finally {
      setLoadingDishStopMatrix(false);
    }
  };

  const handleCloseDishStopMatrixModal = () => {
    if (savingDishStopMatrix) return;
    setShowDishStopMatrixModal(false);
    setSelectedDishForStops(null);
    setDishStopMatrix(null);
  };

  const handleSaveDishStopMatrix = async (data) => {
    if (!selectedDishForStops?.id || !selectedRestaurantId) return;

    setSavingDishStopMatrix(true);
    try {
      await restaurantService.updateDishStopMatrix(selectedRestaurantId, selectedDishForStops.id, data);
      toast.success('Стоп-лист блюда обновлён');
      setShowDishStopMatrixModal(false);
      setSelectedDishForStops(null);
      setDishStopMatrix(null);
      await loadCategories(selectedRestaurantId);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Ошибка при сохранении стоп-листа');
      console.error(err);
    } finally {
      setSavingDishStopMatrix(false);
    }
  };

  const handleToggleAvailability = async (dish) => {
    if (!dish?.id) return;

    try {
      if (canManageDishStopMatrix()) {
        await handleOpenDishStopMatrixModal(dish);
        return;
      }

      if (isLocalStopScope()) {
        if (dish.stoppedAtMenuSource && !dish.stoppedAtLocalRestaurant) {
          toast.error('Блюдо в глобальном стоп-листе. Снимите стоп в ресторане-источнике.');
          return;
        }

        const targetRestaurantId = getStopTargetRestaurantId();
        const isStoppedForTarget = Boolean(dish.stoppedAtLocalRestaurant);
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
            ? 'Блюдо добавлено в локальный стоп-лист точки'
            : (dish.stoppedAtMenuSource ? 'Локальный стоп снят, но блюдо осталось в глобальном стоп-листе' : 'Блюдо снято с локального стоп-листа точки')
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

  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase('ru-RU');
  const isFilteringMenu = Boolean(normalizedSearchQuery) || availabilityFilter !== 'all';

  const getFilteredDishes = (category) => {
    const categoryDishes = dishes[category.id] || [];
    const categoryMatches = normalizedSearchQuery
      && category.name?.toLocaleLowerCase('ru-RU').includes(normalizedSearchQuery);

    return categoryDishes.filter((dish) => {
      const matchesSearch = !normalizedSearchQuery
        || categoryMatches
        || dish.name?.toLocaleLowerCase('ru-RU').includes(normalizedSearchQuery)
        || dish.description?.toLocaleLowerCase('ru-RU').includes(normalizedSearchQuery);
      const isStopped = getDishStoppedStateForScope(dish) || dish.available === false;
      const matchesAvailability = availabilityFilter === 'all'
        || (availabilityFilter === 'available' && !isStopped)
        || (availabilityFilter === 'stopped' && isStopped);

      return matchesSearch && matchesAvailability;
    });
  };

  const filteredCategories = categories.filter((category) => {
    if (!isFilteringMenu) return true;
    const categoryMatches = normalizedSearchQuery
      && category.name?.toLocaleLowerCase('ru-RU').includes(normalizedSearchQuery);
    return categoryMatches || getFilteredDishes(category).length > 0;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Загрузка...</div>
      </div>
    );
  }

  return (
    <DashboardLayout userData={userData} selectedRestaurantId={selectedRestaurantId}>
      <div className="mx-auto max-w-[1280px]">
        <div className="page-header">
          <div>
            <p className="page-eyebrow">Меню</p>
            <h1 className="page-title">Категории и блюда</h1>
            <p className="page-description">Управляйте составом меню, ценами и доступностью позиций.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedRestaurant?.subdomain && (
              <a
                href={`/${getBusinessType(selectedRestaurant.businessType).route}/${selectedRestaurant.subdomain}`}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                  <circle cx="12" cy="12" r="2.5" />
                </svg>
                Открыть гостевое меню
              </a>
            )}
            <button
              type="button"
              onClick={() => categories[0] && handleAddDish(categories[0].id)}
              disabled={!categories.length || isSharedMenuConsumer || isManagerForSelectedRestaurant}
              className="btn-primary"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" d="M12 5v14M5 12h14" />
              </svg>
              Добавить блюдо
            </button>
          </div>
        </div>

        {/* Restaurant Selector */}
        {userData && (
          <div className="surface mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">Выбранное заведение</p>
              <p className="mt-0.5 text-xs text-gray-500">Изменения применятся только к выбранной точке.</p>
            </div>
            <div className="w-full sm:max-w-sm">
              <RestaurantSelector
                userData={userData}
                selectedRestaurantId={selectedRestaurantId}
                placeholderLabel={selectedRestaurant ? getBusinessType(selectedRestaurant.businessType).label.toLowerCase() : 'заведение'}
                onSelectRestaurant={(id) => {
                  setSelectedRestaurantId(id);
                  localStorage.setItem('selectedRestaurantId', id);
                }}
              />
            </div>
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

        <div className="surface mb-4 p-3 sm:p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              <label className="relative block flex-1">
                <span className="sr-only">Найти блюдо или категорию</span>
                <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="m20 20-3.5-3.5" />
                </svg>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Найти блюдо или категорию"
                  className="input pl-10"
                />
              </label>
              <select
                value={availabilityFilter}
                onChange={(event) => setAvailabilityFilter(event.target.value)}
                className="select-field sm:w-48"
                aria-label="Фильтр доступности"
              >
                <option value="all">Все позиции</option>
                <option value="available">В меню</option>
                <option value="stopped">В стоп-листе</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setShowCategoryGroupsModal(true)} className="btn-secondary">
                Группы
              </button>
              <button
                type="button"
                onClick={() => setShowCopyModal(true)}
                disabled={isSharedMenuConsumer || isManagerForSelectedRestaurant}
                className="btn-secondary"
              >
                Копировать
              </button>
              <button
                type="button"
                onClick={handleAddCategory}
                disabled={isSharedMenuConsumer || isManagerForSelectedRestaurant}
                title={isSharedMenuConsumer ? 'Редактирование выполняется в заведении-источнике' : isManagerForSelectedRestaurant ? 'Менеджер управляет только стоп-листом' : 'Добавить категорию'}
                className="btn-secondary"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>
                Категория
              </button>
            </div>
          </div>
        </div>

        {/* Categories List */}
        {categoriesLoading ? (
          <div className="surface space-y-4 p-5" aria-live="polite" aria-label="Загрузка меню">
            {[0, 1, 2].map((item) => (
              <div key={item} className="animate-pulse rounded-2xl border border-gray-100 p-4">
                <div className="h-4 w-40 rounded bg-gray-200" />
                <div className="mt-3 h-3 w-24 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : categoriesError ? (
          <div className="surface px-5 py-14 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-error-50 text-error-600">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.7 2.6 17a2 2 0 0 0 1.73 3h15.34a2 2 0 0 0 1.73-3L13.7 3.7a2 2 0 0 0-3.4 0Z" /></svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-950">Не удалось загрузить меню</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">{categoriesError}</p>
            <button type="button" onClick={() => loadCategories(selectedRestaurantId)} className="btn-primary mt-5">Повторить</button>
          </div>
        ) : categories.length === 0 ? (
          <div className="surface py-16 text-center">
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
              className="btn-primary"
            >
              Создать категорию
            </button>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="surface px-5 py-14 text-center">
            <h3 className="text-lg font-semibold text-gray-950">Ничего не найдено</h3>
            <p className="mt-2 text-sm text-gray-500">Измените запрос или сбросьте фильтр доступности.</p>
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setAvailabilityFilter('all'); }}
              className="btn-secondary mt-5"
            >
              Сбросить фильтры
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCategories.map((category) => (
              <div
                key={category.id}
                className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-all ${draggedCategoryId === category.id ? 'opacity-50' : ''} ${dragOverCategoryId === category.id ? 'border-primary-400 bg-primary-50' : 'border-gray-200'}`}
                draggable={!isFilteringMenu && !isSharedMenuConsumer && !isManagerForSelectedRestaurant}
                onDragStart={(e) => handleCategoryDragStart(e, category.id)}
                onDragOver={(e) => handleCategoryDragOver(e, category.id)}
                onDragLeave={handleCategoryDragLeave}
                onDrop={(e) => handleCategoryDrop(e, category.id)}
              >
                {/* Category Header */}
                <div className={`flex items-center justify-between gap-3 px-4 py-4 sm:px-5 ${(!isFilteringMenu && !isSharedMenuConsumer && !isManagerForSelectedRestaurant) ? 'cursor-move' : ''}`}>
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => toggleCategory(category.id)} aria-expanded={expandedCategories.has(category.id)}>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ${expandedCategories.has(category.id) ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-gray-900 break-words">{category.name}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {getFilteredDishes(category).length} из {dishes[category.id]?.length || 0} блюд
                      </p>
                    </div>
                  </button>
                  {/* Action Buttons */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleAddDish(category.id)}
                      disabled={isSharedMenuConsumer || isManagerForSelectedRestaurant}
                      className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:border-primary-200 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                      Блюдо
                    </button>
                    <button
                      onClick={() => handleEditCategory(category)}
                      disabled={isSharedMenuConsumer || isManagerForSelectedRestaurant}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 transition-colors hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                      title="Редактировать"
                      aria-label={`Редактировать категорию «${category.name}»`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      disabled={isSharedMenuConsumer || isManagerForSelectedRestaurant}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 transition-colors hover:border-error-100 hover:bg-error-50 hover:text-error-600 disabled:cursor-not-allowed disabled:opacity-50"
                      title="Удалить"
                      aria-label={`Удалить категорию «${category.name}»`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                    </button>
                  </div>
                </div>

                {/* Dishes List */}
                {expandedCategories.has(category.id) && (
                  <div className="border-t border-gray-100">
                    {getFilteredDishes(category).length === 0 ? (
                      <p className="text-gray-400 text-sm py-6 text-center">Нет блюд в этой категории</p>
                    ) : (
                      getFilteredDishes(category).map((dish, idx) => (
                        <div
                          key={dish.id}
                          className={`flex flex-wrap items-center gap-3 px-4 py-3.5 transition-colors sm:flex-nowrap sm:gap-4 sm:px-5 ${(!isFilteringMenu && !isSharedMenuConsumer && !isManagerForSelectedRestaurant) ? 'cursor-move' : ''} ${draggedDishId === dish.id ? 'opacity-50' : ''} ${dragOverDishId === dish.id ? 'bg-primary-50' : 'hover:bg-gray-50/80'} ${idx > 0 ? 'border-t border-gray-100' : ''}`}
                          draggable={!isFilteringMenu && !isSharedMenuConsumer && !isManagerForSelectedRestaurant}
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
                          <div className="ml-auto flex w-full flex-shrink-0 items-center justify-end gap-1 sm:w-auto">
                            {dishHasModifierOptions(dish) && (
                              <button
                                onClick={() => handleOpenOptionStopModal(dish)}
                                className="flex h-11 w-11 items-center justify-center rounded-xl text-info-600 transition-colors hover:bg-info-50"
                                title="Стоп по опциям"
                                aria-label={`Стоп-лист опций блюда «${dish.name}»`}
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
                              className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${getDishStoppedStateForScope(dish) || (isLocalStopScope() && dish.stoppedAtMenuSource)
                                ? 'text-error-600 hover:bg-error-50'
                                : 'text-success-600 hover:bg-success-50'}`}
                              title={getDishStopButtonTitle(dish)}
                              aria-label={`${getDishStopButtonTitle(dish)}: ${dish.name}`}
                            >
                              {(getDishStoppedStateForScope(dish) || (isLocalStopScope() && dish.stoppedAtMenuSource)) ? (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" /></svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                              )}
                            </button>
                            <button
                              onClick={() => handleEditDish(dish)}
                              disabled={isSharedMenuConsumer || isManagerForSelectedRestaurant}
                              className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-primary-50 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                              title="Редактировать"
                              aria-label={`Редактировать блюдо «${dish.name}»`}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                            </button>
                            <button
                              onClick={() => handleDeleteDish(dish.id)}
                              disabled={isSharedMenuConsumer || isManagerForSelectedRestaurant}
                              className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-error-50 hover:text-error-600 disabled:cursor-not-allowed disabled:opacity-50"
                              title="Удалить"
                              aria-label={`Удалить блюдо «${dish.name}»`}
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

      {/* Dish Stop Matrix Modal */}
      {showDishStopMatrixModal && selectedDishForStops && (
        <DishStopMatrixModal
          dish={selectedDishForStops}
          matrix={dishStopMatrix}
          loading={loadingDishStopMatrix}
          saving={savingDishStopMatrix}
          onSave={handleSaveDishStopMatrix}
          onClose={handleCloseDishStopMatrixModal}
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
          categories={categories}
          currency={currency}
          restaurantId={selectedRestaurantId}
          onClose={() => setShowDishModal(false)}
          onSave={(savedCategoryId) => {
            setShowDishModal(false); // Закрываем модалку
            // Автоматически раскрываем категорию после добавления/редактирования блюда
            const categoryToExpand = savedCategoryId || selectedCategoryId;
            if (categoryToExpand) {
              setSelectedCategoryId(categoryToExpand);
              setExpandedCategories(prev => new Set([...prev, categoryToExpand]));
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

const DishStopMatrixModal = ({ dish, matrix, loading, saving, onSave, onClose }) => {
  const [globalStopped, setGlobalStopped] = useState(false);
  const [pointStops, setPointStops] = useState({});

  useEffect(() => {
    if (!matrix) return;

    setGlobalStopped(Boolean(matrix.globalStopped));
    setPointStops(
      Object.fromEntries(
        (matrix.points || [])
          .filter((point) => !point.isSource)
          .map((point) => [point.id, Boolean(point.localStopped)])
      )
    );
  }, [matrix]);

  const points = matrix?.points || [];
  const sourcePoint = points.find((point) => point.isSource);
  const outletPoints = points.filter((point) => !point.isSource);
  const stoppedOutletCount = outletPoints.filter((point) => pointStops[point.id]).length;
  const effectiveStoppedCount = points.filter((point) => globalStopped || pointStops[point.id] || point.isSource && globalStopped).length;

  const setAllOutletStops = (isStopped) => {
    setPointStops(
      Object.fromEntries(outletPoints.map((point) => [point.id, isStopped]))
    );
  };

  const handleSave = () => {
    onSave({
      globalStopped,
      globalReason: null,
      pointStops: outletPoints.map((point) => ({
        restaurantId: point.id,
        isStopped: Boolean(pointStops[point.id]),
        reason: null
      }))
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900">Стоп-лист блюда</h2>
            <p className="text-sm text-gray-500 truncate">{dish?.name || matrix?.dish?.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 disabled:opacity-50"
            aria-label="Закрыть"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {loading || !matrix ? (
            <div className="py-10 text-center text-sm text-gray-500">Загрузка...</div>
          ) : (
            <>
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900">Глобальный стоп</div>
                    <div className="text-xs text-gray-500">Источник меню: {sourcePoint?.name || 'главная точка'}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGlobalStopped((value) => !value)}
                    disabled={saving}
                    className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${globalStopped ? 'bg-red-500' : 'bg-gray-300'}`}
                    aria-pressed={globalStopped}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${globalStopped ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setGlobalStopped(true)}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Стоп везде
                  </button>
                  <button
                    type="button"
                    onClick={() => setGlobalStopped(false)}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Снять глобальный
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGlobalStopped(false);
                      setAllOutletStops(false);
                    }}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs rounded-lg border border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-50"
                  >
                    Снять везде
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Точки</h3>
                    <p className="text-xs text-gray-500">
                      Скрыто: {globalStopped ? points.length : effectiveStoppedCount} из {points.length}
                    </p>
                  </div>
                  {outletPoints.length > 0 && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAllOutletStops(true)}
                        disabled={saving}
                        className="px-2.5 py-1.5 text-xs rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Все точки на стоп
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllOutletStops(false)}
                        disabled={saving}
                        className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Снять с точек
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {sourcePoint && (
                    <div className="border rounded-lg px-3 py-3 bg-gray-50 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{sourcePoint.name}</div>
                        <div className="text-xs text-gray-500">Главная точка, управляется глобальным стопом</div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${globalStopped ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {globalStopped ? 'СТОП' : 'В меню'}
                      </span>
                    </div>
                  )}

                  {outletPoints.map((point) => {
                    const localStopped = Boolean(pointStops[point.id]);
                    const effectiveStopped = globalStopped || localStopped;

                    return (
                      <div key={point.id} className="border rounded-lg px-3 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{point.name}</div>
                          <div className="text-xs text-gray-500 truncate">{point.subdomain ? `${point.subdomain}.oimoqr.com` : 'Точка сети'}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`hidden sm:inline px-2 py-1 rounded text-xs font-semibold ${effectiveStopped ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {effectiveStopped ? (globalStopped ? 'Глобальный стоп' : 'СТОП') : 'В меню'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setPointStops((prev) => ({ ...prev, [point.id]: !localStopped }))}
                            disabled={saving}
                            className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${localStopped ? 'bg-red-500' : 'bg-gray-300'}`}
                            aria-pressed={localStopped}
                          >
                            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${localStopped ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {outletPoints.length === 0 && (
                    <div className="border rounded-lg p-4 text-sm text-gray-500">
                      Для этого меню нет отдельных точек.
                    </div>
                  )}
                </div>
              </div>

              {stoppedOutletCount > 0 && !globalStopped && (
                <div className="text-xs text-gray-500">
                  Отдельный стоп включён в {stoppedOutletCount} точк{stoppedOutletCount === 1 ? 'е' : 'ах'}.
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="btn-secondary flex-1"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || !matrix}
            className="btn-primary flex-1"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
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

const parseAllergenValue = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// Dish Modal Component
const DishModal = ({ dish, categoryId, categories = [], currency = '₽', onClose, onSave, restaurantId }) => {
  const [name, setName] = useState(dish?.name || '');
  const [description, setDescription] = useState(dish?.description || '');
  const [price, setPrice] = useState(dish?.price || '');
  const [deliveryPrice, setDeliveryPrice] = useState(dish?.deliveryPrice || '');
  const [dishCategoryId, setDishCategoryId] = useState(dish?.categoryId || categoryId || '');
  const [imageFile, setImageFile] = useState(null);
  const [currentImageUrl, setCurrentImageUrl] = useState(dish?.imageUrl || null);
  const [modifiers, setModifiers] = useState(dish?.modifiers || []);
  const [allergens, setAllergens] = useState(() => parseAllergenValue(dish?.allergens));
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
  const [autoRecommendationsEnabled, setAutoRecommendationsEnabled] = useState(Boolean(dish?.autoRecommendationsEnabled));
  const [allDishes, setAllDishes] = useState([]);
  const [loadingDishes, setLoadingDishes] = useState(false);

  // Обновляем фото при изменении dish (когда переоткрываем модалку)
  useEffect(() => {
    if (dish?.imageUrl) {
      setCurrentImageUrl(dish.imageUrl);
    } else {
      setCurrentImageUrl(null);
    }
  }, [dish?.imageUrl]);

  // Обновляем recommendationIds при изменении dish
  useEffect(() => {
    setRecommendationIds(dish?.recommendationIds || []);
    setAutoRecommendationsEnabled(Boolean(dish?.autoRecommendationsEnabled));
    setOptionEditorByModifier({});
  }, [dish?.id]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !saving && !uploadingImage) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, saving, uploadingImage]);

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
    { id: 'gluten', name: 'Глютен' },
    { id: 'dairy', name: 'Молоко' },
    { id: 'nuts', name: 'Орехи' },
    { id: 'eggs', name: 'Яйца' },
    { id: 'fish', name: 'Рыба' },
    { id: 'shellfish', name: 'Морепродукты' },
    { id: 'soy', name: 'Соя' },
    { id: 'sesame', name: 'Кунжут' }
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
        console.log('[Upload API] Calling uploadModifierOptionImage...');
      const result = await menuService.uploadModifierOptionImage(option.id, file, (progress) => {
        console.log(`[Upload Progress] ${progress}%`);
      }, restaurantId);

      console.log('✅ [Upload Success] Result:', result);
      console.log('✅ [Upload Success] Image URL:', result.imageUrl);

      // Upload returns a new asset URL, so cache busting is unnecessary here.
      const newImageUrl = result.imageUrl;
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
        categoryId: dishCategoryId,
        allergens: allergens.length > 0 ? JSON.stringify(allergens) : null,
        discount: parsedDiscount,
        badge: badge || null,
        recommendationIds,
        autoRecommendationsEnabled,
      };

      let savedDish;
      if (dish) {
        savedDish = await menuService.updateDish(dish.id, data);
      } else {
        savedDish = await menuService.createDish(data);
      }

      // Upload image if selected
      if (imageFile) {
        let imageUploadFailed = false;
        console.log('🖼️ [Dish Image] Starting upload...');
        console.log('🖼️ [Dish Image] File:', imageFile.name, 'Size:', imageFile.size, 'Type:', imageFile.type);
        console.log('🖼️ [Dish Image] Dish ID:', savedDish.id);

        setUploadingImage(true);
        setUploadProgress(0);
        try {
          console.log('[Dish Image] Calling uploadDishImage...');
          const result = await menuService.uploadDishImage(savedDish.id, imageFile, (progress) => {
            console.log(`[Dish Image] Progress: ${progress}%`);
            setUploadProgress(progress);
          });

          console.log('✅ [Dish Image] Upload successful:', result);
          console.log('✅ [Dish Image] Image URL:', result?.imageUrl);

          // Upload returns a new asset URL, so cache busting is unnecessary here.
          if (result?.imageUrl) {
            const newUrl = result.imageUrl;
            console.log('🔄 [Dish Image] Setting image URL:', newUrl);
            setCurrentImageUrl(newUrl);
          }
        } catch (err) {
          imageUploadFailed = true;
          console.error('❌ [Dish Image] Upload failed:', err);
          console.error('❌ [Dish Image] Error message:', err.message);
          console.error('❌ [Dish Image] Error response:', err.response?.data);
          toast.error(`Основные данные сохранены, но фото не загрузилось: ${err.response?.data?.error || err.message}`);
        } finally {
          setUploadingImage(false);
          setUploadProgress(0);
          if (!imageUploadFailed) setImageFile(null);
        }

        if (imageUploadFailed) return;
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

      onSave(dishCategoryId);
    } catch (err) {
      toast.error('Ошибка при сохранении блюда');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-[#F6F7F9] shadow-floating sm:max-w-3xl sm:rounded-3xl lg:max-w-4xl" role="dialog" aria-modal="true" aria-labelledby="dish-editor-title">
        <div className="flex items-start justify-between border-b border-gray-200 bg-white px-5 py-4 sm:px-6 sm:py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-600">Меню</p>
            <h3 id="dish-editor-title" className="mt-1 text-xl font-bold tracking-tight text-gray-950 sm:text-2xl">
              {dish ? 'Редактировать блюдо' : 'Новое блюдо'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">Заполните основную информацию, цены и параметры показа.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800"
            aria-label="Закрыть"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
          {dish && (
            <div className="rounded-2xl border border-warning-100 bg-warning-50 px-4 py-3 text-sm leading-6 text-warning-700">
              Основные поля сохранятся по кнопке «Сохранить». Удаление фото и изменения уже созданных модификаторов применяются сразу.
            </div>
          )}
          <section className="surface-section space-y-4">
            <div>
              <h4 className="text-base font-semibold text-gray-950">Основное</h4>
              <p className="mt-1 text-xs text-gray-500">Название, описание и цены, которые увидит гость.</p>
            </div>
          <div>
            <label className="form-label">Категория</label>
            <select
              value={dishCategoryId}
              onChange={(event) => setDishCategoryId(event.target.value)}
              className="select-field"
              required
            >
              <option value="" disabled>Выберите категорию</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Название</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full"
              required
            />
          </div>

          <div>
            <label className="form-label">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="textarea-field"
              rows="3"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label">Цена в зале ({currency})</label>
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
              <label className="form-label">Цена доставки ({currency})</label>
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
          <p className="form-hint -mt-2">Если цена доставки не указана, используется цена в зале.</p>
          </section>

          <section className="surface-section grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <h4 className="text-base font-semibold text-gray-950">Продажи и маркировка</h4>
              <p className="mt-1 text-xs text-gray-500">Скидка, отметка на карточке и сведения об аллергенах.</p>
            </div>
          <div>
            <label className="form-label">Скидка (%)</label>
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

          <div className="sm:row-span-2">
            <label className="form-label">Аллергены</label>
            <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
              {availableAllergens.map((allergen) => (
                <label
                  key={allergen.id}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${allergens.includes(allergen.id)
                    ? 'border-accent-500 bg-accent-50 text-accent-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={allergens.includes(allergen.id)}
                    onChange={() => toggleAllergen(allergen.id)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">
                    {allergen.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="form-label">Отметка на фото</label>
            <select
              value={badge}
              onChange={(e) => setBadge(e.target.value)}
              className="select-field"
            >
              <option value="">Без бэджа</option>
              <option value="NEW">🆕 NEW</option>
              <option value="HIT">HIT</option>
            </select>
            <p className="form-hint">Отметка показывается в верхнем углу карточки блюда.</p>
          </div>
          </section>

          <section className="surface-section">
            <div className="mb-4">
              <h4 className="text-base font-semibold text-gray-950">Фото блюда</h4>
              <p className="mt-1 text-xs text-gray-500">Рекомендуем горизонтальное изображение без текста и рамок.</p>
            </div>
            {currentImageUrl && !imageFile && (
              <div className="relative mb-2">
                <ImageWithLoader
                  src={cacheBustImage(currentImageUrl, { width: 800, quality: 'auto:good' })}
                  alt={dish?.name || 'Блюдо'}
                  className="h-56 w-full rounded-2xl object-cover"
                  loading="lazy"
                />
                {dish && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteImage();
                    }}
                    className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-xl bg-error-600 text-white shadow-lg transition-colors hover:bg-error-700"
                    title="Удалить изображение"
                    aria-label="Удалить изображение"
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
                  className="h-56 w-full rounded-2xl object-cover"
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
                Выбран файл: {imageFile.name}
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
          </section>

          {/* Модификаторы */}
          <section className="surface-section">
            <div className="mb-4">
              <h4 className="text-base font-semibold text-gray-950">Модификаторы и опции</h4>
              <p className="mt-1 text-xs text-gray-500">Размеры, добавки, вкусы и другие варианты выбора.</p>
            </div>

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
                                src={cacheBustImage(option.image, { width: 96, height: 96, quality: 'auto:good' })}
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
                               ×
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
                    ×
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
          </section>

          {/* Рекомендации */}
          <section className="surface-section">
            <div className="mb-4">
              <h4 className="text-base font-semibold text-gray-950">Рекомендации</h4>
              <p className="mt-1 text-xs text-gray-500">Выберите блюда, которые можно предложить вместе с этой позицией.</p>
            </div>

            <label className="mb-3 flex min-h-11 items-start gap-2 rounded-xl border border-info-100 bg-info-50 px-3 py-3 text-xs text-info-700">
              <input
                type="checkbox"
                checked={autoRecommendationsEnabled}
                onChange={(e) => setAutoRecommendationsEnabled(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-shrink-0 accent-primary-600"
              />
              <span>
                Включить автоподбор рекомендаций. Если выключено и вручную ничего не выбрано — рекомендации клиенту не показываются.
              </span>
            </label>

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
                              src={cacheBustImage(availableDish.image, { width: 80, height: 80, quality: 'auto:good' })}
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
                Выбрано блюд: {recommendationIds.length}
              </div>
            )}
          </section>

          <div className="sticky -bottom-5 z-20 -mx-4 mt-6 flex gap-3 border-t border-gray-200 bg-white/95 px-4 py-4 shadow-[0_-10px_30px_rgba(24,35,51,0.08)] backdrop-blur sm:-mx-6 sm:px-6">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1 sm:flex-none"
              disabled={saving || uploadingImage}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn-primary flex-1 sm:ml-auto sm:flex-none sm:min-w-40"
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
