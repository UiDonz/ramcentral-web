import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collectionGroup, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { listenToClubs } from '../services/clubs';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import ClubCard from '../components/ClubCard';
import CampusDirectory from '../components/CampusDirectory';
import ClubCalendarPanel from '../components/ClubCalendarPanel';
import InboxPanel from '../components/paperwork/InboxPanel';
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
 // Until the first answer arrives, counts show "…" instead of a wrong number
 // (the 62 school clubs without the app-made ones).
 const [clubsLoaded, setClubsLoaded] = useState(false);
 const [mineLoaded, setMineLoaded] = useState(false);
 useEffect(() => {
 const unsub = listenToClubs((list) => {
   setClubs(list);
   setClubsLoaded(true);
 });
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
      setMineLoaded(true);
    });
    return unsub;
  }, [currentUser]);
 // Clubs you asked to join that an officer hasn't approved yet (members docs
 // with status 'pending'). Live, so a request drops off once it's approved.
 const [requestedIds, setRequestedIds] = useState(new Set());
 useEffect(() => {
   if (!currentUser) return undefined;
   const q = query(
     collectionGroup(db, 'members'),
     where('uid', '==', currentUser.uid),
     where('status', '==', 'pending')
   );
   const unsub = onSnapshot(
     q,
     (snap) => setRequestedIds(new Set(snap.docs.map((d) => d.ref.parent.parent.id))),
     () => setRequestedIds(new Set())
   );
   return unsub;
 }, [currentUser]);
 const requestedClubs = useMemo(
   () => clubs.filter((c) => requestedIds.has(c.id)).sort((a, b) => a.name.localeCompare(b.name)),
   [clubs, requestedIds]
 );
 // Same count the directory shows: the school's list plus app-only clubs.
 const allCount = useMemo(() => {
   const onList = new Set(FARMINGDALE_CLUBS.map((c) => normalizeClubName(c.name)));
   return FARMINGDALE_CLUBS.length + clubs.filter((c) => !onList.has(normalizeClubName(c.name))).length;
 }, [clubs]);
 // Clubs you started that Staff haven't approved yet. They aren't in `clubs` (active only), but you're their
 // approved president, so their ids are in myClubIds - look those up one by one.
 const [pendingMine, setPendingMine] = useState([]);
 useEffect(() => {
   const activeIds = new Set(clubs.map((c) => c.id));
   const ids = [...myClubIds].filter((id) => !activeIds.has(id));
   if (ids.length === 0) {
     setPendingMine([]);
     return undefined;
   }
   let cancelled = false;
   Promise.all(ids.map((id) => getDoc(doc(db, 'clubs', id)).catch(() => null))).then((snaps) => {
     if (cancelled) return;
     setPendingMine(
       snaps
         .filter((snap) => snap && snap.exists() && snap.data().status === 'pending')
         .map((snap) => ({ id: snap.id, ...snap.data() }))
         .sort((a, b) => a.name.localeCompare(b.name))
     );
   });
   return () => {
     cancelled = true;
   };
 }, [clubs, myClubIds]);
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
 // Shown right under Your clubs: clubs you started that Staff haven't approved
 // yet, and clubs you asked to join that an officer hasn't approved yet.
 const pendingSection = pendingMine.length + requestedClubs.length > 0 && (
   <section key="pendingMine">
     <h2>Waiting for approval</h2>
     <div className="club-grid">
       {pendingMine.map((c) => (
         <Link key={c.id} to={`/clubs/${c.id}`} className="club-card pending-club-card">
           <div className="club-card-header">
             <h3>{c.name}</h3>
             <span className="tag-chip">Pending</span>
           </div>
           <p className="club-card-category">{c.category || 'General'}</p>
           <p className="pw-sub">Staff will review it soon. Open it to finish your paperwork.</p>
         </Link>
       ))}
       {requestedClubs.map((c) => (
         <Link key={c.id} to={`/clubs/${c.id}`} className="club-card pending-club-card">
           <div className="club-card-header">
             <h3>{c.name}</h3>
             <span className="tag-chip">Request sent</span>
           </div>
           <p className="club-card-category">{c.category || 'General'}</p>
           <p className="pw-sub">An officer will review your request. Open the club to cancel it.</p>
         </Link>
       ))}
     </div>
   </section>
 );
 const sections = {
 myClubs: myClubs.length > 0 && (
 <section key="myClubs">
 <h2>Your clubs</h2>
 <div className="club-grid">
 {myClubs.map((c) => <ClubCard key={c.id} club={c} direct />)}
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
       {/* Invitations and advisor requests waiting on this person (renders
     nothing when there are none). */}
       <InboxPanel />
       <div className="tab-bar" role="tablist" aria-label="Club lists">
         <button

           type="button"
 role="tab"
 aria-selected={tab === 'mine'}
 className={`tab-btn${tab === 'mine' ? ' selected' : ''}`}
 onClick={() => setTab('mine')}
 >
 Your clubs <span className="tab-count">{clubsLoaded && mineLoaded ? myClubs.length : '…'}</span>
 </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'all'}
          className={`tab-btn${tab === 'all' ? ' selected' : ''}`}
          onClick={() => setTab('all')}
        >
          All Farmingdale clubs <span className="tab-count">{clubsLoaded ? allCount : '…'}</span>
        </button>
      </div>

      {tab === 'all' && <CampusDirectory liveClubs={clubs} myClubIds={myClubIds} majors={profile?.majors || []} />}
 {tab === 'mine' && (
 <>
 {clubsLoaded && mineLoaded && myClubs.length === 0 && (
 <p className="empty-state">
 You haven't joined any clubs yet.{' '}
 <button type="button" className="link-button" onClick={() => setTab('all')}>
 Browse all Farmingdale clubs
 </button>
 </p>
 )}
 {settings.homeLayout.flatMap((key) =>
   key === 'myClubs' ? [sections.myClubs || null, pendingSection || null] : [sections[key] || null]
 )}
 {!settings.homeLayout.includes('myClubs') && pendingSection}
 <section>
 <h2>Club calendar</h2>
 <ClubCalendarPanel clubs={clubs} myClubIds={myClubIds} />
 </section>
 </>
 )}
 </div>
  );
}