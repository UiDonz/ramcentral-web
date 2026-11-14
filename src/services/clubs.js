// Firestore access layer for clubs, memberships and announcements (security rules are in /firestore.rules).
import {
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment,
  onSnapshot,
  collectionGroup
} from 'firebase/firestore';
import { db } from '../firebase';
import { assertPermission, canAssignRole, isStaff, CLUB_ROLE_LABELS } from './rbac';
import { logAudit } from './admin';

const clubsCol = collection(db, 'clubs');

export function listenToClubs(callback) {
  const q = query(clubsCol, where('status', '==', 'active'), orderBy('memberCount', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function getClub(clubId) {
  const snap = await getDoc(doc(db, 'clubs', clubId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// New clubs start 'pending' until Staff approves them in the Command Center; the creator can still manage their pending club.
export async function createClub({
  name,
  description,
  category,
  meetingTimes,
  contactInfo,
  requiresApproval,
  creatorUid
}) {
  const clubRef = await addDoc(clubsCol, {
    name,
    description,
    category: category || 'General',
    meetingTimes: meetingTimes || '',
    contactInfo: contactInfo || '',
    requiresApproval: !!requiresApproval,
    status: 'pending',
    memberCount: 1,
    chatEnabled: true,
    createdAt: serverTimestamp()
  });

  // Creator becomes the first officer (president) of the club.
  await setDoc(doc(db, 'clubs', clubRef.id, 'members', creatorUid), {
    uid: creatorUid,
    role: 'president',
    status: 'approved',
    joinedAt: serverTimestamp()
  });

  return clubRef.id;
}

export function listenToMembers(clubId, callback) {
  const membersCol = collection(db, 'clubs', clubId, 'members');
  return onSnapshot(membersCol, (snap) => {
    callback(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
  });
}

export async function getMembership(clubId, uid) {
  const snap = await getDoc(doc(db, 'clubs', clubId, 'members', uid));
  return snap.exists() ? snap.data() : null;
}

// Each club doc keeps two counters so its most common majors can be shown without reading every profile:
//     majorCounts:     { cpis: 13, csia: 4, ... } members who listed that major
//     majorSampleSize: approved members who listed at least one major
// A member with two majors counts once in each major but once in majorSampleSize, so a share is
// majorCounts[x] / majorSampleSize. Majors are the stable ids from data/profileOptions.js.
function majorCounterUpdates(majors, sign) {
   const list = Array.isArray(majors) ? majors : [];
   if (list.length === 0) return {};
   const updates = { majorSampleSize: increment(sign) };
   list.forEach((id) => {
     updates[`majorCounts.${id}`] = increment(sign);
   });
   return updates;
}

async function getUserMajors(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data().majors || [] : [];
}

// Joins immediately, or creates a pending membership if the club requires approval.
// majors = the joining user's own majors (ClubDetail passes profile.majors).
export async function joinClub(clubId, uid, requiresApproval, majors = []) {
  await setDoc(doc(db, 'clubs', clubId, 'members', uid), {
    uid,
    role: 'member',
    status: requiresApproval ? 'pending' : 'approved',
    joinedAt: serverTimestamp()
    });
    if (!requiresApproval) {
      await updateDoc(doc(db, 'clubs', clubId), {
        memberCount: increment(1),
        ...majorCounterUpdates(majors, 1)
      });
    }
}

export async function approveMembership(clubId, uid) {
  await updateDoc(doc(db, 'clubs', clubId, 'members', uid), { status: 'approved' });
  const majors = await getUserMajors(uid);
  await updateDoc(doc(db, 'clubs', clubId), {
    memberCount: increment(1),
    ...majorCounterUpdates(majors, 1)
  });
}

export async function leaveClub(clubId, uid, wasApproved) {
  // Read the majors BEFORE deleting, so the decrement matches what joining added.
  const majors = wasApproved ? await getUserMajors(uid) : [];
  await deleteDoc(doc(db, 'clubs', clubId, 'members', uid));
  if (wasApproved) {
    await updateDoc(doc(db, 'clubs', clubId), {
      memberCount: increment(-1),
      ...majorCounterUpdates(majors, -1)
    });
  }
}

// Called after a user edits their majors (Profile / Onboarding): applies the difference to every
// club they're an approved member of, so a club's stats follow the member.
export async function syncMajorStatsForUser(uid, oldMajors = [], newMajors = []) {
  const removed = oldMajors.filter((m) => !newMajors.includes(m));
  const added = newMajors.filter((m) => !oldMajors.includes(m));
  const sampleDelta = (newMajors.length > 0 ? 1 : 0) - (oldMajors.length > 0 ? 1 : 0);
  if (removed.length === 0 && added.length === 0 && sampleDelta === 0) return;

    const snap = await getDocs(
       query(collectionGroup(db, 'members'), where('uid', '==', uid), where('status', '==', 'approved'))
    );
    await Promise.all(
       snap.docs.map((d) => {
          const updates = {};
          removed.forEach((m) => { updates[`majorCounts.${m}`] = increment(-1); });
          added.forEach((m) => { updates[`majorCounts.${m}`] = increment(1); });
          if (sampleDelta !== 0) updates.majorSampleSize = increment(sampleDelta);
          return updateDoc(d.ref.parent.parent, updates);
       })
    );
}

// Staff-only backfill: rebuilds every club's majorCounts/majorSampleSize from its approved
// members' profiles. Run once after this feature ships, or whenever the counters drift.
export async function recomputeMajorStats(actor) {
  assertPermission(
     isStaff(actor),
     '403 Forbidden: only Staff can recompute club major stats.'
  );
  const clubsSnap = await getDocs(clubsCol);
  const majorCache = new Map();
  let clubsUpdated = 0;

    for (const clubDoc of clubsSnap.docs) {
      const membersSnap = await getDocs(
         query(collection(db, 'clubs', clubDoc.id, 'members'), where('status', '==', 'approved'))
      );
      const majorCounts = {};



        let majorSampleSize = 0;
        for (const m of membersSnap.docs) {
          const uid = m.data().uid;
          if (!majorCache.has(uid)) majorCache.set(uid, await getUserMajors(uid));
          const majors = majorCache.get(uid);
          if (majors.length === 0) continue;
          majorSampleSize += 1;
          majors.forEach((id) => { majorCounts[id] = (majorCounts[id] || 0) + 1; });
        }
        await updateDoc(clubDoc.ref, { majorCounts, majorSampleSize });
        clubsUpdated += 1;
    }

    await logAudit({
      actor,
      action: 'recompute_major_stats',
      target: `${clubsUpdated} clubs`,
      targetType: 'club'
    });
    return { clubsUpdated };
}

// Kept for backward compatibility; new code should use changeMemberRole(), which adds the RBAC check.
export async function promoteToOfficer(clubId, uid, title = 'officer') {
  await updateDoc(doc(db, 'clubs', clubId, 'members', uid), { role: title });
}

// Promotes, demotes or reassigns a member's role. canAssignRole checks the caller first; firestore.rules has the final say.
export async function changeMemberRole(clubId, targetUid, newRole, actingMembership) {
  assertPermission(
    canAssignRole(actingMembership, newRole),
    `403 Forbidden: only a club President or Co-President can assign the ${
      CLUB_ROLE_LABELS[newRole] || newRole
    } role.`
  );

  await updateDoc(doc(db, 'clubs', clubId, 'members', targetUid), { role: newRole });

  // A club has one President: when the Presidency is handed over, the outgoing President steps down to Vice President.
  if (
    newRole === 'president' &&
    actingMembership?.role === 'president' &&
    actingMembership?.uid &&
    actingMembership.uid !== targetUid
  ) {
    await updateDoc(doc(db, 'clubs', clubId, 'members', actingMembership.uid), {
      role: 'vice_president'
    });
  }
}

// "Officer Certification": a Staff-only badge shown next to an officer's name, independent of their role.
export async function certifyOfficer(clubId, uid, actor) {
  assertPermission(isStaff(actor), '403 Forbidden: only Staff can certify a student leader.');
  await updateDoc(doc(db, 'clubs', clubId, 'members', uid), {
    certified: true,
    certifiedAt: serverTimestamp()
  });
  await logAudit({ actor, action: 'certify_officer', target: uid, targetType: 'member' });
}

export async function revokeCertification(clubId, uid, actor) {
  assertPermission(isStaff(actor), '403 Forbidden: only Staff can revoke a certification.');
  await updateDoc(doc(db, 'clubs', clubId, 'members', uid), { certified: false });
  await logAudit({ actor, action: 'revoke_certification', target: uid, targetType: 'member' });
}

export async function updateClub(clubId, updates) {
  await updateDoc(doc(db, 'clubs', clubId), updates);
}

// --- Club lifecycle: archive / approve / deny ---
// Archiving is a soft delete: the club stays in Firestore but is hidden from the public directory.

// Uses the club's name in audit-log entries instead of its raw doc ID.
async function getClubNameForAudit(clubId) {
  const snap = await getDoc(doc(db, 'clubs', clubId));
  return snap.exists() ? snap.data().name || clubId : clubId;
}

export async function archiveClub(clubId, actor) {
  assertPermission(isStaff(actor), '403 Forbidden: only Staff can archive a club.');
  const clubName = await getClubNameForAudit(clubId);
  await updateDoc(doc(db, 'clubs', clubId), { status: 'archived' });
  await logAudit({ actor, action: 'archive_club', target: clubName, targetType: 'club' });
}

export async function unarchiveClub(clubId, actor) {
  assertPermission(isStaff(actor), '403 Forbidden: only Staff can restore a club.');
  const clubName = await getClubNameForAudit(clubId);
  await updateDoc(doc(db, 'clubs', clubId), { status: 'active' });
  await logAudit({ actor, action: 'unarchive_club', target: clubName, targetType: 'club' });
}

export async function approveClubApplication(clubId, actor) {
  assertPermission(isStaff(actor), '403 Forbidden: only Staff can approve a club.');
  const clubName = await getClubNameForAudit(clubId);
  await updateDoc(doc(db, 'clubs', clubId), { status: 'active' });
  await logAudit({ actor, action: 'approve_club', target: clubName, targetType: 'club' });
}

// A denied application is filed as 'archived' (not deleted) so Staff can restore it later.
export async function denyClubApplication(clubId, actor) {
  assertPermission(isStaff(actor), '403 Forbidden: only Staff can deny a club application.');
  const clubName = await getClubNameForAudit(clubId);
  await updateDoc(doc(db, 'clubs', clubId), { status: 'archived' });
  await logAudit({ actor, action: 'deny_club', target: clubName, targetType: 'club' });
}

// Staff's Master Directory needs every club regardless of status, so this is a separate listener from listenToClubs.
export function listenToAllClubsForStaff(callback) {
  return onSnapshot(clubsCol, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function listenToPendingClubs(callback) {
  const q = query(clubsCol, where('status', '==', 'pending'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function listenToAnnouncements(clubId, callback) {
  const q = query(
    collection(db, 'clubs', clubId, 'announcements'),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function postAnnouncement(clubId, authorId, title, body) {
  await addDoc(collection(db, 'clubs', clubId, 'announcements'), {
    title,
    body,
    authorId,
    createdAt: serverTimestamp()
  });
}

export async function getAllClubsOnce() {
  const snap = await getDocs(clubsCol);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}