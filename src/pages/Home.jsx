import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collectionGroup, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { listenToClubs } from '../services/clubs';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import ClubCard from '../components/ClubCard';
import CampusDirectory from '../components/CampusDirectory';
import { FARMINGDALE_CLUBS } from '../data/farmingdaleClubs';

import {
  recommendClubs,
  majorBreakdown,
  MIN_SAMPLE_SIZE,
  MIN_SHARE,
} from '../services/recommendations';
import { MAJORS } from '../data/profileOptions';


export default function Home() {
  const { currentUser, profile } = useAuth();
  const { settings } = useSettings();
  const [clubs, setClubs] = useState([]);
  const [myClubIds, setMyClubIds] = useState(new Set());
  const [search, setSearch] = useState('');

  const [category, setCategory] = useState('all');
const [majorFilter, setMajorFilter] = useState('all');
const [sort, setSort] = useState('members');
  // 'active' = clubs on NewRamCentral (everything below), 'all' = the full
  // Farmingdale club list (CampusDirectory.jsx).
  const [tab, setTab] = useState('active');

  useEffect(() => {
    const unsub = listenToClubs(setClubs);
    return unsub;
  }, []);

  const categories = useMemo(
  () =>
    [...new Set(clubs.map((c) => (c.category || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b)),
  [clubs]
);

const term = search.trim().toLowerCase();

const filtersActive =
  term !== '' ||
  category !== 'all' ||
  majorFilter !== 'all';

function matchesMajor(club) {
  if (majorFilter === 'all') return true;

  if ((club.majorSampleSize || 0) < MIN_SAMPLE_SIZE) {
    return false;
  }

  return majorBreakdown(club, 20).some(
    (m) => m.id === majorFilter && m.share >= MIN_SHARE
  );
}

const filtered = clubs
  .filter(
    (c) =>
      term === '' ||
      c.name.toLowerCase().includes(term) ||
      c.category?.toLowerCase().includes(term) ||
      c.description?.toLowerCase().includes(term) ||
      (c.tags || []).some((tg) => tg.includes(term))
  )
  .filter(
    (c) =>
      category === 'all' ||
      (c.category || '').trim() === category
  )
  .filter(matchesMajor)
  .sort((a, b) =>
    sort === 'name'
      ? a.name.localeCompare(b.name)
      : (b.memberCount || 0) - (a.memberCount || 0)
  );

function clearFilters() {
  setSearch('');
  setCategory('all');
  setMajorFilter('all');
}

  useEffect(() => {
    if (!currentUser) return;
    // Collection group query across every club's "members" subcollection, so "my clubs" can be badged without denormalizing.
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

  
  // "Recommended for you" - clubs whose members share the signed-in
  // student's major (see services/recommendations.js). Computed from the
  // full club list rather than `filtered`, so typing in the search box
  // doesn't make the recommendations jump around.
  const recommendations = useMemo(
     () => recommendClubs({
       clubs,
       majors: profile?.majors || [],
       interests: profile?.interests || [],
       joinedIds: myClubIds
     }),
     [clubs, profile, myClubIds]
  );
  const hasAnswers = (profile?.majors?.length || 0) + (profile?.interests?.length || 0) > 0;

  const myClubs = filtered.filter((c) => myClubIds.has(c.id));
  const otherClubs = filtered.filter((c) => !myClubIds.has(c.id));

  // Sections keyed like settings.homeLayout, so a saved order is just "map this array, look up each key here."
  const sections = {
    myClubs: myClubs.length > 0 && (
      <section key="myClubs">
        <h2>My clubs</h2>
        <div className="club-grid">
          {myClubs.map((c) => <ClubCard key={c.id} club={c} />)}
        </div>
      </section>
    ),
    browseClubs: (
      <section key="browseClubs">
        <h2>{myClubs.length > 0 ? 'Browse more clubs' : 'Browse clubs'}</h2>
        {otherClubs.length === 0 && <p
          className="empty-state">No clubs match yet. Try a different search or clear the filters.</p>}
        <div className="club-grid">
          {otherClubs.map((c) => <ClubCard key={c.id} club={c} />)}
        </div>
      </section>
    )
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Clubs</h1>
        {tab === 'active' && (
          <input
            className="search-input"
            placeholder="Search clubs by name, category, tag, or description"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}
      </div>

      <div className="tab-bar" role="tablist" aria-label="Club lists">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'active'}
          className={`tab-btn${tab === 'active' ? ' selected' : ''}`}
          onClick={() => setTab('active')}
        >
          On NewRamCentral <span className="tab-count">{clubs.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'all'}
          className={`tab-btn${tab === 'all' ? ' selected' : ''}`}
          onClick={() => setTab('all')}
        >
          All Farmingdale clubs <span className="tab-count">{FARMINGDALE_CLUBS.length}</span>
        </button>
      </div>

      {tab === 'all' && <CampusDirectory liveClubs={clubs} />}

      {tab === 'active' && (
        <>

      <div className="filter-bar">
        <label>Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>Popular with
          <select value={majorFilter} onChange={(e) => setMajorFilter(e.target.value)}>
            <option value="all">Any major</option>
            {MAJORS.map((m) => <option key={m.id} value={m.id}>{m.short}</option>)}
          </select>
        </label>
        <label>Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="members">Most members</option>
            <option value="name">Name (A-Z)</option>
          </select>
        </label>
        <span className="filter-count">
          {filtersActive ? `${filtered.length} of ${clubs.length} clubs` : `${clubs.length} clubs`}
        </span>
        {filtersActive && (
          <button type="button" className="link-button" onClick={clearFilters}>Clear filters</button>
        )}
      </div>

       {/* Fixed position above the user-orderable sections below (it isn't
           part of settings.homeLayout, so nobody's saved layout can hide
           or lose it). Hidden while any search or filter is active to keep results focused. */}
       {!filtersActive && recommendations.length > 0 && (
         <section>
           <h2>Recommended for you</h2>
           <div className="club-grid">
             {recommendations.map((r) => (
               <ClubCard key={r.club.id} club={r.club} reason={r.reason} detail={r.detail} />
             ))}
           </div>
         </section>
       )}
       {!filtersActive && profile?.role === 'student' && !hasAnswers && (
         <p className="recommend-prompt">
           Want club suggestions? <Link to="/profile">Add your major and interests</Link> and we'll
           recommend clubs students like you join.
         </p>
       )}

       {settings.homeLayout.map((key) => sections[key] || null)}
        </>
      )}
    </div>
  );
}