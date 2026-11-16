import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listenToEventsInRange } from '../services/events';
import { toDate } from '../utils/semester';
import Calendar from './Calendar';
// Calendars key days as 'YYYY-M-D' (month NOT zero-padded).
function dayKey(d) {
 return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function formatTime(d) {
 return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
// The club calendar, shown inside the "Your clubs" tab on the Clubs page.
// Fed ONLY by club events (the top-level `events` collection) - never the
// academic calendar or campus news the News page shows. By default it
// shows events from the clubs you're in; the checkbox widens it to every
// active club. Events load one visible month at a time.
// clubs: active clubs (used for names, and to hide archived/pending ones)
// myClubIds: Set of club ids the signed-in user belongs to
export default function ClubCalendarPanel({ clubs, myClubIds }) {
 const [range, setRange] = useState(() => {
 const now = new Date();
 return { year: now.getFullYear(), month: now.getMonth() };
 });
 const [rawEvents, setRawEvents] = useState([]);
 const [allClubs, setAllClubs] = useState(false);
 const [selected, setSelected] = useState(null); // { key, label }
 const [error, setError] = useState(null);
 const clubNames = useMemo(() => {
 const map = {};
 clubs.forEach((c) => {
 map[c.id] = c.name;
 });
 return map;
 }, [clubs]);
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
 .filter((ev) => toDate(ev.dateTime) && clubNames[ev.clubId] && (allClubs || myClubIds.has(ev.clubId)))
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
 }, [rawEvents, clubNames, allClubs, myClubIds]);
 // Keep an open day panel in sync when the toggle or live data changes.
 const selectedEvents = selected ? calendarEvents.filter((ev) => ev.date === selected.key) : [];
 return (
 <div>
 <label className="checkbox-label">
 <input type="checkbox" checked={allClubs} onChange={(e) => setAllClubs(e.target.checked)} />
 Include events from clubs I haven't joined
 </label>
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
