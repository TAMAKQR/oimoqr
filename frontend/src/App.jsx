import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { Toaster } from 'react-hot-toast';
import ErrorBoundary from './ErrorBoundary';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import MenuPage from './pages/MenuPage';
import AdminPage from './pages/AdminPage';
import NotFoundPage from './pages/NotFoundPage';
import MenuManagementPage from './pages/MenuManagementPage';
import RestaurantSettingsPage from './pages/RestaurantSettingsPage';
import StaffManagementPage from './pages/StaffManagementPage';
import AdminPricingPage from './pages/AdminPricingPage';
import LanguageSettingsPage from './pages/LanguageSettingsPage';

// Components
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/menu/:subdomain" element={<MenuPage />} />
        <Route path="/:subdomain" element={<MenuPage />} />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <DashboardPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/menu-management"
          element={
            <PrivateRoute>
              <MenuManagementPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <PrivateRoute>
              <RestaurantSettingsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/languages"
          element={
            <PrivateRoute>
              <LanguageSettingsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/staff/:restaurantId"
          element={
            <PrivateRoute>
              <StaffManagementPage />
            </PrivateRoute>
          }
        />

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/pricing"
          element={
            <AdminRoute>
              <AdminPricingPage />
            </AdminRoute>
          }
        />

        {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Router>
      <Toaster />
    </ErrorBoundary>
  );
}

export default App;