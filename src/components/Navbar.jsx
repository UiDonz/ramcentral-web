import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { currentUser, profile, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <header className="navbar">
      <Link to="/" className="navbar-brand">NewRamCentral</Link>
      {currentUser && (
        <nav className="navbar-links">
          <Link to="/">Clubs</Link>
          <Link to="/events">Events</Link>
          <Link to="/create-club">Start a club</Link>
          <Link to="/profile">{profile?.name || 'Profile'}</Link>
          <button className="link-button" onClick={handleLogout}>Log out</button>
        </nav>
      )}
    </header>
  );
}