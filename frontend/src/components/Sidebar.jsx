import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';

const Sidebar = ({ userData, selectedRestaurantId, collapsed, onToggleCollapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null);
  const sidebarRef = useRef(null);

  const isOwner = !!(userData?.restaurants?.some(r => r.id === selectedRestaurantId));
  const isAdmin = user?.isAdmin;
  const selectedRestaurant = userData?.restaurants?.find(r => r.id === selectedRestaurantId);
  const isStore = selectedRestaurant?.businessType === 'ONLINE_STORE';
  const isHotel = selectedRestaurant?.businessType === 'HOTEL';

  // Poster POS style menu structure with sections
  const menuSections = [
    {
      id: 'dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      ),
      label: 'Главная',
      path: '/dashboard',
      show: true,
    },
    {
      id: 'menu',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      ),
      label: 'Меню',
      show: !isAdmin && !isStore,
      expandable: true,
      children: [
        { label: 'Управление', path: '/menu-management', show: true },
        { label: 'Модификаторы', path: '/modifier-templates', show: isOwner },
      ],
    },
    {
      id: 'store',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      ),
      label: 'Товары',
      path: '/store-management',
      show: !isAdmin && isStore,
    },
    {
      id: 'settings',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      label: 'Настройки',
      show: isOwner,
      expandable: true,
      children: [
        { label: 'Ресторан', path: '/settings', show: true },
        { label: 'Языки', path: '/languages', show: true },
      ],
    },
    {
      id: 'people',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
      label: 'Люди',
      show: isOwner && !!selectedRestaurantId,
      expandable: true,
      children: [
        { label: 'Персонал', path: selectedRestaurantId ? `/staff/${selectedRestaurantId}` : '/dashboard', show: true },
        { label: 'Клиенты', path: selectedRestaurantId ? `/customers/${selectedRestaurantId}` : '/dashboard', show: true },
      ],
    },
    {
      id: 'pricing',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
        </svg>
      ),
      label: 'Тарифы',
      path: '/pricing',
      show: !isAdmin,
    },
    {
      id: 'admin-dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
        </svg>
      ),
      label: 'Статистика',
      path: '/admin/dashboard',
      show: isAdmin,
    },
    {
      id: 'admin-users',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
      label: 'Пользователи',
      path: '/admin',
      show: isAdmin,
    },
    {
      id: 'admin-pricing',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
        </svg>
      ),
      label: 'Управление тарифами',
      path: '/admin/pricing',
      show: isAdmin,
    },
  ];

  const isActive = (path) => location.pathname === path;
  const isSectionActive = (section) => {
    if (section.path) return isActive(section.path);
    if (section.children) return section.children.some(child => isActive(child.path));
    return false;
  };

  // Auto-expand active section
  useEffect(() => {
    for (const section of menuSections) {
      if (section.expandable && section.children?.some(c => isActive(c.path))) {
        setExpandedSection(section.id);
        break;
      }
    }
  }, [location.pathname]);

  // Close sidebar on mobile when route changes
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setIsOpen(false);
    }
  }, [location.pathname]);

  const handleNavigate = (path) => {
    navigate(path);
    if (window.innerWidth < 1024) {
      setIsOpen(false);
    }
  };

  const toggleSection = (id) => {
    if (collapsed) {
      onToggleCollapsed?.();
      setExpandedSection(id);
      return;
    }
    setExpandedSection(expandedSection === id ? null : id);
  };

  const handleLogout = () => {
    useAuthStore.getState().logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-white text-gray-700 p-2.5 rounded-lg shadow-md border border-gray-200 hover:bg-gray-50 transition-colors"
        aria-label="Меню"
      >
        {isOpen ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        )}
      </button>

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`
          fixed lg:sticky lg:top-0 top-0 left-0 h-screen bg-white border-r border-gray-200 z-40
          transition-all duration-300 ease-in-out
          flex-shrink-0 flex flex-col
          ${collapsed ? 'w-[68px]' : 'w-[260px]'}
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-gray-100 flex-shrink-0 justify-between">
          <div
            className={`flex items-center gap-3 cursor-pointer overflow-hidden ${collapsed ? 'justify-center w-full' : ''}`}
            onClick={() => handleNavigate('/dashboard')}
          >
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">Q</span>
            </div>
            {!collapsed && (
              <span className="text-lg font-bold text-gray-900 tracking-tight whitespace-nowrap">OimoQR</span>
            )}
          </div>
        </div>

        {/* Collapse toggle button (desktop only) */}
        <button
          onClick={onToggleCollapsed}
          className={`hidden lg:flex items-center justify-center my-2 w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0 ${collapsed ? 'mx-auto' : 'ml-4'}`}
          title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
        >
          <svg
            className={`w-4 h-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-1">
          {menuSections.filter(s => s.show).map((section) => (
            <div key={section.id}>
              {section.expandable ? (
                <>
                  {/* Expandable section header */}
                  <button
                    onClick={() => toggleSection(section.id)}
                    title={collapsed ? section.label : undefined}
                    className={`
                      w-full flex items-center ${collapsed ? 'justify-center px-0 py-3' : 'justify-between px-6 py-2.5'} text-sm transition-colors
                      ${isSectionActive(section)
                        ? 'text-blue-600 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                      }
                    `}
                  >
                    <div className={`flex items-center ${collapsed ? '' : 'gap-3'}`}>
                      <span className={`flex-shrink-0 ${isSectionActive(section) ? 'text-blue-600' : 'text-gray-400'}`}>{section.icon}</span>
                      {!collapsed && <span>{section.label}</span>}
                    </div>
                    {!collapsed && (
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expandedSection === section.id ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    )}
                  </button>

                  {/* Expandable children - hidden when collapsed */}
                  {!collapsed && (
                    <div
                      className={`overflow-hidden transition-all duration-200 ${expandedSection === section.id ? 'max-h-48' : 'max-h-0'}`}
                    >
                      {section.children.filter(c => c.show).map((child) => (
                        <button
                          key={child.path}
                          onClick={() => handleNavigate(child.path)}
                          className={`
                            w-full text-left pl-14 pr-6 py-2 text-sm transition-colors
                            ${isActive(child.path)
                              ? 'text-blue-600 font-medium bg-blue-50'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                            }
                          `}
                        >
                          {child.label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                /* Regular menu item */
                <button
                  onClick={() => handleNavigate(section.path)}
                  title={collapsed ? section.label : undefined}
                  className={`
                    w-full flex items-center ${collapsed ? 'justify-center px-0 py-3' : 'gap-3 px-6 py-2.5'} text-sm transition-colors
                    ${isActive(section.path)
                      ? `text-blue-600 font-medium bg-blue-50 ${collapsed ? '' : 'border-r-2 border-blue-600'}`
                      : 'text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  <span className={`flex-shrink-0 ${isActive(section.path) ? 'text-blue-600' : 'text-gray-400'}`}>{section.icon}</span>
                  {!collapsed && <span>{section.label}</span>}
                  {!collapsed && section.badge && (
                    <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {section.badge}
                    </span>
                  )}
                </button>
              )}
            </div>
          ))}
        </nav>

        {/* User section at bottom */}
        {user && (
          <div className="border-t border-gray-100 p-3 flex-shrink-0">
            {collapsed ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                  title="Выйти"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                  title="Выйти"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 z-30 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default Sidebar;