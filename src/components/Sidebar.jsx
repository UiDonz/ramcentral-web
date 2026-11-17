import { useEffect, useState } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Users,
  CalendarDays,
  Newspaper,
  Plus,
  LogOut,
  ShieldCheck,
  Settings as SettingsIcon,
  Menu,
  X,
  UserRound
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isStaff } from '../services/rbac';
import Logo from './Logo';
const LINKS = [
 { to: '/', label: 'Clubs', Icon: Users, end: true },
 { to: '/events', label: 'Events', Icon: CalendarDays },
 { to: '/news', label: 'News', Icon: Newspaper },
 { to: '/create-club', label: 'Create', Icon: Plus },
 { to: '/settings', label: 'Settings', Icon: SettingsIcon },
]
// Desktop: the fixed sidebar on the left. Phones (see app.css): a slim top
// bar with a menu button (three lines); tapping it slides this same sidebar
// in as a drawer, so pages get the whole screen the rest of the time.
export default function Sidebar() {
  const { currentUser, profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Close the phone menu after moving to another page.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // While the phone menu is open: Escape closes it and the page behind doesn't scroll.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.classList.add('menu-open');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('menu-open');
    };
  }, [open]);

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

  const linkClass = ({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`;

  return (
    <>
      {/* Phones only: brand + menu button. Hidden on desktop. */}
      <header className="mobile-topbar">
        <Link to="/" className="mobile-brand" aria-label="RamConnect home">
          <Logo size={32} />
          <span>
            Ram<span className="mobile-brand-accent">Connect</span>
          </span>
        </Link>
        <button
          type="button"
          className="mobile-menu-btn"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="main-navigation"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
        </button>
      </header>
      <div className={`sidebar-scrim${open ? ' open' : ''}`} onClick={() => setOpen(false)} aria-hidden="true" />

      {/* Thin strip on the left edge; hovering it (or the sidebar) slides the sidebar in via CSS.
           focus-within keeps it reachable by keyboard. */}
      <div className="sidebar-hover-zone" aria-hidden="true" />
      <nav id="main-navigation" className={`sidebar${open ? ' open' : ''}`} aria-label="Main navigation">
        <NavLink to="/" className="sidebar-brand" aria-label="RamConnect home"><Logo size={44} /></NavLink>

        <div className="sidebar-links">
          {LINKS.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClass}>
              <Icon size={20} aria-hidden="true" />
              <span className="sidebar-label">{label}</span>
            </NavLink>
          ))}
          {/* Command Center link: faculty (Staff/Super Admin) only, matching the StaffRoute guard on /admin. */}
          {isStaff(profile) && (
            <NavLink to="/admin" className={linkClass}>
              <ShieldCheck size={20} aria-hidden="true" />
              <span className="sidebar-label">Admin</span>
            </NavLink>
          )}
          {/* Phone menu only: Profile and Log out as full rows. */}
          <NavLink to="/profile" className={(s) => `${linkClass(s)} sidebar-mobile-only sidebar-divider`}>
            <UserRound size={20} aria-hidden="true" />
            <span className="sidebar-label">Profile</span>
          </NavLink>
          <button type="button" className="sidebar-link sidebar-mobile-only" onClick={handleLogout}>
            <LogOut size={20} aria-hidden="true" />
            <span className="sidebar-label">Log out</span>
          </button>
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
