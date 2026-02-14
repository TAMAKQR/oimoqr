import { useEffect } from 'react';
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
import AdminDashboardPage from './pages/AdminDashboardPage';
import NotFoundPage from './pages/NotFoundPage';
import MenuManagementPage from './pages/MenuManagementPage';
import RestaurantSettingsPage from './pages/RestaurantSettingsPage';
import StaffManagementPage from './pages/StaffManagementPage';
import AdminPricingPage from './pages/AdminPricingPage';
import LanguageSettingsPage from './pages/LanguageSettingsPage';
import CustomerLoginPage from './pages/CustomerLoginPage';
import WhatsAppLoginPage from './pages/WhatsAppLoginPage';
import CustomerProfilePage from './pages/CustomerProfilePage';
import CustomerRestaurantsPage from './pages/CustomerRestaurantsPage';
import PricingPage from './pages/PricingPage';
import CustomersPage from './pages/CustomersPage';
import CheckoutPage from './pages/CheckoutPage';
import ModifierTemplatesPage from './pages/ModifierTemplatesPage';
import StoreManagementPage from './pages/StoreManagementPage';
import ShopPage from './pages/ShopPage';

// Components
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import CustomerPrivateRoute from './components/CustomerPrivateRoute';

const CACHE_VERSION =
  import.meta.env.VITE_APP_CACHE_VERSION ||
  import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA ||
  import.meta.env.VERCEL_GIT_COMMIT_SHA ||
  import.meta.env.VITE_COMMIT_SHA ||
  'v2026-02-09-cachebust';

function App() {
  // Keep bottom-fixed UI aligned with the visible viewport on mobile browsers
  // (e.g. Chrome bottom controls / virtual keyboard changing the visual viewport).
  useEffect(() => {
    const root = document.documentElement;

    const update = () => {
      let offset = 0;
      const vv = window.visualViewport;
      if (vv) {
        offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      }
      root.style.setProperty('--visual-bottom-offset', `${Math.round(offset)}px`);
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', update);
      window.visualViewport.addEventListener('scroll', update);
    }

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', update);
        window.visualViewport.removeEventListener('scroll', update);
      }
      root.style.removeProperty('--visual-bottom-offset');
    };
  }, []);

  // Force-refresh assets when cache version changes to avoid stale config for returning users
  useEffect(() => {
    const storedVersion = localStorage.getItem('app-cache-version');
    if (storedVersion === CACHE_VERSION) return;

    localStorage.setItem('app-cache-version', CACHE_VERSION);

    (async () => {
      try {
        if (window.caches?.keys) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }
        if (navigator.serviceWorker?.getRegistrations) {
          const regs = await navigator.serviceWorker.getRegistrations();
          regs.forEach((reg) => reg.update());
        }
      } catch (e) {
        console.warn('Cache clear/update failed', e);
      } finally {
        window.location.reload();
      }
    })();
  }, []);

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/menu/:subdomain" element={<MenuPage />} />
          <Route path="/shop/:subdomain" element={<ShopPage />} />
          <Route path="/:subdomain" element={<MenuPage />} />

          {/* Customer routes */}
          <Route path="/customer/login" element={<WhatsAppLoginPage />} />
          <Route path="/customer/whatsapp-login" element={<WhatsAppLoginPage />} />
          <Route path="/customer/profile" element={<CustomerPrivateRoute><CustomerProfilePage /></CustomerPrivateRoute>} />
          <Route path="/customer/restaurants" element={<CustomerPrivateRoute><CustomerRestaurantsPage /></CustomerPrivateRoute>} />
          <Route path="/customer/orders" element={<CustomerPrivateRoute><CustomerProfilePage /></CustomerPrivateRoute>} />
          <Route path="/customer/orders/:orderId" element={<CustomerPrivateRoute><CustomerProfilePage /></CustomerPrivateRoute>} />
          <Route path="/customer/favorites" element={<CustomerPrivateRoute><CustomerProfilePage /></CustomerPrivateRoute>} />
          <Route path="/checkout" element={<CheckoutPage />} />

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
            path="/modifier-templates"
            element={
              <PrivateRoute>
                <ModifierTemplatesPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/store-management"
            element={
              <PrivateRoute>
                <StoreManagementPage />
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
          <Route
            path="/customers/:restaurantId"
            element={
              <PrivateRoute>
                <CustomersPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/pricing"
            element={
              <PrivateRoute>
                <PricingPage />
              </PrivateRoute>
            }
          />

          {/* Admin routes */}
          <Route
            path="/admin/dashboard"
            element={
              <AdminRoute>
                <AdminDashboardPage />
              </AdminRoute>
            }
          />
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
      <Toaster
        position="top-center"
        toastOptions={{
          // Настройки по умолчанию для всех toast
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
            fontSize: '14px',
            maxWidth: '500px',
          },
          // Успешные уведомления
          success: {
            duration: 3000,
            style: {
              background: '#10b981',
            },
            iconTheme: {
              primary: '#fff',
              secondary: '#10b981',
            },
          },
          // Ошибки
          error: {
            duration: 5000,
            style: {
              background: '#ef4444',
            },
            iconTheme: {
              primary: '#fff',
              secondary: '#ef4444',
            },
          },
          // Загрузка
          loading: {
            style: {
              background: '#3b82f6',
            },
          },
        }}
      />
    </ErrorBoundary>
  );
}

export default App;