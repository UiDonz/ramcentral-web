import { useMemo, useState } from 'react';
import { getSemester, formatEventDate, semestersAgo, semestersAgoLabel } from '../utils/semester';
// How many semester groups show before the "Show older events" button.
const VISIBLE_GROUPS = 2;
// events: past events, newest first (listenToPastClubEvents already sorts
// them that way). Grouped under a "Fall 2026" style heading, each event
// stamped with its exact semester + date ("Fall 2026, October 20th")
// instead of a relative "posted 3 months ago" - an old event still reads
// as something this club actually ran.
export default function PastEvents({ events }) {
 const [showAll, setShowAll] = useState(false);
 const groups = useMemo(() => {
 const byLabel = new Map();
 for (const ev of events) {
 const sem = getSemester(ev.dateTime);
 if (!sem) continue;
 if (!byLabel.has(sem.label)) {
 byLabel.set(sem.label, { label: sem.label, ago: semestersAgo(ev.dateTime), events: [] });
 }
 byLabel.get(sem.label).events.push(ev);
 }
 return [...byLabel.values()];
 }, [events]);
 if (groups.length === 0) {
 return <p className="empty-state">No past events yet.</p>;
 }
 const shown = showAll ? groups : groups.slice(0, VISIBLE_GROUPS);
 return (
 <div className="past-events">
 {shown.map((g) => (
 <div key={g.label} className="past-semester">
 <h3 className="past-semester-title">
 {g.label}
 <span className="past-semester-ago">{semestersAgoLabel(g.ago)}</span>
 </h3>
 {g.events.map((ev) => (
 <div key={ev.id} className="event-card past-event-card">
 <h4>{ev.title}</h4>
 <p className="past-event-date">{formatEventDate(ev.dateTime)}</p>
 {ev.location && <p className="past-event-location">{ev.location}</p>}
 </div>
 ))}
 </div>
 ))}
 {groups.length > VISIBLE_GROUPS && (
 <button type="button" className="link-button" onClick={() => setShowAll((v) => !v)}>
 {showAll ? 'Show fewer' : `Show older events (${groups.length - VISIBLE_GROUPS} more semesters)`}
 </button>
 )}
 </div>
 );
}