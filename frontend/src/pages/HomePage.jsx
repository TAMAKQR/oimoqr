import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';

const HomePage = () => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
      <header className="bg-white/90 backdrop-blur-sm shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary-600">{t('common.oimoqr')}</h1>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-6">
            <LanguageSwitcher />
            <div className="space-x-4">
              <Link to="/login" className="btn-secondary">
                {t('common.login')}
              </Link>
              <Link to="/register" className="btn-primary">
                {t('common.register')}
              </Link>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-md text-gray-500 hover:text-primary-600 focus:outline-none"
              aria-label="Открыть меню"
            >
              {isMenuOpen ? (
                <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {isMenuOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setIsMenuOpen(false)}
            aria-hidden="true"
          />
        )}
      </header>

      {/* Mobile Menu Panel (Sidebar) */}
      <div
        className={`fixed top-0 right-0 h-full w-64 bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
          isMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header for mobile menu */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-primary-600">{t('common.oimoqr')}</h2>
          <button
            onClick={() => setIsMenuOpen(false)}
            className="p-2 rounded-md text-gray-500 hover:text-primary-600 focus:outline-none"
            aria-label="Закрыть меню"
          >
            <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <Link to="/login" onClick={() => setIsMenuOpen(false)} className="block w-full text-center btn-secondary">{t('common.login')}</Link>
          <Link to="/register" onClick={() => setIsMenuOpen(false)} className="block w-full text-center btn-primary">{t('common.register')}</Link>
          <div className="border-t pt-4">
            <LanguageSwitcher />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-gray-900 mb-4">
            {t('home.title')}
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            {t('home.subtitle')}
          </p>
          <Link to="/register" className="btn-primary text-lg px-8 py-3">
            {t('home.cta')}
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="card text-center">
            <div className="text-4xl mb-4">📱</div>
            <h3 className="text-xl font-semibold mb-2">{t('home.features.qrmenu')}</h3>
            <p className="text-gray-600">
              {t('home.features.qrmenuDesc')}
            </p>
          </div>

          <div className="card text-center">
            <div className="text-4xl mb-4">🛒</div>
            <h3 className="text-xl font-semibold mb-2">{t('home.features.whatsapp')}</h3>
            <p className="text-gray-600">
              {t('home.features.whatsappDesc')}
            </p>
          </div>

          <div className="card text-center">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-xl font-semibold mb-2">{t('home.features.realtime')}</h3>
            <p className="text-gray-600">
              {t('home.features.realtimeDesc')}
            </p>
          </div>
        </div>

        <div className="card max-w-2xl mx-auto">
          <h3 className="text-2xl font-bold mb-4 text-center">{t('home.capabilities.title')}</h3>
          <ul className="space-y-3">
            <li className="flex items-start">
              <span className="text-primary-600 mr-2">✓</span>
              <span>{t('home.capabilities.banner')}</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary-600 mr-2">✓</span>
              <span>{t('home.capabilities.categories')}</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary-600 mr-2">✓</span>
              <span>{t('home.capabilities.modifiers')}</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary-600 mr-2">✓</span>
              <span>{t('home.capabilities.social')}</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary-600 mr-2">✓</span>
              <span>{t('home.capabilities.subdomain')}</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary-600 mr-2">✓</span>
              <span>{t('home.capabilities.trial')}</span>
            </li>
          </ul>
        </div>
      </div>

      <footer className="bg-white mt-16 py-8">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <p>{t('home.footer')}</p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;