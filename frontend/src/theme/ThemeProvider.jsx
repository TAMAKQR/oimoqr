import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { themes } from './themes';

const ThemeContext = createContext({
    theme: 'default',
    setTheme: () => { },
    themes,
    customColors: themes.custom.colors,
    setCustomColors: () => { },
});

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => localStorage.getItem('app-theme') || 'default');
    const [customColors, setCustomColors] = useState(() => {
        try {
            const stored = localStorage.getItem('custom-theme-colors');
            return stored ? JSON.parse(stored) : themes.custom.colors;
        } catch (e) {
            console.warn('Failed to parse custom theme from storage', e);
            return themes.custom.colors;
        }
    });

    useEffect(() => {
        localStorage.setItem('app-theme', theme);
        const root = document.documentElement;
        root.classList.forEach((cls) => {
            if (cls.startsWith('theme-')) {
                root.classList.remove(cls);
            }
        });
        root.classList.add(`theme-${theme}`);
    }, [theme]);

    // Apply palette to CSS variables so Tailwind utility aliases use current palette
    useEffect(() => {
        const palette = theme === 'custom'
            ? customColors
            : themes[theme]?.colors || themes.default.colors;
        const root = document.documentElement;
        Object.entries(palette).forEach(([shade, hex]) => {
            root.style.setProperty(`--primary-${shade}`, hex);
        });
        if (theme === 'custom') {
            localStorage.setItem('custom-theme-colors', JSON.stringify(customColors));
        }
    }, [theme, customColors]);

    const value = useMemo(
        () => ({ theme, setTheme, themes, customColors, setCustomColors }),
        [theme, customColors]
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
