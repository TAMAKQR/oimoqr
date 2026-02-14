import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';

/* ───────── Animated counter ───────── */
const Counter = ({ end, suffix = '' }) => {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        let start = 0;
        const step = Math.max(1, Math.floor(end / 40));
        const id = setInterval(() => {
          start += step;
          if (start >= end) { setVal(end); clearInterval(id); }
          else setVal(start);
        }, 30);
        observer.disconnect();
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end]);
  return <span ref={ref}>{val}{suffix}</span>;
};

/* ───────── FAQ accordion ───────── */
const FaqItem = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-200">
      <button onClick={() => setOpen(!open)} className="w-full flex justify-between items-center py-5 text-left group">
        <span className="text-lg font-medium text-gray-800 group-hover:text-primary-600 transition-colors">{q}</span>
        <svg className={`w-5 h-5 text-primary-500 shrink-0 ml-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-40 pb-5' : 'max-h-0'}`}>
        <p className="text-gray-600 leading-relaxed">{a}</p>
      </div>
    </div>
  );
};

const HomePage = () => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const businessTypes = [
    { icon: '🍽️', key: 'restaurant', color: 'from-primary-500 to-primary-700' },
    { icon: '🛒', key: 'store', color: 'from-amber-500 to-amber-700' },
    { icon: '🏨', key: 'hotel', color: 'from-emerald-500 to-emerald-700' },
  ];

  const features = [
    { icon: '📱', key: 'qrmenu' },
    { icon: '💬', key: 'whatsapp' },
    { icon: '⚡', key: 'realtime' },
    { icon: '🎨', key: 'customization' },
    { icon: '📊', key: 'analytics' },
    { icon: '🌐', key: 'multilang' },
  ];

  const steps = [
    { num: '01', key: 'step1' },
    { num: '02', key: 'step2' },
    { num: '03', key: 'step3' },
  ];

  const faqKeys = ['faq1', 'faq2', 'faq3', 'faq4', 'faq5'];

  return (
    <div className="min-h-screen bg-white">
      {/* ═══════ HEADER ═══════ */}
      <header className="bg-white/90 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold text-primary-600 tracking-tight">OimoQR</Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-gray-600 hover:text-primary-600 transition-colors text-sm font-medium">
              {t('home.nav.features')}
            </a>
            <a href="#business" className="text-gray-600 hover:text-primary-600 transition-colors text-sm font-medium">
              {t('home.nav.solutions')}
            </a>
            <a href="#how" className="text-gray-600 hover:text-primary-600 transition-colors text-sm font-medium">
              {t('home.nav.howItWorks')}
            </a>
            <Link to="/pricing" className="text-gray-600 hover:text-primary-600 transition-colors text-sm font-medium">
              {t('home.nav.pricing')}
            </Link>
            <a href="#faq" className="text-gray-600 hover:text-primary-600 transition-colors text-sm font-medium">
              FAQ
            </a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher />
            <Link to="/login" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary-600 transition-colors">
              {t('common.login')}
            </Link>
            <Link to="/register" className="btn-primary text-sm">
              {t('home.cta')}
            </Link>
          </div>

          {/* Mobile burger */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-md text-gray-500 hover:text-primary-600"
            aria-label="Menu"
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

        {/* Mobile overlay + panel */}
        {isMenuOpen && <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setIsMenuOpen(false)} />}
        <div className={`fixed top-0 right-0 h-full w-72 bg-white shadow-2xl z-50 transform transition-transform duration-300 md:hidden ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex justify-between items-center p-5 border-b">
            <span className="text-xl font-bold text-primary-600">OimoQR</span>
            <button onClick={() => setIsMenuOpen(false)} className="p-2 text-gray-400 hover:text-primary-600">
              <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-6 space-y-3">
            <a href="#features" onClick={() => setIsMenuOpen(false)} className="block py-2 text-gray-700 hover:text-primary-600">{t('home.nav.features')}</a>
            <a href="#business" onClick={() => setIsMenuOpen(false)} className="block py-2 text-gray-700 hover:text-primary-600">{t('home.nav.solutions')}</a>
            <a href="#how" onClick={() => setIsMenuOpen(false)} className="block py-2 text-gray-700 hover:text-primary-600">{t('home.nav.howItWorks')}</a>
            <Link to="/pricing" onClick={() => setIsMenuOpen(false)} className="block py-2 text-gray-700 hover:text-primary-600">{t('home.nav.pricing')}</Link>
            <a href="#faq" onClick={() => setIsMenuOpen(false)} className="block py-2 text-gray-700 hover:text-primary-600">FAQ</a>
            <div className="border-t pt-4 space-y-3">
              <Link to="/login" onClick={() => setIsMenuOpen(false)} className="block w-full text-center btn-secondary">{t('common.login')}</Link>
              <Link to="/register" onClick={() => setIsMenuOpen(false)} className="block w-full text-center btn-primary">{t('home.cta')}</Link>
            </div>
            <div className="border-t pt-4"><LanguageSwitcher /></div>
          </div>
        </div>
      </header>

      {/* ═══════ HERO ═══════ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-white to-primary-100">
        {/* Decorative pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23374B6A\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />

        <div className="container mx-auto px-4 py-20 md:py-32 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
              <span className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
              {t('home.hero.badge')}
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              {t('home.hero.title')}
            </h1>
            <p className="text-lg md:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
              {t('home.hero.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register" className="btn-primary text-lg px-8 py-3.5 shadow-lg shadow-primary-500/20 hover:shadow-xl hover:shadow-primary-500/30 transition-all">
                {t('home.cta')}
              </Link>
              <a href="#how" className="inline-flex items-center justify-center gap-2 px-8 py-3.5 text-lg font-medium text-primary-600 bg-white border-2 border-primary-200 rounded-lg hover:border-primary-400 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('home.hero.demo')}
              </a>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-20 grid grid-cols-3 max-w-lg mx-auto gap-6">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary-600"><Counter end={500} suffix="+" /></div>
              <div className="text-sm text-gray-500 mt-1">{t('home.stats.businesses')}</div>
            </div>
            <div className="text-center border-x border-gray-200">
              <div className="text-3xl md:text-4xl font-bold text-primary-600"><Counter end={50000} suffix="+" /></div>
              <div className="text-sm text-gray-500 mt-1">{t('home.stats.scans')}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary-600"><Counter end={5} /></div>
              <div className="text-sm text-gray-500 mt-1">{t('home.stats.minutes')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ BUSINESS TYPES ═══════ */}
      <section id="business" className="py-20 md:py-28 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t('home.business.title')}</h2>
            <p className="text-gray-600 max-w-xl mx-auto">{t('home.business.subtitle')}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {businessTypes.map((bt) => (
              <div key={bt.key} className="group relative bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100">
                <div className={`h-2 bg-gradient-to-r ${bt.color}`} />
                <div className="p-8">
                  <div className="text-5xl mb-5">{bt.icon}</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{t(`home.business.${bt.key}.title`)}</h3>
                  <p className="text-gray-600 leading-relaxed mb-5">{t(`home.business.${bt.key}.desc`)}</p>
                  <ul className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <svg className="w-4 h-4 text-primary-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {t(`home.business.${bt.key}.point${i}`)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ FEATURES ═══════ */}
      <section id="features" className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t('home.features.title')}</h2>
            <p className="text-gray-600 max-w-xl mx-auto">{t('home.features.subtitle')}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {features.map((f) => (
              <div key={f.key} className="group p-6 rounded-2xl bg-white border border-gray-100 hover:border-primary-200 hover:shadow-lg transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t(`home.features.${f.key}`)}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{t(`home.features.${f.key}Desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ HOW IT WORKS ═══════ */}
      <section id="how" className="py-20 md:py-28 bg-gradient-to-br from-primary-600 to-primary-800 text-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('home.how.title')}</h2>
            <p className="text-primary-200 max-w-xl mx-auto">{t('home.how.subtitle')}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {steps.map((s, i) => (
              <div key={s.key} className="relative text-center">
                {i < 2 && (
                  <div className="hidden md:block absolute top-10 right-0 w-full h-0.5 bg-primary-400/30 translate-x-1/2" />
                )}
                <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-5 border border-white/20">
                  <span className="text-2xl font-bold text-white/90">{s.num}</span>
                </div>
                <h3 className="text-xl font-semibold mb-2">{t(`home.how.${s.key}.title`)}</h3>
                <p className="text-primary-200 text-sm leading-relaxed">{t(`home.how.${s.key}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ CAPABILITIES ═══════ */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-12 items-center">
            <div className="flex-1">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">{t('home.capabilities.title')}</h2>
              <ul className="space-y-4">
                {['banner', 'categories', 'modifiers', 'social', 'subdomain', 'trial'].map((cap) => (
                  <li key={cap} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center mt-0.5 shrink-0">
                      <svg className="w-3.5 h-3.5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-gray-700">{t(`home.capabilities.${cap}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex-1 w-full">
              <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-2xl p-8 border border-primary-100">
                <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
                  {/* Mock menu preview */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold text-sm">QR</div>
                    <div>
                      <div className="h-3 bg-gray-200 rounded w-32" />
                      <div className="h-2 bg-gray-100 rounded w-20 mt-2" />
                    </div>
                  </div>
                  <div className="h-28 bg-gradient-to-r from-primary-100 to-primary-200 rounded-lg flex items-center justify-center text-primary-400 text-3xl">
                    🖼️
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="text-center">
                        <div className="h-16 bg-gray-100 rounded-lg mb-1" />
                        <div className="h-2 bg-gray-200 rounded w-3/4 mx-auto" />
                        <div className="h-2 bg-primary-200 rounded w-1/2 mx-auto mt-1" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ FAQ ═══════ */}
      <section id="faq" className="py-20 md:py-28 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t('home.faq.title')}</h2>
          </div>
          <div className="max-w-2xl mx-auto">
            {faqKeys.map((key) => (
              <FaqItem key={key} q={t(`home.faq.${key}.q`)} a={t(`home.faq.${key}.a`)} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ FINAL CTA ═══════ */}
      <section className="py-20 md:py-28 bg-gradient-to-br from-primary-600 to-primary-800 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('home.finalCta.title')}</h2>
          <p className="text-primary-200 mb-8 max-w-xl mx-auto">{t('home.finalCta.subtitle')}</p>
          <Link to="/register" className="inline-block bg-white text-primary-700 font-semibold text-lg px-10 py-4 rounded-xl hover:bg-primary-50 transition-colors shadow-lg">
            {t('home.cta')}
          </Link>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <span className="text-xl font-bold text-white">OimoQR</span>
              <p className="text-sm mt-1">{t('home.footer.tagline')}</p>
            </div>
            <div className="flex gap-6 text-sm">
              <a href="#features" className="hover:text-white transition-colors">{t('home.nav.features')}</a>
              <Link to="/pricing" className="hover:text-white transition-colors">{t('home.nav.pricing')}</Link>
              <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            </div>
            <p className="text-sm">{t('home.footer.copy')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;