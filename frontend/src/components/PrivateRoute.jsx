import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore((state) => ({
    isAuthenticated: state.isAuthenticated,
  }));

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Авторизованные пользователи (включая админов) имеют доступ
  return children;
};

export default PrivateRoute;