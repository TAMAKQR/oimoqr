import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';

/* ═══════ HOOKS ═══════ */
const useInView = (threshold = 0.15) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
};

/* ═══════ COMPONENTS ═══════ */
const Counter = ({ end, suffix = '' }) => {
  const [val, setVal] = useState(0);
  const [ref, visible] = useInView(0.3);
  useEffect(() => {
    if (!visible) return;
    let cur = 0;
    const step = Math.max(1, Math.floor(end / 50));
    const id = setInterval(() => { cur += step; if (cur >= end) { setVal(end); clearInterval(id); } else setVal(cur); }, 25);
    return () => clearInterval(id);
  }, [visible, end]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
};

const Reveal = ({ children, className = '', delay = 0 }) => {
  const [ref, visible] = useInView(0.1);
  return (
    <div ref={ref} className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
};

const FaqItem = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-100 rounded-2xl mb-3 overflow-hidden bg-white hover:shadow-md transition-shadow">
      <button onClick={() => setOpen(!open)} className="w-full flex justify-between items-center p-5 text-left group">
        <span className="text-base font-semibold text-gray-800 group-hover:text-primary-600 transition-colors pr-4">{q}</span>
        <div className={`w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center shrink-0 transition-all duration-300 ${open ? 'bg-primary-600 rotate-180' : ''}`}>
          <svg className={`w-4 h-4 transition-colors ${open ? 'text-white' : 'text-primary-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${open ? 'max-h-48 pb-5 px-5' : 'max-h-0'}`}>
        <p className="text-gray-500 leading-relaxed text-sm">{a}</p>
      </div>
    </div>
  );
};

/* ═══════ Phone mockup ═══════ */
const PhoneMockup = () => (
  <div className="relative w-[280px] h-[560px] lg:w-[320px] lg:h-[640px] mx-auto">
    {/* Phone frame */}
    <div className="absolute inset-0 bg-gray-900 rounded-[3rem] shadow-2xl shadow-primary-900/30 border-[6px] border-gray-800">
      {/* Notch */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-gray-900 rounded-b-2xl z-10" />
      {/* Screen */}
      <div className="absolute inset-2 top-3 bg-white rounded-[2.2rem] overflow-hidden">
        {/* Status bar */}
        <div className="h-8 bg-primary-600 flex items-center justify-between px-5">
          <span className="text-[8px] text-white/80 font-medium">9:41</span>
          <div className="flex gap-1">
            <div className="w-3 h-2 border border-white/60 rounded-sm"><div className="w-2 h-full bg-white/60 rounded-sm" /></div>
          </div>
        </div>
        {/* Header */}
        <div className="bg-primary-600 px-4 pb-3 pt-1">
          <div className="text-white text-sm font-bold">OimoQR</div>
          <div className="text-primary-200 text-[9px]">Digital Menu</div>
        </div>
        {/* Banner */}
        <div className="mx-3 mt-3 h-20 bg-gradient-to-r from-primary-400 to-primary-600 rounded-xl flex items-center justify-center">
          <span className="text-white text-xs font-semibold px-3 text-center">🔥 -20% on all dishes</span>
        </div>
        {/* Categories */}
        <div className="flex gap-2 px-3 mt-3 overflow-hidden">
          {['🍕', '🍔', '🥗', '🍰'].map((e, i) => (
            <div key={i} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${i === 0 ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {e}
            </div>
          ))}
        </div>
        {/* Dishes */}
        <div className="px-3 mt-3 space-y-2">
          {[
            { name: 'Margherita', price: '320 сом', color: 'from-orange-100 to-red-50' },
            { name: 'Caesar Salad', price: '280 сом', color: 'from-green-50 to-emerald-100' },
            { name: 'Tiramisu', price: '250 сом', color: 'from-amber-50 to-yellow-100' },
          ].map((d, i) => (
            <div key={i} className={`flex items-center gap-2 p-2 rounded-xl bg-gradient-to-r ${d.color}`}>
              <div className="w-10 h-10 bg-white/60 rounded-lg shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-semibold text-gray-800 truncate">{d.name}</div>
                <div className="text-[9px] text-primary-600 font-bold">{d.price}</div>
              </div>
              <div className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center shrink-0">
                <span className="text-white text-[10px]">+</span>
              </div>
            </div>
          ))}
        </div>
        {/* Cart button */}
        <div className="absolute bottom-6 left-5 right-5">
          <div className="bg-primary-600 text-white text-xs font-semibold py-2.5 rounded-xl text-center shadow-lg shadow-primary-600/30">
            🛒 WhatsApp · 850 сом
          </div>
        </div>
      </div>
    </div>
    {/* Glow */}
    <div className="absolute -inset-4 bg-primary-400/10 rounded-[4rem] blur-2xl -z-10" />
  </div>
);

const HomePage = () => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const businessTypes = [
    { icon: '🍽️', key: 'restaurant', gradient: 'from-primary-500 to-primary-700', bg: 'bg-primary-50', ring: 'ring-primary-200' },
    { icon: '🛒', key: 'store', gradient: 'from-amber-500 to-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-200' },
    { icon: '🏨', key: 'hotel', gradient: 'from-emerald-500 to-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-200' },
  ];

  const features = [
    { icon: '📱', key: 'qrmenu', color: 'from-blue-500 to-indigo-600' },
    { icon: '💬', key: 'whatsapp', color: 'from-green-500 to-emerald-600' },
    { icon: '⚡', key: 'realtime', color: 'from-yellow-500 to-orange-500' },
    { icon: '🎨', key: 'customization', color: 'from-purple-500 to-pink-500' },
    { icon: '📊', key: 'analytics', color: 'from-cyan-500 to-blue-500' },
    { icon: '🌐', key: 'multilang', color: 'from-rose-500 to-red-500' },
  ];

  const steps = [
    { num: '01', key: 'step1', icon: '✍️' },
    { num: '02', key: 'step2', icon: '📋' },
    { num: '03', key: 'step3', icon: '📲' },
  ];

  const valueHighlights = [
    { icon: '🎯', key: 'qrmenu' },
    { icon: '💬', key: 'whatsapp' },
    { icon: '⚡', key: 'realtime' },
    { icon: '📊', key: 'analytics' },
  ];

  const extraAdvantages = [
    { icon: '🧩', key: 'banner' },
    { icon: '🗂️', key: 'categories' },
    { icon: '🔧', key: 'modifiers' },
    { icon: '🔗', key: 'subdomain' },
    { icon: '🚀', key: 'trial' },
    { icon: '📢', key: 'social' },
  ];

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* ═══════ HEADER ═══════ */}
      <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${isMenuOpen || scrolled ? 'bg-white shadow-sm border-b border-gray-100' : 'bg-transparent'}`}>
        <div className="container mx-auto py-3 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-md shadow-primary-500/20">
              <span className="text-white font-bold text-sm">Q</span>
            </div>
            <span className={`text-xl font-bold tracking-tight transition-colors ${scrolled ? 'text-gray-900' : 'text-gray-900'}`}>OimoQR</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-8">
            {[
              { href: '#solutions', label: t('home.nav.solutions') },
              { href: '#features', label: t('home.nav.features') },
              { href: '#how', label: t('home.nav.howItWorks') },
              { to: '/pricing', label: t('home.nav.pricing') },
              { href: '#faq', label: 'FAQ' },
            ].map((item) =>
              item.to ? (
                <Link key={item.to} to={item.to} className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">{item.label}</Link>
              ) : (
                <a key={item.href} href={item.href} className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">{item.label}</a>
              )
            )}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <LanguageSwitcher />
            <Link to="/login" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">
              {t('common.login')}
            </Link>
            <Link to="/register" className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl hover:shadow-lg hover:shadow-primary-500/25 transition-all hover:-translate-y-0.5">
              {t('home.cta')}
            </Link>
          </div>

          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="lg:hidden p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors" aria-label="Menu">
            <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
              {isMenuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
              }
            </svg>
          </button>
        </div>

        {/* Mobile panel */}
        {isMenuOpen && <div className="fixed inset-0 bg-black/80 z-40 lg:hidden" onClick={() => setIsMenuOpen(false)} />}
        <div className={`fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-50 transform transition-transform duration-300 lg:hidden ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex justify-between items-center p-5 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                <span className="text-white font-bold text-xs">Q</span>
              </div>
              <span className="text-lg font-bold">OimoQR</span>
            </div>
            <button onClick={() => setIsMenuOpen(false)} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100">
              <svg className="h-5 w-5" stroke="currentColor" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="p-6 space-y-1">
            {[
              { href: '#solutions', label: t('home.nav.solutions') },
              { href: '#features', label: t('home.nav.features') },
              { href: '#how', label: t('home.nav.howItWorks') },
              { href: '#faq', label: 'FAQ' },
            ].map((item) => (
              <a key={item.href} href={item.href} onClick={() => setIsMenuOpen(false)} className="block py-3 px-4 rounded-xl text-gray-700 hover:bg-primary-50 hover:text-primary-600 font-medium transition-colors">{item.label}</a>
            ))}
            <Link to="/pricing" onClick={() => setIsMenuOpen(false)} className="block py-3 px-4 rounded-xl text-gray-700 hover:bg-primary-50 hover:text-primary-600 font-medium transition-colors">{t('home.nav.pricing')}</Link>
            <div className="border-t border-gray-100 pt-4 mt-4 space-y-3">
              <Link to="/login" onClick={() => setIsMenuOpen(false)} className="block w-full text-center py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 font-medium hover:border-primary-300 transition-colors">{t('common.login')}</Link>
              <Link to="/register" onClick={() => setIsMenuOpen(false)} className="block w-full text-center py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold shadow-lg shadow-primary-600/20">{t('home.cta')}</Link>
            </div>
            <div className="border-t border-gray-100 pt-4 mt-2"><LanguageSwitcher /></div>
          </div>
        </div>
      </header>

      {/* ═══════ HERO ═══════ */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-32 overflow-hidden">
        {/* Animated bg blobs */}
        <div className="absolute top-20 -left-32 w-96 h-96 bg-primary-200/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-10 -right-32 w-80 h-80 bg-amber-200/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-100/20 rounded-full blur-3xl" />

        <div className="container mx-auto relative">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
            {/* Left — text */}
            <div className="flex-1 text-center lg:text-left">
              <Reveal>
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-primary-50 to-primary-100 text-primary-700 px-4 py-2 rounded-full text-sm font-semibold mb-6 border border-primary-200/50">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500" />
                  </span>
                  {t('home.hero.badge')}
                </div>
              </Reveal>

              <Reveal delay={100}>
                <h1 className="text-4xl sm:text-5xl md:text-6xl xl:text-[4rem] font-extrabold text-gray-900 mb-6 leading-[1.15] tracking-tight">
                  {t('home.hero.titleStart')}<br />
                  <span className="bg-gradient-to-r from-primary-600 via-primary-500 to-amber-500 bg-clip-text text-transparent">
                    {t('home.hero.titleHighlight')}
                  </span>
                </h1>
              </Reveal>

              <Reveal delay={200}>
                <p className="text-lg md:text-xl text-gray-500 mb-8 leading-relaxed max-w-lg mx-auto lg:mx-0">
                  {t('home.hero.subtitle')}
                </p>
              </Reveal>

              <Reveal delay={300}>
                <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                  <Link to="/register" className="group inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl shadow-xl shadow-primary-600/25 hover:shadow-2xl hover:shadow-primary-600/30 hover:-translate-y-0.5 transition-all">
                    {t('home.cta')}
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  </Link>
                  <a href="#how" className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-gray-700 bg-gray-100 rounded-2xl hover:bg-gray-200 transition-colors">
                    <svg className="w-5 h-5 text-primary-600" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    {t('home.hero.demo')}
                  </a>
                </div>
              </Reveal>

              {/* Trust bar */}
              <Reveal delay={400}>
                <div className="mt-10 flex items-center gap-4 justify-center lg:justify-start">
                  <div className="flex -space-x-2">
                    {['bg-primary-400', 'bg-amber-400', 'bg-emerald-400', 'bg-rose-400'].map((c, i) => (
                      <div key={i} className={`w-8 h-8 rounded-full ${c} border-2 border-white flex items-center justify-center text-white text-[10px] font-bold`}>
                        {['A', 'K', 'M', 'S'][i]}
                      </div>
                    ))}
                  </div>
                  <div className="text-sm text-gray-500">
                    <span className="font-semibold text-gray-800">500+</span> {t('home.hero.trust')}
                  </div>
                </div>
              </Reveal>

              <Reveal delay={500}>
                <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-2xl mx-auto lg:mx-0">
                  {valueHighlights.map((item) => (
                    <div key={item.key} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm">
                      <span className="text-base leading-none">{item.icon}</span>
                      <span className="truncate">{t(`home.features.${item.key}`)}</span>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>

            {/* Right — phone mockup */}
            <Reveal delay={200} className="flex-shrink-0">
              <PhoneMockup />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════ STATS BAR ═══════ */}
      <section className="border-y border-gray-100 bg-gray-50/50">
        <div className="container mx-auto py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { end: 500, suffix: '+', label: t('home.stats.businesses'), icon: '🏢' },
              { end: 50000, suffix: '+', label: t('home.stats.scans'), icon: '📱' },
              { end: 5, suffix: '', label: t('home.stats.minutes'), icon: '⚡' },
              { end: 99, suffix: '%', label: t('home.stats.uptime'), icon: '🟢' },
            ].map((s, i) => (
              <Reveal key={i} delay={i * 100} className="text-center">
                <div className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-1">
                  <Counter end={s.end} suffix={s.suffix} />
                </div>
                <div className="text-sm text-gray-500 font-medium">{s.icon} {s.label}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ BUSINESS TYPES ═══════ */}
      <section id="solutions" className="py-20 md:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-16">
          <Reveal>
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-1.5 rounded-full bg-primary-50 text-primary-600 text-sm font-semibold mb-4">{t('home.nav.solutions')}</span>
              <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-4">{t('home.business.title')}</h2>
              <p className="text-gray-500 max-w-xl mx-auto text-lg">{t('home.business.subtitle')}</p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {businessTypes.map((bt, i) => (
              <Reveal key={bt.key} delay={i * 150}>
                <div className={`group relative rounded-3xl overflow-hidden border border-gray-100 hover:border-gray-200 bg-white hover:shadow-2xl transition-all duration-500 hover:-translate-y-1`}>
                  {/* Gradient top */}
                  <div className={`h-40 bg-gradient-to-br ${bt.gradient} relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-black/10" />
                    <div className="absolute bottom-4 left-6 text-6xl opacity-80 group-hover:scale-110 transition-transform duration-500">{bt.icon}</div>
                    <div className="absolute top-4 right-4 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs font-semibold">{t(`home.business.${bt.key}.tag`)}</div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{t(`home.business.${bt.key}.title`)}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed mb-5">{t(`home.business.${bt.key}.desc`)}</p>
                    <ul className="space-y-2.5">
                      {[1, 2, 3].map((n) => (
                        <li key={n} className="flex items-center gap-2.5 text-sm text-gray-700">
                          <div className={`w-5 h-5 rounded-full ${bt.bg} flex items-center justify-center shrink-0`}>
                            <svg className="w-3 h-3 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          </div>
                          {t(`home.business.${bt.key}.point${n}`)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ FEATURES ═══════ */}
      <section id="features" className="py-20 md:py-28 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-16">
          <Reveal>
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-1.5 rounded-full bg-primary-50 text-primary-600 text-sm font-semibold mb-4">{t('home.nav.features')}</span>
              <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-4">{t('home.features.title')}</h2>
              <p className="text-gray-500 max-w-xl mx-auto text-lg">{t('home.features.subtitle')}</p>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {features.map((f, i) => (
              <Reveal key={f.key} delay={i * 80}>
                <div className="group relative p-6 rounded-2xl bg-white border border-gray-100 hover:border-transparent hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden">
                  <div className={`absolute inset-0 bg-gradient-to-br ${f.color} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300`} />
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300">
                      {f.icon}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{t(`home.features.${f.key}`)}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{t(`home.features.${f.key}Desc`)}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200}>
            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-6xl mx-auto">
              {extraAdvantages.map((item) => (
                <div key={item.key} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3">
                  <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center text-lg">{item.icon}</div>
                  <span className="text-sm font-medium text-gray-700">{t(`home.capabilities.${item.key}`)}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ HOW IT WORKS ═══════ */}
      <section id="how" className="py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-primary-900 to-gray-900" />
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        <div className="container mx-auto relative">
          <Reveal>
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-1.5 rounded-full bg-white/10 text-primary-300 text-sm font-semibold mb-4 backdrop-blur-sm border border-white/10">{t('home.nav.howItWorks')}</span>
              <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">{t('home.how.title')}</h2>
              <p className="text-gray-400 max-w-xl mx-auto text-lg">{t('home.how.subtitle')}</p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {steps.map((s, i) => (
              <Reveal key={s.key} delay={i * 150}>
                <div className="relative group">
                  {i < 2 && <div className="hidden md:block absolute top-12 left-full w-full h-px bg-gradient-to-r from-primary-500/50 to-transparent -translate-x-6 z-0" />}
                  <div className="relative bg-white/5 backdrop-blur-sm rounded-3xl p-8 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 text-center group-hover:-translate-y-1">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center mx-auto mb-5 text-3xl shadow-lg shadow-primary-500/30 group-hover:scale-110 transition-transform duration-300">
                      {s.icon}
                    </div>
                    <div className="text-xs font-bold text-primary-400 mb-2 tracking-widest">{t('home.how.stepLabel')} {s.num}</div>
                    <h3 className="text-xl font-bold text-white mb-3">{t(`home.how.${s.key}.title`)}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{t(`home.how.${s.key}.desc`)}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={500}>
            <div className="text-center mt-12">
              <Link to="/register" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-primary-700 font-bold rounded-2xl hover:shadow-xl hover:shadow-white/10 hover:-translate-y-0.5 transition-all">
                {t('home.cta')}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════ CAPABILITIES + MOCKUP ═══════ */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-16">
          <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-16 items-center">
            <Reveal className="flex-1">
              <span className="inline-block px-4 py-1.5 rounded-full bg-primary-50 text-primary-600 text-sm font-semibold mb-4">{t('home.capabilities.tag')}</span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-8">{t('home.capabilities.title')}</h2>
              <ul className="space-y-4">
                {['banner', 'categories', 'modifiers', 'social', 'subdomain', 'trial'].map((cap, i) => (
                  <Reveal key={cap} delay={i * 80}>
                    <li className="flex items-center gap-4 p-3 rounded-xl hover:bg-primary-50/50 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shrink-0 shadow-sm shadow-primary-500/20">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <span className="text-gray-700 font-medium">{t(`home.capabilities.${cap}`)}</span>
                    </li>
                  </Reveal>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={200} className="flex-1 w-full flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-200/40 to-amber-200/30 rounded-[2rem] blur-2xl scale-110" />
                <div className="relative bg-gradient-to-br from-white to-primary-50 rounded-3xl p-8 border border-primary-100 shadow-xl">
                  <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4 min-w-[280px]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-xs shadow-md">QR</div>
                      <div>
                        <div className="h-3 bg-gray-300 rounded-full w-28 animate-pulse" />
                        <div className="h-2 bg-gray-200 rounded-full w-20 mt-2" />
                      </div>
                      <div className="ml-auto w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      </div>
                    </div>
                    <div className="h-24 bg-gradient-to-r from-primary-500 to-primary-700 rounded-xl flex items-center justify-center overflow-hidden relative">
                      <div className="absolute inset-0 bg-black/10" />
                      <span className="text-white font-semibold text-sm relative">🎉 {t('home.capabilities.promoPreview')}</span>
                    </div>
                    <div className="flex gap-2">
                      {['🍕 Pizza', '🍔 Burger', '🥤'].map((c, i) => (
                        <div key={i} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${i === 0 ? 'bg-primary-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500'}`}>{c}</div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {[1, 2].map((i) => (
                        <div key={i} className="flex items-center gap-3 p-2 rounded-xl bg-gray-50">
                          <div className="w-12 h-12 bg-gray-200 rounded-lg animate-pulse" />
                          <div className="flex-1">
                            <div className="h-3 bg-gray-300 rounded w-20" />
                            <div className="h-2 bg-primary-200 rounded w-14 mt-2" />
                          </div>
                          <div className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">+</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════ FAQ ═══════ */}
      <section id="faq" className="py-20 md:py-28 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-16">
          <Reveal>
            <div className="text-center mb-14">
              <span className="inline-block px-4 py-1.5 rounded-full bg-primary-50 text-primary-600 text-sm font-semibold mb-4">FAQ</span>
              <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-4">{t('home.faq.title')}</h2>
            </div>
          </Reveal>
          <div className="max-w-2xl mx-auto">
            {['faq1', 'faq2', 'faq3', 'faq4', 'faq5'].map((key, i) => (
              <Reveal key={key} delay={i * 80}>
                <FaqItem q={t(`home.faq.${key}.q`)} a={t(`home.faq.${key}.a`)} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ FINAL CTA ═══════ */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-gray-900" />
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.2) 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="container mx-auto relative text-center">
          <Reveal>
            <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-5">{t('home.finalCta.title')}</h2>
            <p className="text-primary-200 text-lg mb-10 max-w-xl mx-auto">{t('home.finalCta.subtitle')}</p>
            <Link to="/register" className="group inline-flex items-center gap-3 bg-white text-primary-700 font-bold text-lg px-10 py-4.5 rounded-2xl hover:shadow-2xl hover:shadow-white/20 hover:-translate-y-1 transition-all">
              {t('home.cta')}
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="bg-gray-900 text-gray-400 pt-16 pb-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-16">
          <div className="grid md:grid-cols-4 gap-8 pb-10 border-b border-gray-800">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">Q</span>
                </div>
                <span className="text-xl font-bold text-white">OimoQR</span>
              </div>
              <p className="text-sm text-gray-500 max-w-xs leading-relaxed">{t('home.footer.tagline')}</p>
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm mb-4">{t('home.footer.product')}</h4>
              <div className="space-y-3 text-sm">
                <a href="#features" className="block hover:text-white transition-colors">{t('home.nav.features')}</a>
                <Link to="/pricing" className="block hover:text-white transition-colors">{t('home.nav.pricing')}</Link>
                <a href="#faq" className="block hover:text-white transition-colors">FAQ</a>
              </div>
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm mb-4">{t('home.footer.getStarted')}</h4>
              <div className="space-y-3 text-sm">
                <Link to="/register" className="block hover:text-white transition-colors">{t('common.register')}</Link>
                <Link to="/login" className="block hover:text-white transition-colors">{t('common.login')}</Link>
              </div>
            </div>
          </div>
          <div className="pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-600">{t('home.footer.copy')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;