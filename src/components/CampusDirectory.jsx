import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FARMINGDALE_CLUBS, DIRECTORY_CATEGORIES, normalizeClubName } from '../data/farmingdaleClubs';
import { majorBreakdown } from '../services/recommendations';

// The "All Farmingdale clubs" tab on the Clubs page: every club on campus,
// with search + category + status filters. `liveClubs` is the active clubs
// from Firestore; a directory entry whose name matches one of them is shown
// as "On RamConnect" with a link to its page, and every other entry gets
// a link that opens Create Club with the name and category pre-filled.

// One row of pill-shaped choices (only one can be picked), used inside the Filters dropdown.
function ChipGroup({ label, value, onChange, options }) {
  return (
    <div className="chip-group">
      <span className="chip-group-label">{label}</span>
      <div className="chip-row" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            className={`chip${value === v ? ' selected' : ''}`}
            onClick={() => onChange(v)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

// myClubIds: Set of club ids the signed-in user is in. majors: the user's major ids (for the "my major" filter).
export default function CampusDirectory({ liveClubs, myClubIds = new Set(), majors = [] }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [size, setSize] = useState('all'); // all | small | medium | large
  const [sort, setSort] = useState('name'); // name | most | fewest
  const [joinType, setJoinType] = useState('all'); // all | open | approval
  const [membership, setMembership] = useState('all'); // all | in | notin
  const [myMajorOnly, setMyMajorOnly] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the Filters dropdown on an outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const liveByName = useMemo(() => {
    const map = new Map();
    liveClubs.forEach((c) => map.set(normalizeClubName(c.name), c));
    return map;
  }, [liveClubs]);

  // The school's list, plus every active club made in the app that is NOT on
  // that list (so student-made clubs show up here too).
  const entries = useMemo(() => {
    const onList = new Set(FARMINGDALE_CLUBS.map((c) => normalizeClubName(c.name)));
    const fromList = FARMINGDALE_CLUBS.map((c) => ({
      ...c,
      live: liveByName.get(normalizeClubName(c.name)) || null
    }));
    const appOnly = liveClubs
      .filter((c) => !onList.has(normalizeClubName(c.name)))
      .map((c) => ({
        name: c.name,
        abbr: '',
        stars: '',
        category: c.category || 'Other',
        live: c
      }));
    return [...fromList, ...appOnly].sort((a, b) => a.name.localeCompare(b.name));
  }, [liveByName, liveClubs]);

  const categories = useMemo(
    () => [...new Set([...DIRECTORY_CATEGORIES, ...entries.map((e) => e.category)])].sort(),
    [entries]
  );

  const term = search.trim().toLowerCase();
  const filtersActive =
    term !== '' ||
    category !== 'all' ||
    size !== 'all' ||
    sort !== 'name' ||
    joinType !== 'all' ||
    membership !== 'all' ||
    myMajorOnly;

  // How many options inside the Filters dropdown are changed (shown on the button).
  const activeCount = [category !== 'all', size !== 'all', sort !== 'name', joinType !== 'all', membership !== 'all', myMajorOnly].filter(Boolean).length;

  // Clubs that aren't on RamConnect yet have no members or join rules, so any of these filters hides them.
  const count = (c) => (c.live ? c.live.memberCount || 0 : 0);
  const sizeOk = (c) =>
    size === 'all' ||
    (Boolean(c.live) &&
      (size === 'small' ? count(c) < 20 : size === 'medium' ? count(c) >= 20 && count(c) < 40 : count(c) >= 40));

  const shown = entries.filter(
    (c) =>
      (term === '' ||
        c.name.toLowerCase().includes(term) ||
        c.abbr.toLowerCase().includes(term) ||
        (c.live?.tags || []).some((tg) => tg.includes(term))) &&
      (category === 'all' || c.category === category) &&
      sizeOk(c) &&
      (joinType === 'all' ||
        (Boolean(c.live) && (joinType === 'approval') === Boolean(c.live.requiresApproval))) &&
      (membership === 'all' ||
        (Boolean(c.live) && (membership === 'in') === myClubIds.has(c.live.id))) &&
      (!myMajorOnly || (Boolean(c.live) && majorBreakdown(c.live, 50).some((m) => majors.includes(m.id))))
  );

  const sorted =
    sort === 'name'
      ? shown
      : [...shown].sort((a, b) => (sort === 'most' ? count(b) - count(a) : count(a) - count(b)) || a.name.localeCompare(b.name));

  function clearFilters() {
    setSearch('');
    setCategory('all');
    setSize('all');
    setSort('name');
    setJoinType('all');
    setMembership('all');
    setMyMajorOnly(false);
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

        <div className="filter-menu" ref={menuRef}>
          <button
            type="button"
            className="filter-menu-btn"
            aria-expanded={menuOpen}
            aria-haspopup="true"
            onClick={() => setMenuOpen((o) => !o)}
          >
            Filters
            {activeCount > 0 && <span className="filter-menu-badge">{activeCount}</span>}
            <span aria-hidden="true">&#9662;</span>
          </button>

          {menuOpen && (
            <div className="filter-panel">
              <div className="filter-panel-head">
                <strong>Filter clubs</strong>
                {activeCount > 0 && (
                  <button type="button" className="link-button" onClick={clearFilters}>
                    Reset all
                  </button>
                )}
              </div>

              <ChipGroup
                label="Size"
                value={size}
                onChange={setSize}
                options={[
                  ['all', 'Any size'],
                  ['small', 'Small (under 20)'],
                  ['medium', 'Medium (20-39)'],
                  ['large', 'Large (40+)']
                ]}
              />

              <ChipGroup
                label="How to join"
                value={joinType}
                onChange={setJoinType}
                options={[
                  ['all', 'Any'],
                  ['open', 'Anyone can join'],
                  ['approval', 'Needs approval']
                ]}
              />

              <ChipGroup
                label="Membership"
                value={membership}
                onChange={setMembership}
                options={[
                  ['all', 'All clubs'],
                  ['in', "Clubs I'm in"],
                  ['notin', "Clubs I'm not in"]
                ]}
              />

              <ChipGroup
                label="Sort by"
                value={sort}
                onChange={setSort}
                options={[
                  ['name', 'Name A-Z'],
                  ['most', 'Most members'],
                  ['fewest', 'Fewest members']
                ]}
              />

              <ChipGroup
                label="Category"
                value={category}
                onChange={setCategory}
                options={[['all', 'All'], ...categories.map((c) => [c, c])]}
              />

              {majors.length > 0 && (
                <div className="chip-group">
                  <span className="chip-group-label">For you</span>
                  <div className="chip-row">
                    <button
                      type="button"
                      aria-pressed={myMajorOnly}
                      className={`chip${myMajorOnly ? ' selected' : ''}`}
                      onClick={() => setMyMajorOnly((v) => !v)}
                    >
                      Has members in my major
                    </button>
                  </div>
                </div>
              )}

              <div className="filter-panel-foot">
                <button type="button" onClick={() => setMenuOpen(false)}>
                  Show {shown.length} {shown.length === 1 ? 'club' : 'clubs'}
                </button>
              </div>
            </div>
          )}
        </div>

        <span className="filter-count">
          {filtersActive
            ? `${shown.length} of ${entries.length} clubs`
            : `${entries.length} clubs`}
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
        {sorted.map((c) => (
          <article key={c.live?.id || c.name} className="dir-card">
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
                {c.live ? 'On RamConnect' : 'Not on RamConnect yet'}
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
                <Link to={`/clubs/${c.live.id}`}>Open club page &rarr;</Link>
              ) : (
                <Link to={`/create-club?name=${encodeURIComponent(c.name)}&category=${encodeURIComponent(c.category)}`}>
                  Add to RamConnect &rarr;
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>

      <p className="dir-legend">
        Asterisks (*) after a name are copied from the school's list. Clubs not on RamConnect yet can be
        added by anyone; a new club goes to Staff for approval first.
      </p>
    </div>
  );
}