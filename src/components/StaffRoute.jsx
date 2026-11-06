import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isStaff } from '../services/rbac';
// Same shape as ProtectedRoute, plus a staff check. A signed-in
// non-staff user is redirected back to the Clubs home page rather than
// to /login, since they ARE authenticated - they're just not
// authorized for this particular route.
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