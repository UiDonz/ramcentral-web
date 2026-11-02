import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import ProtectedRoute from './components/ProtectedRoute';
import StaffRoute from './components/StaffRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import ClubDetail from './pages/ClubDetail';
import CreateClub from './pages/CreateClub';
import Events from './pages/Events';
import Profile from './pages/Profile';
import News from './pages/News';
import AdminDashboard from './pages/AdminDashboard';
import Settings from './pages/Settings';
import './styles/app.css';

// The sidebar only makes sense once someone's signed in - Login/Signup
function AppShell() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

  if (!currentUser || isAuthPage) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <Routes>
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/clubs/:clubId" element={<ProtectedRoute><ClubDetail /></ProtectedRoute>} />
          <Route path="/create-club" element={<ProtectedRoute><CreateClub /></ProtectedRoute>} />
          <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
          <Route path="/news" element={<ProtectedRoute><News /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          {/* Appearance (theme/accent/font size) + Home layout reorder -
             open to any signed-in user, same as Profile. */}
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          {/* Staff/Super Admin Command Center - StaffRoute redirects any
             signed-in non-faculty account back to / rather than /login,
             since they ARE authenticated, just not authorized here. */}
          <Route path="/admin" element={<StaffRoute><AdminDashboard /></StaffRoute>} />
        </Routes>
      </div>
    </div>
  );
}
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          {/* Wraps the whole shell (including Login/Signup) rather than
             just the signed-in branch, so the hook is always available;
             with nobody signed in, profile is null and settings just sit
             at DEFAULT_SETTINGS (light/forest/default) - see
             SettingsContext.jsx. */}
          <SettingsProvider>
            <AppShell />
          </SettingsProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}