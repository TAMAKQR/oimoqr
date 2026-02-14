import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../theme/ThemeProvider';

// Very small utility to create a tonal palette from one base color
const hexToHsl = (hex) => {
    const normalized = hex.replace('#', '');
    const bigint = parseInt(normalized, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;
    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    const delta = max - min;

    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (delta !== 0) {
        s = delta / (1 - Math.abs(2 * l - 1));
        switch (max) {
            case rNorm:
                h = ((gNorm - bNorm) / delta) % 6;
                break;
            case gNorm:
                h = (bNorm - rNorm) / delta + 2;
                break;
            default:
                h = (rNorm - gNorm) / delta + 4;
        }
        h *= 60;
    }

    return { h: (h + 360) % 360, s: Math.min(Math.max(s, 0), 1), l: Math.min(Math.max(l, 0), 1) };
};

const hslToHex = ({ h, s, l }) => {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let r = 0;
    let g = 0;
    let b = 0;

    if (0 <= h && h < 60) {
        r = c; g = x; b = 0;
    } else if (60 <= h && h < 120) {
        r = x; g = c; b = 0;
    } else if (120 <= h && h < 180) {
        r = 0; g = c; b = x;
    } else if (180 <= h && h < 240) {
        r = 0; g = x; b = c;
    } else if (240 <= h && h < 300) {
        r = x; g = 0; b = c;
    } else {
        r = c; g = 0; b = x;
    }

    const toHex = (v) => {
        const val = Math.round((v + m) * 255);
        return val.toString(16).padStart(2, '0');
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const clamp = (value, min = 0, max = 1) => Math.min(Math.max(value, min), max);

const buildPalette = (baseHex) => {
    const hsl = hexToHsl(baseHex || '#4B6282');
    // Lightness adjustments for Tailwind-like steps
    const steps = {
        50: 0.38,
        100: 0.32,
        200: 0.26,
        300: 0.2,
        400: 0.14,
        500: 0,
        600: -0.06,
        700: -0.12,
        800: -0.18,
        900: -0.24,
    };

    const palette = {};
    Object.entries(steps).forEach(([tone, delta]) => {
        const lightness = clamp(hsl.l + delta, 0.05, 0.95);
        palette[tone] = hslToHex({ h: hsl.h, s: hsl.s, l: lightness });
    });
    return palette;
};

const ThemeSwitcher = ({ inline = false }) => {
    const { theme, setTheme, themes, customColors, setCustomColors } = useTheme();
    const [baseColor, setBaseColor] = useState(customColors?.[600] || '#374B6A');
    const [localPalette, setLocalPalette] = useState(customColors || themes.custom.colors);

    useEffect(() => {
        setLocalPalette(theme === 'custom' ? customColors : themes.custom.colors);
        if (theme === 'custom' && customColors?.[600]) {
            setBaseColor(customColors[600]);
        }
    }, [theme, customColors, themes.custom.colors]);

    const wrapperClass = inline
        ? 'static'
        : 'fixed right-3 bottom-24 sm:bottom-28 z-50';

    const handleBaseChange = (hex) => {
        setBaseColor(hex);
        const palette = buildPalette(hex);
        setLocalPalette(palette);
    };

    const applyCustomPalette = () => {
        setCustomColors(localPalette);
        setTheme('custom');
    };

    const previewGrad = useMemo(() => `linear-gradient(90deg, ${localPalette[400]}, ${localPalette[600]}, ${localPalette[800]})`, [localPalette]);

    return (
        <div className={wrapperClass}>
            <div className="bg-white/95 backdrop-blur border border-gray-200 rounded-2xl shadow-lg px-3 py-2 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Тема</span>
                    <select
                        value={theme}
                        onChange={(e) => setTheme(e.target.value)}
                        className="text-xs font-medium text-gray-800 bg-transparent focus:outline-none"
                    >
                        {Object.entries(themes).map(([key, value]) => (
                            <option key={key} value={key}>
                                {value.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="h-px bg-gray-100" />

                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-500">Своя палитра</span>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={baseColor}
                                onChange={(e) => handleBaseChange(e.target.value)}
                                className="h-8 w-10 border border-gray-200 rounded cursor-pointer bg-white"
                                aria-label="Выбрать базовый цвет"
                            />
                            <button
                                type="button"
                                onClick={applyCustomPalette}
                                className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg"
                                style={{ background: previewGrad }}
                            >
                                Применить
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                        {[50, 200, 400, 600, 800].map((tone) => (
                            <div key={tone} className="h-6 rounded border border-gray-100 text-[10px] text-center text-gray-700" style={{ background: localPalette[tone] }}>
                                {tone}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ThemeSwitcher;
