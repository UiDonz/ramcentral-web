import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import ClubDetail from './pages/ClubDetail';
import CreateClub from './pages/CreateClub';
import Events from './pages/Events';
import Profile from './pages/Profile';
import './styles/app.css';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Navbar />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route
              path="/clubs/:clubId"
              element={<ProtectedRoute><ClubDetail /></ProtectedRoute>}
            />
            <Route
              path="/create-club"
              element={<ProtectedRoute><CreateClub /></ProtectedRoute>}
            />
            <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
