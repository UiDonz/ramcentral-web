import { NavLink, useNavigate } from 'react-router-dom';
import { Users, CalendarDays, Newspaper, Plus, LogOut, ShieldCheck, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isStaff } from '../services/rbac';

const LINKS = [
  { to: '/', label: 'Clubs', Icon: Users, end: true },
  { to: '/events', label: 'Events', Icon: CalendarDays },
  { to: '/news', label: 'News', Icon: Newspaper },
  { to: '/create-club', label: 'Create', Icon: Plus },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
];

export default function Sidebar() {
  const { currentUser, profile, logout } = useAuth();
  const navigate = useNavigate();

  if (!currentUser) return null;

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const initials = (profile?.name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <>
      {/* Thin, always-present strip along the left edge with a subtle gold
         tab - hovering it (or the sidebar itself) slides the full sidebar
         into view via CSS (see .sidebar-hover-zone / .sidebar in app.css).
         focus-within on .sidebar keeps it reachable by keyboard tabbing
         even without a mouse. */}
      <div className="sidebar-hover-zone" aria-hidden="true" />
      <nav className="sidebar" aria-label="Main navigation">
        <NavLink to="/" className="sidebar-brand" aria-label="NewRamCentral home">R</NavLink>

        <div className="sidebar-links">
          {LINKS.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <Icon size={20} aria-hidden="true" />
              <span className="sidebar-label">{label}</span>
            </NavLink>
          ))}
          {/* Command Center - only faculty (Staff/Super Admin) accounts
             see this link at all, matching the /admin route's own
             StaffRoute guard in App.jsx. A student who somehow guessed
             the URL would still be bounced back to / by that guard. */}
          {isStaff(profile) && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <ShieldCheck size={20} aria-hidden="true" />
              <span className="sidebar-label">Admin</span>
            </NavLink>
          )}
        </div>

        <div className="sidebar-spacer" />

        <NavLink to="/profile" className="sidebar-avatar" aria-label="Your profile">
          {initials}
        </NavLink>
        <button type="button" className="sidebar-logout" onClick={handleLogout} aria-label="Log out">
          <LogOut size={16} aria-hidden="true" />
        </button>
      </nav>
    </>
  );
}