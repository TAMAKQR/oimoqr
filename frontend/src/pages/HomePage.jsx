import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';

const HomePage = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary-600">{t('common.oimoqr')}</h1>
          <div className="flex items-center gap-6">
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
        </div>
      </nav>

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