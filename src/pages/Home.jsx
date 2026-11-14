import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collectionGroup, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { listenToClubs } from '../services/clubs';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import ClubCard from '../components/ClubCard';
import { recommendClubs } from '../services/recommendations';

export default function Home() {
  const { currentUser, profile } = useAuth();
  const { settings } = useSettings();
  const [clubs, setClubs] = useState([]);
  const [myClubIds, setMyClubIds] = useState(new Set());
  const [search, setSearch] = useState('');

  useEffect(() => {
    const unsub = listenToClubs(setClubs);
    return unsub;
  }, []);

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

  const filtered = clubs.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.category?.toLowerCase().includes(search.toLowerCase()) ||
    (c.tags || []).some((tg) => tg.includes(search.toLowerCase()))
  );

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
        {otherClubs.length === 0 && <p className="empty-state">No clubs match yet. Try a different search.</p>}
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
        <input
          className="search-input"
          placeholder="Search clubs by name, category or tag"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
       </div>

       {/* Fixed position above the user-orderable sections below (it isn't
           part of settings.homeLayout, so nobody's saved layout can hide
           or lose it). Hidden while searching to keep results focused. */}
       {search === '' && recommendations.length > 0 && (
         <section>
           <h2>Recommended for you</h2>
           <div className="club-grid">
             {recommendations.map((r) => (
               <ClubCard key={r.club.id} club={r.club} reason={r.reason} detail={r.detail} />
             ))}
           </div>
         </section>
       )}
       {search === '' && profile?.role === 'student' && !hasAnswers && (
         <p className="recommend-prompt">
           Want club suggestions? <Link to="/profile">Add your major and interests</Link> and we'll
           recommend clubs students like you join.
         </p>
       )}

       {settings.homeLayout.map((key) => sections[key] || null)}
     </div>
  );
}