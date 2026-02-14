import { useState, useRef } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

const ProductForm = ({ product, categories, restaurantId, onSave, onCancel }) => {
    const isEditing = !!product;
    const fileInputRef = useRef(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [formData, setFormData] = useState({
        name: product?.name || '',
        description: product?.description || '',
        sku: product?.sku || '',
        price: product?.price || '',
        compareAtPrice: product?.compareAtPrice || '',
        cost: product?.cost || '',
        categoryId: product?.categoryId || '',
        trackInventory: product?.trackInventory ?? true,
        stockQuantity: product?.stockQuantity || 0,
        weight: product?.weight || '',
        available: product?.available ?? true,
        featured: product?.featured ?? false,
        order: product?.order || 0,
    });
    const [images, setImages] = useState(product?.images || []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!isEditing) {
            // For new products, we can't upload images yet (no ID)
            // Show preview and save file for later
            const previewUrl = URL.createObjectURL(file);
            setImages(prev => [...prev, { file, preview: previewUrl }]);
            return;
        }

        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('image', file);
            const res = await api.post(`/products/${product.id}/upload-image`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setImages(res.data.images || []);
            toast.success('Изображение загружено');
        } catch (error) {
            toast.error('Ошибка загрузки изображения');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteImage = async (imageUrl, index) => {
        if (!isEditing) {
            setImages(prev => prev.filter((_, i) => i !== index));
            return;
        }

        try {
            const res = await api.delete(`/products/${product.id}/delete-image`, {
                data: { imageUrl }
            });
            setImages(res.data.images || []);
            toast.success('Изображение удалено');
        } catch (error) {
            toast.error('Ошибка удаления изображения');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            toast.error('Название товара обязательно');
            return;
        }
        if (!formData.price || parseFloat(formData.price) < 0) {
            toast.error('Укажите корректную цену');
            return;
        }
        if (!formData.categoryId) {
            toast.error('Выберите категорию');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                ...formData,
                price: parseFloat(formData.price),
                compareAtPrice: formData.compareAtPrice ? parseFloat(formData.compareAtPrice) : null,
                cost: formData.cost ? parseFloat(formData.cost) : null,
                weight: formData.weight ? parseFloat(formData.weight) : null,
                stockQuantity: parseInt(formData.stockQuantity) || 0,
                order: parseInt(formData.order) || 0,
                restaurantId,
            };

            let savedProduct;
            if (isEditing) {
                const res = await api.put(`/products/${product.id}`, payload);
                savedProduct = res.data;
                toast.success('Товар обновлён');
            } else {
                const res = await api.post('/products', payload);
                savedProduct = res.data;

                // Upload pending images for new product
                const pendingImages = images.filter(img => img.file);
                for (const img of pendingImages) {
                    const fd = new FormData();
                    fd.append('image', img.file);
                    await api.post(`/products/${savedProduct.id}/upload-image`, fd, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                }

                toast.success('Товар создан');
            }

            onSave?.(savedProduct);
        } catch (error) {
            toast.error(error.response?.data?.error || 'Ошибка сохранения');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Images */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Изображения</label>
                <div className="flex flex-wrap gap-3">
                    {images.map((img, i) => {
                        const src = typeof img === 'string' ? img : img.preview;
                        return (
                            <div key={i} className="relative group w-24 h-24">
                                <img src={src} alt="" className="w-24 h-24 rounded-lg object-cover border border-gray-200" />
                                <button
                                    type="button"
                                    onClick={() => handleDeleteImage(typeof img === 'string' ? img : null, i)}
                                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    ✕
                                </button>
                            </div>
                        );
                    })}
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-400 transition-colors"
                    >
                        {uploading ? (
                            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                <span className="text-xs mt-1">Фото</span>
                            </>
                        )}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                    />
                </div>
            </div>

            {/* Name */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
                <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Название товара"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                />
            </div>

            {/* Description */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
                <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Описание товара"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
            </div>

            {/* Category */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Категория *</label>
                <select
                    name="categoryId"
                    value={formData.categoryId}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                >
                    <option value="">Выберите категорию</option>
                    {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                </select>
            </div>

            {/* Price row */}
            <div className="grid grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Цена *</label>
                    <input
                        type="number"
                        name="price"
                        value={formData.price}
                        onChange={handleChange}
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Старая цена</label>
                    <input
                        type="number"
                        name="compareAtPrice"
                        value={formData.compareAtPrice}
                        onChange={handleChange}
                        min="0"
                        step="0.01"
                        placeholder="—"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Себестоимость</label>
                    <input
                        type="number"
                        name="cost"
                        value={formData.cost}
                        onChange={handleChange}
                        min="0"
                        step="0.01"
                        placeholder="—"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>

            {/* SKU + Weight */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Артикул (SKU)</label>
                    <input
                        type="text"
                        name="sku"
                        value={formData.sku}
                        onChange={handleChange}
                        placeholder="ART-001"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Вес (кг)</label>
                    <input
                        type="number"
                        name="weight"
                        value={formData.weight}
                        onChange={handleChange}
                        min="0"
                        step="0.01"
                        placeholder="—"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>

            {/* Inventory */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        name="trackInventory"
                        checked={formData.trackInventory}
                        onChange={handleChange}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Отслеживать остатки</span>
                </label>
                {formData.trackInventory && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Количество на складе</label>
                        <input
                            type="number"
                            name="stockQuantity"
                            value={formData.stockQuantity}
                            onChange={handleChange}
                            min="0"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                )}
            </div>

            {/* Toggles */}
            <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        name="available"
                        checked={formData.available}
                        onChange={handleChange}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Доступен для продажи</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        name="featured"
                        checked={formData.featured}
                        onChange={handleChange}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Рекомендуемый</span>
                </label>
            </div>

            {/* Order */}
            <div className="w-32">
                <label className="block text-sm font-medium text-gray-700 mb-1">Порядок</label>
                <input
                    type="number"
                    name="order"
                    value={formData.order}
                    onChange={handleChange}
                    min="0"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                    disabled={saving}
                >
                    Отмена
                </button>
                <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50"
                    disabled={saving}
                >
                    {saving ? 'Сохранение...' : isEditing ? 'Сохранить' : 'Создать товар'}
                </button>
            </div>
        </form>
    );
};

export default ProductForm;
