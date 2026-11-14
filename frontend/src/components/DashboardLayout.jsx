import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Sidebar from './Sidebar';

const DashboardLayout = ({ children, userData, selectedRestaurantId }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true');

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-[#F6F7F9] text-gray-900">
      {/* Sidebar */}
      <Sidebar
        userData={userData}
        selectedRestaurantId={selectedRestaurantId}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
      />

      {/* Main Content */}
      <div className="min-w-0 flex-1">
        <div className="h-14 border-b border-gray-200/70 bg-white/90 backdrop-blur lg:hidden" />
        <main className="px-4 pb-10 pt-5 sm:px-6 sm:pt-6 lg:px-8 lg:py-8 xl:px-10">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
