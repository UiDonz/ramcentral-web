import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FARMINGDALE_CLUBS, DIRECTORY_CATEGORIES, normalizeClubName } from '../data/farmingdaleClubs';

// The "All Farmingdale clubs" tab on the Clubs page: every club on campus,
// with search + category + status filters. `liveClubs` is the active clubs
// from Firestore; a directory entry whose name matches one of them is shown
// as "On NewRamCentral" with a link to its page, and every other entry gets
// a link that opens Create Club with the name and category pre-filled.

export default function CampusDirectory({ liveClubs }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');

  const liveByName = useMemo(() => {
    const map = new Map();
    liveClubs.forEach((c) => map.set(normalizeClubName(c.name), c));
    return map;
  }, [liveClubs]);

  const entries = useMemo(
    () =>
      FARMINGDALE_CLUBS.map((c) => ({
        ...c,
        live: liveByName.get(normalizeClubName(c.name)) || null
      })),
    [liveByName]
  );

  const term = search.trim().toLowerCase();
  const filtersActive = term !== '' || category !== 'all' || status !== 'all';

  const shown = entries.filter(
    (c) =>
      (term === '' ||
        c.name.toLowerCase().includes(term) ||
        c.abbr.toLowerCase().includes(term) ||
        (c.live?.tags || []).some((tg) => tg.includes(term))) &&
      (category === 'all' || c.category === category) &&
      (status === 'all' || (status === 'on') === Boolean(c.live))
  );

  function clearFilters() {
    setSearch('');
    setCategory('all');
    setStatus('all');
  }

  return (
    <div>
      <div className="filter-bar">
        <label>
          Search
          <input
            className="search-input"
            placeholder="Name, abbreviation or tag, e.g. SGA"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <label>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            {DIRECTORY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All clubs</option>
            <option value="on">On NewRamCentral</option>
            <option value="off">Not on NewRamCentral yet</option>
          </select>
        </label>

        <span className="filter-count">
          {filtersActive
            ? `${shown.length} of ${entries.length} clubs`
            : `${entries.length} clubs at Farmingdale`}
        </span>

        {filtersActive && (
          <button type="button" className="link-button" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {shown.length === 0 && (
        <p className="empty-state">No clubs match. Try clearing a filter.</p>
      )}

      <div className="club-grid">
        {shown.map((c) => (
          <article key={c.name} className="dir-card">
            <div className="dir-card-top">
              <h3>
                {c.name}
                {c.stars && <sup>{c.stars}</sup>}
              </h3>

              {c.abbr && <span className="dir-abbr">{c.abbr}</span>}
            </div>

            <div className="dir-card-top">
              <span className="dir-category">{c.category}</span>

              <span className={`dir-pill ${c.live ? 'on' : 'off'}`}>
                {c.live ? 'On NewRamCentral' : 'Not on NewRamCentral yet'}
              </span>
            </div>

            {c.live && (
              <p className="dir-detail">{c.live.memberCount || 0} members</p>
            )}

            {(c.live?.tags || []).length > 0 && (
              <div className="tag-list">
                {c.live.tags.map((t) => (
                  <span key={t} className="tag-chip">
                    #{t}
                  </span>
                ))}
              </div>
            )}

            <div className="dir-actions">
              {c.live ? (
              ) : (
                <Link
                  <Link to={`/clubs/${c.live.id}`}>Open club page &rarr;</Link>
                  to={`/create-club?name=${encodeURIComponent(c.name)}&category=${encodeURIComponent(c.category)}`}
                >
                  Add to NewRamCentral &rarr;
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>

      <p className="dir-legend">
        Asterisks (*) after a name are copied from the school's list. Clubs not on NewRamCentral yet can be
        added by anyone; a new club goes to Staff for approval first.
      </p>
    </div>
  );
}