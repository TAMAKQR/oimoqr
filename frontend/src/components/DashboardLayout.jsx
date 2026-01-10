import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Sidebar from './Sidebar';

const DashboardLayout = ({ children, userData, selectedRestaurantId }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <Sidebar userData={userData} selectedRestaurantId={selectedRestaurantId} />

      {/* Main Content */}
      <div className="flex-1 lg:ml-20 transition-all duration-300">
        {/* Page Content */}
        <main className="py-4 sm:py-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;