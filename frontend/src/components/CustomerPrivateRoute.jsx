import { Navigate } from 'react-router-dom';
import customerService from '../services/customerService';

const CustomerPrivateRoute = ({ children }) => {
    if (!customerService.isAuthenticated()) {
        return <Navigate to="/customer/login" replace />;
    }

    return children;
};

export default CustomerPrivateRoute;
