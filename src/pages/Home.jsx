import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collectionGroup, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { listenToClubs } from '../services/clubs';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import ClubCard from '../components/ClubCard';
import CampusDirectory from '../components/CampusDirectory';
import ClubCalendarPanel from '../components/ClubCalendarPanel';
import { FARMINGDALE_CLUBS } from '../data/farmingdaleClubs';
import { recommendClubs } from '../services/recommendations';
// Second import from the same file (kept apart so the line above stays exactly as the Sprint 7 plan expects it).
import { normalizeClubName } from '../data/farmingdaleClubs';
export default function Home() {
 const { currentUser, profile } = useAuth();
 const { settings } = useSettings();
 const [clubs, setClubs] = useState([]);
 const [myClubIds, setMyClubIds] = useState(new Set());
 // 'mine' = the clubs you're in + recommendations, 'all' = the full
 // Farmingdale club list (CampusDirectory.jsx, which has the search and
 // filters).
 const [tab, setTab] = useState('mine');
 // Faculty/staff don't answer the major/interest questions (see the
 // onboarding gate in App.jsx), so recommendations are a student-only
 // feature - they never see that section or the prompt for it.
 const isStudent = profile?.role === 'student';
 useEffect(() => {
 const unsub = listenToClubs(setClubs);
return unsub;
 }, [currentUser]);
  useEffect(() => {
    if (!currentUser) return;
    // Every club the signed-in user is an approved member of.
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
 // Same count the directory shows: the school's list plus app-only clubs.
 const allCount = useMemo(() => {
   const onList = new Set(FARMINGDALE_CLUBS.map((c) => normalizeClubName(c.name)));
   return FARMINGDALE_CLUBS.length + clubs.filter((c) => !onList.has(normalizeClubName(c.name))).length;
 }, [clubs]);
 const myClubs = useMemo(
 () => clubs.filter((c) => myClubIds.has(c.id)).sort((a, b) => a.name.localeCompare(b.name)),
 [clubs, myClubIds]
 );
// "Recommended for you" - clubs whose members share the student's major
 // (and, more lightly, their interests); see services/recommendations.js.
 const recommendations = useMemo(
 () => (isStudent
 ? recommendClubs({
 clubs,
 majors: profile?.majors || [],
 interests: profile?.interests || [],
 joinedIds: myClubIds
 })
 : []),
 [clubs, profile, myClubIds, isStudent]
 );
 const hasAnswers = (profile?.majors?.length || 0) + (profile?.interests?.length || 0) > 0;
 // Sections keyed the same way as settings.homeLayout (Settings > Home
 // layout), so a saved order still works: 'myClubs' is the clubs you're
 // in, and 'browseClubs' - the key this section had before the directory
 // moved to its own tab - is now the recommendations.
 const sections = {
 myClubs: myClubs.length > 0 && (
 <section key="myClubs">
 <h2>Your clubs</h2>
 <div className="club-grid">
 {myClubs.map((c) => <ClubCard key={c.id} club={c} />)}
 </div>
 </section>
 ),
 browseClubs: isStudent && (
 <section key="browseClubs">
 <h2>Recommended for you</h2>
 {recommendations.length > 0 ? (
 <div className="club-grid">
 {recommendations.map((r) => (
 <ClubCard key={r.club.id} club={r.club} reason={r.reason} detail={r.detail} />
 ))}
 </div>
 ) : hasAnswers ? (
 <p className="empty-state">
 No recommendations yet. They show up as more students in your major join clubs.
 </p>
 ) : (
 <p className="recommend-prompt">
 Want club suggestions? <Link to="/profile">Add your major and interests</Link> and we'll
 recommend clubs students like you join.
 </p>
 )}
 </section>
 )
 };

  return (
    <div className="page">
 <div className="page-header">
 <h1>Clubs</h1>
 </div>
 <div className="tab-bar" role="tablist" aria-label="Club lists">
 <button
 type="button"
 role="tab"
 aria-selected={tab === 'mine'}
 className={`tab-btn${tab === 'mine' ? ' selected' : ''}`}
 onClick={() => setTab('mine')}
 >
 Your clubs <span className="tab-count">{myClubs.length}</span>
 </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'all'}
          className={`tab-btn${tab === 'all' ? ' selected' : ''}`}
          onClick={() => setTab('all')}
        >
          All Farmingdale clubs <span className="tab-count">{allCount}</span>
        </button>
      </div>

      {tab === 'all' && <CampusDirectory liveClubs={clubs} myClubIds={myClubIds} majors={profile?.majors || []} />}
 {tab === 'mine' && (
 <>
 {myClubs.length === 0 && (
 <p className="empty-state">
 You haven't joined any clubs yet.{' '}
 <button type="button" className="link-button" onClick={() => setTab('all')}>
 Browse all Farmingdale clubs
 </button>
 </p>
 )}
 {settings.homeLayout.map((key) => sections[key] || null)}
 <section>
 <h2>Club calendar</h2>
 <ClubCalendarPanel clubs={clubs} myClubIds={myClubIds} />
 </section>
 </>
 )}
 </div>
  );
}