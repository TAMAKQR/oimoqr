import { useState, useEffect } from 'react';
import { categoryGroupService } from '../services/categoryGroupService';
import toast from 'react-hot-toast';
import { confirmDialog } from '../utils/confirmDialog';

const CategoryGroupsModal = ({ restaurantId, categories, onClose, onSave }) => {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showGroupForm, setShowGroupForm] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        order: 0
    });
    const [imageFile, setImageFile] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadGroups();
    }, [restaurantId]);

    const loadGroups = async () => {
        try {
            setLoading(true);
            const data = await categoryGroupService.getCategoryGroups(restaurantId);
            setGroups(data);
        } catch (err) {
            console.error('Error loading category groups:', err);
            toast.error('Ошибка загрузки групп категорий');
        } finally {
            setLoading(false);
        }
    };

    const handleAddGroup = () => {
        setEditingGroup(null);
        setFormData({
            name: '',
            description: '',
            order: groups.length
        });
        setImageFile(null);
        setShowGroupForm(true);
    };

    const handleEditGroup = (group) => {
        setEditingGroup(group);
        setFormData({
            name: group.name,
            description: group.description || '',
            order: group.order
        });
        setImageFile(null);
        setShowGroupForm(true);
    };

    const handleDeleteGroup = async (groupId) => {
        const confirmed = await confirmDialog('Удалить группу категорий? Категории не будут удалены, только группировка.', {
            confirmText: 'Удалить',
            cancelText: 'Отмена',
            icon: '🗑️'
        });
        if (!confirmed) return;

        try {
            await categoryGroupService.deleteCategoryGroup(groupId);
            toast.success('Группа удалена');
            loadGroups();
        } catch (err) {
            console.error('Error deleting group:', err);
            toast.error('Ошибка при удалении группы');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            toast.error('Введите название группы');
            return;
        }

        setSaving(true);

        try {
            if (editingGroup) {
                // Обновление
                await categoryGroupService.updateCategoryGroup(editingGroup.id, formData);

                // Загрузка изображения, если выбрано
                if (imageFile) {
                    await categoryGroupService.uploadGroupImage(editingGroup.id, imageFile, (progress) => {
                        console.log('Upload progress:', progress);
                    });
                }

                toast.success('Группа обновлена');
            } else {
                // Создание
                const newGroup = await categoryGroupService.createCategoryGroup(restaurantId, formData);

                // Загрузка изображения, если выбрано
                if (imageFile) {
                    await categoryGroupService.uploadGroupImage(newGroup.id, imageFile, (progress) => {
                        console.log('Upload progress:', progress);
                    });
                }

                toast.success('Группа создана');
            }

            setShowGroupForm(false);
            loadGroups();
        } catch (err) {
            console.error('Error saving group:', err);
            toast.error(err.response?.data?.message || 'Ошибка при сохранении группы');
        } finally {
            setSaving(false);
        }
    };

    const handleAssignCategory = async (groupId, categoryId) => {
        try {
            // Обновляем категорию через menuService
            // Пока используем прямой вызов API
            toast.info('Функция привязки категорий в разработке');
        } catch (err) {
            console.error('Error assigning category:', err);
            toast.error('Ошибка при привязке категории');
        }
    };

    if (showGroupForm) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    <div className="sticky top-0 bg-white border-b p-6 z-10">
                        <h2 className="text-2xl font-bold">
                            {editingGroup ? 'Редактировать группу' : 'Создать группу категорий'}
                        </h2>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Название группы *</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="input w-full"
                                placeholder="Например: Основные блюда"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Описание</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="input w-full"
                                rows="2"
                                placeholder="Краткое описание группы"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Порядок отображения</label>
                            <input
                                type="number"
                                value={formData.order}
                                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                                className="input w-full"
                                min="0"
                            />
                            <p className="text-xs text-gray-500 mt-1">Меньшее число = выше в списке</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Изображение (миниатюра)</label>
                            {editingGroup?.image && !imageFile && (
                                <div className="mb-2">
                                    <img
                                        src={editingGroup.image}
                                        alt={editingGroup.name}
                                        className="w-full h-40 object-cover rounded"
                                    />
                                </div>
                            )}
                            {imageFile && (
                                <div className="mb-2">
                                    <img
                                        src={URL.createObjectURL(imageFile)}
                                        alt="Предпросмотр"
                                        className="w-full h-40 object-cover rounded"
                                    />
                                </div>
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => setImageFile(e.target.files[0])}
                                className="input w-full"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Рекомендуется квадратное изображение для отображения в 2 ряда
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-4">Привязать категории к группе</label>
                            <p className="text-xs text-gray-500 mb-3">
                                После сохранения вы сможете привязать категории к этой группе в разделе "Меню"
                            </p>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                type="button"
                                onClick={() => setShowGroupForm(false)}
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
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b p-6 z-10">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold">Группы категорий</h2>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                        Группы категорий отображаются в меню в 2 ряда с миниатюрами перед списком категорий
                    </p>
                </div>

                <div className="p-6">
                    <div className="mb-6">
                        <button onClick={handleAddGroup} className="btn-primary">
                            + Создать группу
                        </button>
                    </div>

                    {loading ? (
                        <div className="text-center py-12">
                            <div className="text-gray-500">Загрузка...</div>
                        </div>
                    ) : groups.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-6xl mb-4">📂</div>
                            <h3 className="text-xl font-semibold mb-2">Нет групп категорий</h3>
                            <p className="text-gray-600 mb-4">Создайте первую группу для организации меню</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {groups.map((group) => (
                                <div key={group.id} className="card">
                                    <div className="flex gap-4">
                                        {group.image && (
                                            <img
                                                src={group.image}
                                                alt={group.name}
                                                className="w-24 h-24 object-cover rounded flex-shrink-0"
                                            />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-lg font-semibold">{group.name}</h3>
                                                    {group.description && (
                                                        <p className="text-sm text-gray-600 mt-1">{group.description}</p>
                                                    )}
                                                    <p className="text-xs text-gray-500 mt-2">
                                                        Порядок: {group.order} • Категорий: {group.categories?.length || 0}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2 flex-shrink-0">
                                                    <button
                                                        onClick={() => handleEditGroup(group)}
                                                        className="btn-secondary text-sm"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteGroup(group.id)}
                                                        className="btn-secondary text-sm text-red-600 hover:bg-red-50"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                            {group.categories && group.categories.length > 0 && (
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {group.categories.map((cat) => (
                                                        <span
                                                            key={cat.id}
                                                            className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded"
                                                        >
                                                            {cat.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="sticky bottom-0 bg-white border-t p-6">
                    <div className="flex gap-3">
                        <button onClick={onClose} className="btn-secondary flex-1">
                            Закрыть
                        </button>
                        <button
                            onClick={() => {
                                onSave();
                            }}
                            className="btn-primary flex-1"
                        >
                            Готово
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CategoryGroupsModal;
