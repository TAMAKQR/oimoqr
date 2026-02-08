import { useState, useRef } from 'react';
import { compressImage, formatFileSize, validateImage, shouldCompress } from '../utils/imageCompression';
import toast from 'react-hot-toast';

/**
 * Компонент для загрузки изображений с drag & drop и автоматическим сжатием
 */
const ImageUploader = ({
    onFileSelect,
    accept = 'image/*',
    maxSizeMB = 10,
    compressOptions = {},
    className = '',
    label = 'Загрузить изображение',
    showPreview = true,
    currentImage = null,
    disabled = false
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [originalFile, setOriginalFile] = useState(null);
    const [isCompressing, setIsCompressing] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileSelect = async (file) => {
        if (!file || disabled) return;

        // Валидация
        const validation = validateImage(file, { maxSizeMB });
        if (!validation.valid) {
            toast.error(validation.error);
            return;
        }

        setOriginalFile(file);

        // Проверяем, нужно ли сжимать
        if (shouldCompress(file, compressOptions.maxSizeMB || 1)) {
            setIsCompressing(true);
            try {
                const compressed = await compressImage(file, compressOptions);
                const originalSize = formatFileSize(file.size);
                const compressedSize = formatFileSize(compressed.size);
                const savedPercent = Math.round((1 - compressed.size / file.size) * 100);

                toast.success(
                    `Изображение сжато: ${originalSize} → ${compressedSize} (−${savedPercent}%)`,
                    { duration: 4000 }
                );

                setSelectedFile(compressed);
                onFileSelect(compressed);
            } catch (err) {
                console.error('Compression error:', err);
                toast.error('Ошибка сжатия. Используется оригинал.');
                setSelectedFile(file);
                onFileSelect(file);
            } finally {
                setIsCompressing(false);
            }
        } else {
            setSelectedFile(file);
            onFileSelect(file);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        if (!disabled) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);

        if (disabled) return;

        const file = e.dataTransfer.files[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    const handleInputChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    const handleClick = () => {
        if (!disabled) {
            fileInputRef.current?.click();
        }
    };

    const previewUrl = selectedFile
        ? URL.createObjectURL(selectedFile)
        : currentImage;

    return (
        <div className={className}>
            {/* Drag & Drop зона */}
            <div
                onClick={handleClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-all duration-200
          ${isDragging
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
                    }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={accept}
                    onChange={handleInputChange}
                    className="hidden"
                    disabled={disabled}
                />

                {isCompressing ? (
                    <div className="py-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-3"></div>
                        <p className="text-sm text-gray-600">Сжатие изображения...</p>
                    </div>
                ) : (
                    <>
                        <svg
                            className="mx-auto h-12 w-12 text-gray-400 mb-3"
                            stroke="currentColor"
                            fill="none"
                            viewBox="0 0 48 48"
                        >
                            <path
                                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                        <p className="text-sm text-gray-600 mb-1">
                            {label}
                        </p>
                        <p className="text-xs text-gray-500">
                            Перетащите файл сюда или нажмите для выбора
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                            Максимум: {maxSizeMB} МБ {compressOptions.maxSizeMB && `• Авто-сжатие до ${compressOptions.maxSizeMB} МБ`}
                        </p>
                    </>
                )}
            </div>

            {/* Превью и информация о файле */}
            {showPreview && (selectedFile || currentImage) && !isCompressing && (
                <div className="mt-4">
                    {previewUrl && (
                        <img
                            src={previewUrl}
                            alt="Предпросмотр"
                            className="w-full max-w-xs mx-auto rounded-lg border-2 border-gray-200 mb-3"
                        />
                    )}

                    {selectedFile && (
                        <div className="bg-gray-50 rounded-lg p-3 text-sm">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-gray-600">Файл:</span>
                                <span className="font-medium text-gray-900">{selectedFile.name}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-600">Размер:</span>
                                <div className="flex items-center gap-2">
                                    {originalFile && originalFile.size !== selectedFile.size && (
                                        <>
                                            <span className="text-gray-400 line-through">
                                                {formatFileSize(originalFile.size)}
                                            </span>
                                            <span className="text-green-600">→</span>
                                        </>
                                    )}
                                    <span className="font-medium text-green-600">
                                        {formatFileSize(selectedFile.size)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ImageUploader;
