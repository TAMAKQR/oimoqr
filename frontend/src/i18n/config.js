import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ruTranslation from '../locales/ru/translation.json';
import enTranslation from '../locales/en/translation.json';
import kgTranslation from '../locales/kg/translation.json';
import trTranslation from '../locales/tr/translation.json';

const resources = {
  ru: { translation: ruTranslation },
  en: { translation: enTranslation },
  kg: { translation: kgTranslation },
  tr: { translation: trTranslation }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    }
  });

export default i18n;
