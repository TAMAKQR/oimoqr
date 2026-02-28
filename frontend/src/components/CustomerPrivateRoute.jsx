import { Navigate } from 'react-router-dom';
import { useCustomerAuthStore } from '../store/customerAuthStore';

const CustomerPrivateRoute = ({ children }) => {
    const isAuthenticated = useCustomerAuthStore((state) => state.isAuthenticated);

    if (!isAuthenticated) {
        return <Navigate to="/customer/login" replace />;
    }

    return children;
};

export default CustomerPrivateRoute;
