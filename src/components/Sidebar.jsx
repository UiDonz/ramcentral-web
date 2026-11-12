import { NavLink, useNavigate } from 'react-router-dom';
import { Users, CalendarDays, CalendarRange, Newspaper, Plus, LogOut, ShieldCheck, Settings as SettingsIcon }
 from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isStaff } from '../services/rbac';
const LINKS = [
  { to: '/', label: 'Clubs', Icon: Users, end: true },
  { to: '/events', label: 'Events', Icon: CalendarDays },
  { to: '/calendar', label: 'Calendar', Icon: CalendarRange },
  { to: '/news', label: 'News', Icon: Newspaper },
  { to: '/create-club', label: 'Create', Icon: Plus },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
]
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
      {/* Thin strip on the left edge; hovering it (or the sidebar) slides the sidebar in via CSS.
           focus-within keeps it reachable by keyboard. */}
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
          {/* Command Center link: faculty (Staff/Super Admin) only, matching the StaffRoute guard on /admin. */}
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