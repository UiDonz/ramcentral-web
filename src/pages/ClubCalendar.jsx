import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collectionGroup, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { listenToClubs } from '../services/clubs';
import { listenToEventsInRange } from '../services/events';
import { toDate } from '../utils/semester';
import Calendar from '../components/Calendar';

// Calendar.jsx keys days as 'YYYY-M-D' (month NOT zero-padded).
function dayKey(d) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function formatTime(d) {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// A calendar fed ONLY by club events (the top-level `events` collection) -
// deliberately not the academic calendar or campus news the News page
// already shows. Events load one visible month at a time, and only events
// belonging to an active club in the public directory are shown.
export default function ClubCalendar() {
  const { currentUser } = useAuth();
  const [range, setRange] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [rawEvents, setRawEvents] = useState([]);
  const [clubNames, setClubNames] = useState({});
  const [myClubIds, setMyClubIds] = useState(new Set());
  const [myClubsOnly, setMyClubsOnly] = useState(false);
  const [selected, setSelected] = useState(null); // { key, label }
  const [error, setError] = useState(null);

  useEffect(() => {
    return listenToClubs((clubs) => {
      const map = {};
      clubs.forEach((c) => {
        map[c.id] = c.name;
      });
      setClubNames(map);
    });
  }, []);

  useEffect(() => {
    if (!currentUser) {
      // Clear memberships on sign-out so "Only my clubs" doesn't show a
      // previous user's clubs.
      setMyClubIds(new Set());
      return;
    }
    const q = query(
      collectionGroup(db, 'members'),
      where('uid', '==', currentUser.uid),
      where('status', '==', 'approved')
    );
    return onSnapshot(q, (snap) => {
      setMyClubIds(new Set(snap.docs.map((d) => d.ref.parent.parent.id)));
    });
  }, [currentUser]);

  useEffect(() => {
    setError(null);
    setSelected(null);
    const start = new Date(range.year, range.month, 1);
    const end = new Date(range.year, range.month + 1, 1);
    return listenToEventsInRange(start, end, setRawEvents, () =>
      setError('Could not load events for this month.')
    );
  }, [range.year, range.month]);

  const calendarEvents = useMemo(() => {
    return rawEvents
      .filter(
        (ev) =>
          toDate(ev.dateTime) &&
          clubNames[ev.clubId] &&
          (!myClubsOnly || myClubIds.has(ev.clubId))
      )
      .map((ev) => {
        const when = toDate(ev.dateTime);
        return {
          ...ev,
          when,
          clubName: clubNames[ev.clubId],
          date: dayKey(when),
          category: 'clubs'
        };
      });
  }, [rawEvents, clubNames, myClubsOnly, myClubIds]);

  // Keep an open day panel in sync when the toggle or live data changes.
  const selectedEvents = selected
    ? calendarEvents.filter((ev) => ev.date === selected.key)
    : [];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Club calendar</h1>
          <p className="page-subtitle">
            Every event posted by a club on campus. Pick a day to see what's happening.
          </p>
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={myClubsOnly}
            onChange={(e) => setMyClubsOnly(e.target.checked)}
          />
          Only my clubs
        </label>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="club-calendar-layout">
        <Calendar
          events={calendarEvents}
          onMonthChange={(year, month) => setRange({ year, month })}
          onDayClick={(key, label) => setSelected({ key, label })}
        />

        <div className="day-panel club-day-panel">
          {!selected && <p className="day-panel-empty">Select a day to see its club events.</p>}
          {selected && (
            <>
              <div className="day-panel-date">{selected.label}</div>
              {selectedEvents.length === 0 && (
                <p className="day-panel-empty">No club events on this day.</p>
              )}
              {selectedEvents.map((ev) => (
                <div key={ev.id} className="club-day-event">
                  <div className="day-bullet-text">
                    <strong>{ev.title}</strong>
                  </div>
                  <div className="club-day-event-meta">
                    {formatTime(ev.when)}
                    {ev.location ? ` · ${ev.location}` : ''}
                  </div>
                  <Link className="day-bullet-link" to={`/clubs/${ev.clubId}`}>
                    {ev.clubName} &rarr;
                  </Link>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
