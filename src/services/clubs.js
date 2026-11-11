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

// Joins immediately, or creates a pending membership if the club requires approval.
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