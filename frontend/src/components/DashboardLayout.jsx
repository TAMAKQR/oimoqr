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
    <div className="min-h-screen bg-[#f5f5f5] flex">
      {/* Sidebar */}
      <Sidebar
        userData={userData}
        selectedRestaurantId={selectedRestaurantId}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
      />

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <main className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;