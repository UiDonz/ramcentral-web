import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collectionGroup, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { listenToUpcomingEvents } from '../services/events';
import { listenToClubs } from '../services/clubs';
import { cardThemeClass, cardThemeStyle } from '../data/cardThemes';
import CardThemeIcon from '../components/CardThemeIcon';

// "Nov 20" for the top-right corner and "6:00 PM" for the details line.
function dayLabel(ev) {
  return new Date(ev.dateTime.seconds * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function timeLabel(ev) {
  return new Date(ev.dateTime.seconds * 1000).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit'
  });
}

export default function Events() {
  const { currentUser } = useAuth();
  const [events, setEvents] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [myClubIds, setMyClubIds] = useState(new Set());
  const [scope, setScope] = useState('all');

  useEffect(() => {
    const unsub = listenToUpcomingEvents(setEvents);
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = listenToClubs(setClubs);
    return unsub;
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collectionGroup(db, 'members'),
      where('uid', '==', currentUser.uid),
      where('status', '==', 'approved')
    );

    const unsub = onSnapshot(q, (snap) => {
      setMyClubIds(new Set(snap.docs.map((d) => d.ref.parent.parent.id)));
    });

    return unsub;
  }, [currentUser]);

  const clubNames = new Map(clubs.map((c) => [c.id, c.name]));
  const shown = scope === 'mine' ? events.filter((ev) => myClubIds.has(ev.clubId)) : events;

  return (
    <div className="page">
      <h1>Upcoming events</h1>
      <p className="page-subtitle">
        {scope === 'mine'
          ? "Events from clubs you've joined. Switch to All clubs to see everything."
          : 'Everything coming up across campus. Switch to My clubs to see only your own.'}
      </p>

      <div className="events-scope" role="group" aria-label="Which events to show">
        <button
          type="button"
          className={`events-scope-btn${scope === 'all' ? ' active' : ''}`}
          aria-pressed={scope === 'all'}
          onClick={() => setScope('all')}
        >
          All clubs
        </button>
        <button
          type="button"
          className={`events-scope-btn${scope === 'mine' ? ' active' : ''}`}
          aria-pressed={scope === 'mine'}
          onClick={() => setScope('mine')}
        >
          My clubs
        </button>
      </div>

      {shown.length === 0 && (
        <p className="empty-state">
          {scope === 'mine' ? 'No upcoming events from your clubs yet.' : 'No upcoming events yet.'}
        </p>
      )}

      <div className="club-grid">
        {shown.map((ev) => (
          <Link
            key={ev.id}
            to={`/clubs/${ev.clubId}`}
            className={`club-card${cardThemeClass(ev.background)}`}
            style={cardThemeStyle(ev.background)}
          >
            <CardThemeIcon themeId={ev.background} />
            <div className="club-card-header">
              <h3>{ev.title}</h3>
              <span className="club-card-count">{dayLabel(ev)}</span>
            </div>
            <span className="category-dot" style={{ color: 'var(--forest)' }}>
              {clubNames.get(ev.clubId) || 'Club event'}
            </span>
            <p className="club-card-desc">
              {timeLabel(ev)}
              {ev.location ? ` · ${ev.location}` : ''}
            </p>
            {ev.description && <p className="club-card-desc">{ev.description}</p>}
            {myClubIds.has(ev.clubId) && <span className="badge">Your club</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
