import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { themes } from './themes';

const IGNORED_SCOPES = new Set([
    'login',
    'register',
    'dashboard',
    'settings',
    'menu-management',
    'languages',
    'modifier-templates',
    'staff',
    'customers',
    'pricing',
    'admin',
    'customer',
    'checkout',
]);

const safeParse = (value) => {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
};

const computeScopeKey = () => {
    const parts = window.location.pathname.split('/').filter(Boolean);

    if (parts[0] === 'menu' && parts[1]) {
        return `rest-${parts[1]}`;
    }

    if (parts[0] && !IGNORED_SCOPES.has(parts[0])) {
        return `rest-${parts[0]}`;
    }

    return 'global';
};

const ThemeContext = createContext({
    theme: 'default',
    setTheme: () => { },
    themes,
    customColors: themes.custom.colors,
    setCustomColors: () => { },
});

export const ThemeProvider = ({ children }) => {
    const [scopeKey, setScopeKey] = useState(() => computeScopeKey());
    const [theme, setTheme] = useState('default');
    const [customColors, setCustomColors] = useState(themes.custom.colors);

    // Sync scope with route changes (pushState/replaceState/popstate)
    useEffect(() => {
        const updateScope = () => setScopeKey(computeScopeKey());

        const wrapHistoryMethod = (type) => {
            const orig = history[type];
            history[type] = function (...args) {
                const result = orig.apply(this, args);
                updateScope();
                return result;
            };
            return () => {
                history[type] = orig;
            };
        };

        const restorePush = wrapHistoryMethod('pushState');
        const restoreReplace = wrapHistoryMethod('replaceState');
        window.addEventListener('popstate', updateScope);

        // Initial sync
        updateScope();

        return () => {
            restorePush();
            restoreReplace();
            window.removeEventListener('popstate', updateScope);
        };
    }, []);

    // Load scoped theme when scope changes
    useEffect(() => {
        if (scopeKey === 'global') {
            // Don't reset theme when navigating to checkout — it applies the restaurant palette itself
            const currentPath = window.location.pathname.split('/').filter(Boolean)[0];
            if (currentPath !== 'checkout') {
                setTheme('default');
                setCustomColors(themes.default.colors);
            }
            return;
        }

        const themeKey = `${scopeKey}-app-theme`;
        const colorsKey = `${scopeKey}-custom-theme-colors`;

        const storedTheme = localStorage.getItem(themeKey) || 'default';
        setTheme(storedTheme);

        const storedColors = safeParse(localStorage.getItem(colorsKey));
        setCustomColors(storedColors || themes.custom.colors);
    }, [scopeKey]);

    useEffect(() => {
        const themeKey = `${scopeKey}-app-theme`;
        localStorage.setItem(themeKey, theme);
        const root = document.documentElement;
        root.classList.forEach((cls) => {
            if (cls.startsWith('theme-')) {
                root.classList.remove(cls);
            }
        });
        root.classList.add(`theme-${theme}`);
    }, [theme, scopeKey]);

    // Apply palette to CSS variables so Tailwind utility aliases use current palette
    useEffect(() => {
        const palette = theme === 'custom'
            ? customColors
            : themes[theme]?.colors || themes.default.colors;
        const root = document.documentElement;
        Object.entries(palette).forEach(([shade, hex]) => {
            root.style.setProperty(`--primary-${shade}`, hex);
        });
        if (theme === 'custom' && scopeKey !== 'global') {
            const colorsKey = `${scopeKey}-custom-theme-colors`;
            localStorage.setItem(colorsKey, JSON.stringify(customColors));
        }
    }, [theme, customColors, scopeKey]);

    const value = useMemo(
        () => ({ theme, setTheme, themes, customColors, setCustomColors }),
        [theme, customColors]
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
