import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

const Sidebar = ({ userData, selectedRestaurantId }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed on mobile

  // Проверка: является ли пользователь владельцем выбранного ресторана
  const isOwner = !!(userData?.restaurants?.some(r => r.id === selectedRestaurantId));

  const isAdmin = user?.isAdmin;

  const menuItems = [
    {
      path: '/dashboard',
      icon: '🏠',
      label: 'Главная',
      show: true
    },
    {
      path: '/menu-management',
      icon: '📝',
      label: 'Меню',
      show: !isAdmin
    },
    {
      path: '/settings',
      icon: '⚙️',
      label: 'Настройки',
      show: isOwner
    },
    {
      path: '/languages',
      icon: '🌐',
      label: 'Языки',
      show: isOwner
    },
    {
      path: selectedRestaurantId ? `/staff/${selectedRestaurantId}` : '/dashboard',
      icon: '👥',
      label: 'Персонал',
      show: isOwner && selectedRestaurantId
    },
    {
      path: selectedRestaurantId ? `/customers/${selectedRestaurantId}` : '/dashboard',
      icon: '🧑‍🤝‍🧑',
      label: 'Клиенты',
      show: isOwner && selectedRestaurantId
    },
    {
      path: '/pricing',
      icon: '💳',
      label: 'Тарифы',
      show: !isAdmin
    },
    {
      path: '/admin',
      icon: '👨‍💼',
      label: 'Админ панель',
      show: false
    },
    {
      path: '/admin/pricing',
      icon: '💰',
      label: 'Управление тарифами',
      show: isAdmin
    }
  ];

  const isActive = (path) => {
    return location.pathname === path;
  };

  // Close sidebar on mobile when route changes
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setIsCollapsed(true);
    }
  }, [location.pathname]);

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="lg:hidden fixed bottom-4 right-4 z-50 bg-primary-600 text-white p-3 rounded-full shadow-lg hover:bg-primary-700 transition-colors"
      >
        {isCollapsed ? '☰' : '✕'}
      </button>

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full bg-white shadow-lg z-40 transition-all duration-300
          ${isCollapsed ? '-translate-x-full lg:translate-x-0 lg:w-20' : 'translate-x-0 w-64'}
          flex flex-col
        `}
      >
        {/* Logo Section */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {!isCollapsed && (
              <h1 className="text-2xl font-bold text-primary-600">OimoQR</h1>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden lg:block text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100"
            >
              {isCollapsed ? '→' : '←'}
            </button>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {menuItems.filter(item => item.show).map((item) => (
              <li key={item.path}>
                <button
                  onClick={() => {
                    navigate(item.path);
                    if (window.innerWidth < 1024) {
                      setIsCollapsed(true);
                    }
                  }}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                    ${isActive(item.path)
                      ? 'bg-primary-100 text-primary-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                  title={isCollapsed ? item.label : ''}
                >
                  <span className="text-2xl">{item.icon}</span>
                  {!isCollapsed && (
                    <span className="text-sm">{item.label}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* User Info at Bottom */}
        {!isCollapsed && user && (
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-600 font-semibold">
                  {user.name?.charAt(0).toUpperCase() || '?'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user.email}
                </p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Overlay for mobile */}
      {!isCollapsed && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsCollapsed(true)}
        />
      )}
    </>
  );
};

export default Sidebar;