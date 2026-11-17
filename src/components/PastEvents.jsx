import { useMemo, useState } from 'react';
import { getSemester, formatEventDate, semestersAgo, semestersAgoLabel } from '../utils/semester';
// How many semester groups show before the "Show older events" button.
const VISIBLE_GROUPS = 2;
// events: past events, newest first (listenToPastClubEvents already sorts
// them that way). Grouped under a "Fall 2026" style heading, each event
// stamped with its exact semester + date ("Fall 2026, October 20th")
// instead of a relative "posted 3 months ago" - an old event still reads
// as something this club actually ran.
// The section starts collapsed; opening it shows a search box that matches
// the title, place, description, semester or date.
export default function PastEvents({ events }) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byLabel = new Map();
    for (const ev of events) {
      const sem = getSemester(ev.dateTime);
      if (!sem) continue;
      if (q) {
        const haystack = [ev.title, ev.location, ev.description, sem.label, formatEventDate(ev.dateTime)]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) continue;
      }
      if (!byLabel.has(sem.label)) {
        byLabel.set(sem.label, { label: sem.label, ago: semestersAgo(ev.dateTime), events: [] });
      }
      byLabel.get(sem.label).events.push(ev);
    }
    return [...byLabel.values()];
  }, [events, search]);

  const searching = search.trim() !== '';
  const matchCount = groups.reduce((n, g) => n + g.events.length, 0);
  // While searching, show every matching semester instead of only the newest two.
  const shown = showAll || searching ? groups : groups.slice(0, VISIBLE_GROUPS);

  return (
    <div className={`past-events${open ? ' open' : ''}`}>
      <button
        type="button"
        className="section-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <h2>
          Past events <span className="section-toggle-count">({events.length})</span>
        </h2>
        <span className="section-toggle-caret" aria-hidden="true">
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open && (
        <div className="past-events-body">
          {events.length === 0 ? (
            <p className="empty-state">No past events yet.</p>
          ) : (
            <>
              <input
                type="search"
                className="search-input past-events-search"
                placeholder="Search past events by name, place or semester"
                aria-label="Search past events"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {searching && (
                <p className="past-events-count">
                  {matchCount === 0
                    ? `No past events match "${search.trim()}".`
                    : `${matchCount} ${matchCount === 1 ? 'event matches' : 'events match'}`}
                </p>
              )}
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
              {!searching && groups.length > VISIBLE_GROUPS && (
                <button type="button" className="link-button" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? 'Show fewer' : `Show older events (${groups.length - VISIBLE_GROUPS} more semesters)`}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
