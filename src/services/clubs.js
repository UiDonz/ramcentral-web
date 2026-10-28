// Firestore access layer for clubs, memberships, and announcements.
// Kept separate from components so the data model can change without
// touching the UI. See /firestore.rules for the matching security rules.
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
  onSnapshot
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

// New clubs start 'pending' instead of going live immediately - Staff
// reviews and approves them from the Command Center's Action Queue
// (see approveClubApplication/denyClubApplication below) before they
// show up in the public directory (listenToClubs only ever returns
// status == 'active'). The creator can still see and manage their own
// pending club at its normal /clubs/:id URL while it waits.
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

// Joins immediately if the club doesn't require approval, otherwise
// creates a pending membership an officer must approve.
export async function joinClub(clubId, uid, requiresApproval) {
  await setDoc(doc(db, 'clubs', clubId, 'members', uid), {
    uid,
    role: 'member',
    status: requiresApproval ? 'pending' : 'approved',
    joinedAt: serverTimestamp()
  });
  if (!requiresApproval) {
    await updateDoc(doc(db, 'clubs', clubId), { memberCount: increment(1) });
  }
}

export async function approveMembership(clubId, uid) {
  await updateDoc(doc(db, 'clubs', clubId, 'members', uid), { status: 'approved' });
  await updateDoc(doc(db, 'clubs', clubId), { memberCount: increment(1) });
}

export async function leaveClub(clubId, uid, wasApproved) {
  await deleteDoc(doc(db, 'clubs', clubId, 'members', uid));
  if (wasApproved) {
    await updateDoc(doc(db, 'clubs', clubId), { memberCount: increment(-1) });
  }
}

// Unchanged since Sprint 1/2 - kept for backward compatibility with any
// existing caller. New code should use changeMemberRole() below, which
// adds the RBAC check (only a President/Co-President can call it) that
// this original version never had.
export async function promoteToOfficer(clubId, uid, title = 'officer') {
  await updateDoc(doc(db, 'clubs', clubId, 'members', uid), { role: title });
}

// Promote, demote, or reassign a club member's role. actingMembership
// is the caller's own membership doc (from getMembership/myMembership
// in ClubDetail) - canAssignRole checks it's a President or
// Co-President assigning a role at or below their own rank before this
// ever reaches Firestore. firestore.rules still has the final say (a
// non-officer's write is rejected there regardless of what the client
// sends); this is the fast, friendly check in front of it.
export async function changeMemberRole(clubId, targetUid, newRole, actingMembership) {
  assertPermission(
    canAssignRole(actingMembership, newRole),
    `403 Forbidden: only a club President or Co-President can assign the ${
      CLUB_ROLE_LABELS[newRole] || newRole
    } role.`
  );

  await updateDoc(doc(db, 'clubs', clubId, 'members', targetUid), { role: newRole });

  // A club only ever has one President. canAssignRole already guarantees
  // only a sitting President (not a Co-President - see rankOf/canAssignRole
  // in rbac.js) can ever hand out the Presidency itself, so if that's
  // what just happened, the outgoing President steps down to Vice
  // President rather than the club ending up with two members both
  // marked 'president'. This is the actual leadership transfer: the
  // outgoing President's president-level permissions (role management,
  // archiving, etc.) are gone the moment this second write lands, and
  // only the newly-promoted member has them from here on.
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

// "Officer Certification" - a Staff-granted badge marking a student
// leader as verified, shown next to their name/role in the member
// list. Independent of the role itself (a brand-new President isn't
// automatically certified) - only Staff can grant or revoke it, either
// from a club's own page or the Command Center.
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
// Archiving is a soft delete: the club doc is never removed, so its
// members, announcements, events, and messages all stay intact and
// viewable by Staff - it's just hidden from the public directory
// (listenToClubs only returns status == 'active').

// Audit-log entries read much better with the club's actual name than
// its raw Firestore doc ID ("Engineering" vs "foG2WmtcqUMZTEgisnva") -
// this one extra read is cheap next to the update it's paired with, and
// falls back to the ID itself if the club doc is somehow already gone.
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

// A denied application is filed as 'archived' rather than deleted, so
// there's still a record of it (and Staff can flip it back to pending/
// active later if it was denied by mistake) instead of losing the
// application entirely.
export async function denyClubApplication(clubId, actor) {
  assertPermission(isStaff(actor), '403 Forbidden: only Staff can deny a club application.');
  const clubName = await getClubNameForAudit(clubId);
  await updateDoc(doc(db, 'clubs', clubId), { status: 'archived' });
  await logAudit({ actor, action: 'deny_club', target: clubName, targetType: 'club' });
}

// listenToClubs (above) only shows status == 'active' for the public
// directory. Staff's Master Directory needs every club regardless of
// status, so this is a second, separate listener rather than adding an
// optional "include all statuses" param that every other caller of
// listenToClubs would need to remember to not pass.
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