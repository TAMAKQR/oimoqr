import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import DashboardLayout from '../components/DashboardLayout';
import modifierTemplateService from '../services/modifierTemplateService';
import toast from 'react-hot-toast';
import confirmDialog from '../utils/confirmDialog';

const ModifierTemplatesPage = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [syncingId, setSyncingId] = useState(null);
  
  const user = useAuthStore((state) => state.user);
  const restaurantId = user?.restaurant?.id;
  const currency = user?.restaurant?.currency || '₽';

  // Форма шаблона
  const [formData, setFormData] = useState({
    name: '',
    type: 'single',
    isRequired: false,
    options: [{ name: '', price: 0 }]
  });

  useEffect(() => {
    if (restaurantId) {
      loadTemplates();
    }
  }, [restaurantId]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await modifierTemplateService.getTemplates(restaurantId);
      setTemplates(data);
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Ошибка загрузки шаблонов');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (template = null) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        type: template.type,
        isRequired: template.isRequired,
        options: template.options.map(opt => ({
          name: opt.name,
          price: opt.price,
          image: opt.image
        }))
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        type: 'single',
        isRequired: false,
        options: [{ name: '', price: 0 }]
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTemplate(null);
  };

  const handleAddOption = () => {
    setFormData({
      ...formData,
      options: [...formData.options, { name: '', price: 0 }]
    });
  };

  const handleRemoveOption = (index) => {
    setFormData({
      ...formData,
      options: formData.options.filter((_, i) => i !== index)
    });
  };

  const handleOptionChange = (index, field, value) => {
    const newOptions = [...formData.options];
    newOptions[index][field] = field === 'price' ? parseFloat(value) || 0 : value;
    setFormData({ ...formData, options: newOptions });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Введите название шаблона');
      return;
    }

    if (formData.options.length === 0) {
      toast.error('Добавьте хотя бы одну опцию');
      return;
    }

    if (formData.options.some(opt => !opt.name.trim())) {
      toast.error('Заполните названия всех опций');
      return;
    }

    try {
      const data = {
        ...formData,
        restaurantId
      };

      if (editingTemplate) {
        await modifierTemplateService.updateTemplate(editingTemplate.id, data);
        toast.success('Шаблон обновлен! Синхронизируйте блюда для применения изменений.');
      } else {
        await modifierTemplateService.createTemplate(data);
        toast.success('Шаблон создан!');
      }

      handleCloseModal();
      loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Ошибка сохранения шаблона');
    }
  };

  const handleDelete = async (template) => {
    const confirmed = await confirmDialog(
      `Удалить шаблон "${template.name}"?`,
      {
        confirmText: 'Удалить',
        cancelText: 'Отмена',
        icon: '🗑️'
      }
    );

    if (!confirmed) return;

    try {
      await modifierTemplateService.deleteTemplate(template.id);
      toast.success('Шаблон удален');
      loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      const message = error.response?.data?.error || 'Ошибка удаления шаблона';
      toast.error(message);
    }
  };

  const handleSync = async (template) => {
    const confirmed = await confirmDialog(
      `Синхронизировать все блюда с шаблоном "${template.name}"?\n\nОбновится ${template._count?.usedInModifiers || 0} блюд`,
      {
        confirmText: 'Синхронизировать',
        cancelText: 'Отмена',
        icon: '🔄'
      }
    );

    if (!confirmed) return;

    try {
      setSyncingId(template.id);
      const result = await modifierTemplateService.syncTemplate(template.id);
      toast.success(result.message || `Обновлено ${result.count} модификаторов`);
      loadTemplates();
    } catch (error) {
      console.error('Error syncing template:', error);
      toast.error('Ошибка синхронизации');
    } finally {
      setSyncingId(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <svg className="animate-spin h-12 w-12 text-primary-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-600">Загрузка шаблонов...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">📚 Библиотека модификаторов</h1>
            <p className="text-gray-600 mt-1">Создавайте шаблоны модификаторов и применяйте их к блюдам</p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Создать шаблон
          </button>
        </div>

        {/* Templates List */}
        {templates.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Нет шаблонов</h3>
            <p className="text-gray-600 mb-4">Создайте первый шаблон модификатора</p>
            <button
              onClick={() => handleOpenModal()}
              className="btn-primary"
            >
              Создать шаблон
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {templates.map((template) => (
              <div key={template.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{template.name}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                        </svg>
                        {template.type === 'single' ? 'Одиночный выбор' : 'Множественный выбор'}
                      </span>
                      {template.isRequired && (
                        <span className="flex items-center gap-1 text-red-600 font-medium">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          Обязательный
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-blue-600 font-medium">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                          <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                        </svg>
                        {template._count?.usedInModifiers || 0} блюд
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenModal(template)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Редактировать"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(template)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Удалить"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Options */}
                <div className="mb-4 space-y-1">
                  {template.options?.map((option, index) => (
                    <div key={index} className="flex items-center justify-between py-1 text-sm">
                      <span className="text-gray-700">• {option.name}</span>
                      {option.price > 0 && (
                        <span className="text-gray-600">+{option.price} {currency}</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Sync Button */}
                {template._count?.usedInModifiers > 0 && (
                  <button
                    onClick={() => handleSync(template)}
                    disabled={syncingId === template.id}
                    className="w-full btn-secondary flex items-center justify-center gap-2"
                  >
                    {syncingId === template.id ? (
                      <>
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Синхронизация...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Синхронизировать все блюда
                      </>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit} className="p-6">
                <h2 className="text-2xl font-bold mb-4">
                  {editingTemplate ? 'Редактировать шаблон' : 'Создать шаблон'}
                </h2>

                {/* Name */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Название шаблона
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input w-full"
                    placeholder="Например: Подогрев, Объем, Острота"
                    required
                  />
                </div>

                {/* Type */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Тип выбора
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="input w-full"
                  >
                    <option value="single">Одиночный (radio)</option>
                    <option value="multi">Множественный (checkbox)</option>
                  </select>
                </div>

                {/* Is Required */}
                <div className="mb-6">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isRequired}
                      onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Обязательный модификатор (клиент должен выбрать)
                    </span>
                  </label>
                </div>

                {/* Options */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Опции
                    </label>
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Добавить опцию
                    </button>
                  </div>

                  <div className="space-y-2">
                    {formData.options.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={option.name}
                          onChange={(e) => handleOptionChange(index, 'name', e.target.value)}
                          className="input flex-1"
                          placeholder="Название опции"
                          required
                        />
                        <input
                          type="number"
                          value={option.price}
                          onChange={(e) => handleOptionChange(index, 'price', e.target.value)}
                          className="input w-32"
                          placeholder="Цена"
                          step="0.01"
                          min="0"
                        />
                        <span className="text-gray-600 min-w-8">{currency}</span>
                        {formData.options.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button type="submit" className="btn-primary flex-1">
                    {editingTemplate ? 'Сохранить' : 'Создать'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="btn-secondary flex-1"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ModifierTemplatesPage;
