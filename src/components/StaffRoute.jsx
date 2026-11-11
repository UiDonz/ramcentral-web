import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isStaff } from '../services/rbac';
// Same as ProtectedRoute plus a staff check; signed-in non-staff users are sent back home, not to /login.
export default function StaffRoute({ children }) {
const { currentUser, profile } = useAuth();
if (!currentUser) {
return <Navigate to="/login" replace />;
}
if (!isStaff(profile)) {
return <Navigate to="/" replace />;
}
return children;
}