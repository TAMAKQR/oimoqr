import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../services/api';

/**
 * Компонент автодополнения адреса через Yandex Suggest API
 * @param {string} value - текущее значение
 * @param {function} onChange - колбэк при изменении текста
 * @param {function} onSelect - колбэк при выборе подсказки (title, subtitle, fullAddress)
 * @param {string} placeholder - плейсхолдер
 * @param {string} className - CSS классы
 * @param {object} restaurant - ресторан (для приоритизации по координатам)
 */
const AddressAutocomplete = ({ value, onChange, onSelect, placeholder, className, restaurant }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef(null);
    const wrapperRef = useRef(null);

    // Закрытие при клике вне компонента
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchSuggestions = useCallback(async (text) => {
        if (!text || text.length < 3) {
            setSuggestions([]);
            setShowDropdown(false);
            return;
        }

        setLoading(true);
        try {
            const params = { text };
            // Приоритизируем результаты вокруг ресторана
            if (restaurant?.longitude && restaurant?.latitude) {
                params.ll = `${restaurant.longitude},${restaurant.latitude}`;
            }
            const resp = await api.get('/geolocation/suggest', { params });
            const items = resp.data?.suggestions || [];
            setSuggestions(items);
            setShowDropdown(items.length > 0);
        } catch (err) {
            console.warn('Suggest failed:', err);
            setSuggestions([]);
        } finally {
            setLoading(false);
        }
    }, [restaurant?.longitude, restaurant?.latitude]);

    const handleChange = (e) => {
        const val = e.target.value;
        onChange(val);

        // Дебаунс 300мс
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            fetchSuggestions(val);
        }, 300);
    };

    const handleSelect = (suggestion) => {
        const address = suggestion.title + (suggestion.subtitle ? `, ${suggestion.subtitle}` : '');
        onChange(address);
        setShowDropdown(false);
        setSuggestions([]);
        if (onSelect) onSelect(suggestion);
    };

    const handleFocus = () => {
        if (suggestions.length > 0) {
            setShowDropdown(true);
        }
    };

    return (
        <div ref={wrapperRef} className="relative">
            <input
                type="text"
                value={value}
                onChange={handleChange}
                onFocus={handleFocus}
                placeholder={placeholder || 'Введите адрес'}
                className={className || 'input-field w-full text-sm'}
                autoComplete="off"
            />
            {loading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="w-4 h-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                </div>
            )}
            {showDropdown && suggestions.length > 0 && (
                <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {suggestions.map((s, i) => (
                        <li
                            key={i}
                            onClick={() => handleSelect(s)}
                            className="px-3 py-2.5 cursor-pointer hover:bg-gray-50 active:bg-gray-100 border-b border-gray-50 last:border-0"
                        >
                            <div className="text-sm font-medium text-gray-900">{s.title}</div>
                            {s.subtitle && <div className="text-xs text-gray-500 mt-0.5">{s.subtitle}</div>}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default AddressAutocomplete;
