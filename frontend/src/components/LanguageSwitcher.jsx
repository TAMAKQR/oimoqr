import { useTranslation } from 'react-i18next';

const languages = [
  { code: 'ru', name: '🇷🇺 Русский' },
  { code: 'en', name: '🇬🇧 English' },
  { code: 'kg', name: '🇰🇬 Kyrgyz' },
  { code: 'tr', name: '🇹🇷 Türkçe' }
];

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

  return (
    <select
      value={i18n.language}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      className="px-3 py-2 rounded border border-gray-300 bg-white text-gray-700 font-medium cursor-pointer hover:border-primary-600 transition"
    >
      {languages.map(lang => (
        <option key={lang.code} value={lang.code}>
          {lang.name}
        </option>
      ))}
    </select>
  );
};

export default LanguageSwitcher;
