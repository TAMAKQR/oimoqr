import { Navigate } from 'react-router-dom';
import { useCustomerAuthStore } from '../store/customerAuthStore';

const CustomerPrivateRoute = ({ children }) => {
    const token = useCustomerAuthStore((state) => state.token);
    const isAuthenticated = Boolean(
        token ||
        localStorage.getItem('customer-token') ||
        localStorage.getItem('customerToken')
    );

    if (!isAuthenticated) {
        return <Navigate to="/customer/login" replace />;
    }

    return children;
};

export default CustomerPrivateRoute;
