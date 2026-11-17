// Firestore access layer for a club's official paperwork: the New Club
// Proposal (executive board, roster, constitution, advisor), officer
// trainings, roster invitations, and trip requests with their Expense
// Authorization Form. Everything here is ADDITIVE - it adds new collections
// and never changes how existing clubs, members or approvals behave. See
// firestore.rules for the matching security rules (the real boundary; the
// assertPermission calls below are just the friendly first check).
//
// Data model:
// clubs/{clubId}/paperwork/application officers, roster, advisor, constitution info
// clubs/{clubId}/paperwork/constitution the attached file (base64 data URL)
// clubs/{clubId}/trainings/{uid} which trainings an officer finished
// advisorRequests/{clubId} one pending/answered advisor request per club
// rosterInvites/{clubId__email} "you were listed as a founding member"
// tripRequests/{id} a trip + its Expense Authorization Form
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { assertPermission, isStaff, canViewClubFinances, CLUB_ROLE_LABELS } from './rbac';
import { logAudit } from './admin';
import { approveClubApplication, denyClubApplication, joinClubFromInvite } from './clubs';
import { compressImageForBackground } from './background';
import { CORE_OFFICERS, MIN_ROSTER, FILE_LIMIT_BYTES, isValidEmail } from '../data/clubRequirements';
const MAX_DATA_URL_LENGTH = 900000;
// ---------- cleaning + validation (pure, used by the forms too) ----------
const clean = (v) => (v || '').trim();
const lower = (v) => clean(v).toLowerCase();
// officers: { pres: {name,email,ram}, vp: {...}, tre: {...}, sec: {...} }
export function normalizeOfficers(officers) {
  const out = {};
  CORE_OFFICERS.forEach(({ key }) => {
    const o = (officers && officers[key]) || {};
    out[key] = { name: clean(o.name), email: lower(o.email), ram: clean(o.ram) };
  });
  return out;
}
export function validateOfficers(officers) {
  const o = normalizeOfficers(officers);
  const problems = [];
  CORE_OFFICERS.forEach(({ key, label }) => {
    if (!o[key].name) problems.push(`${label}: add a name`);
    if (!isValidEmail(o[key].email)) problems.push(`${label}: add a valid FSC email`);

    if (!o[key].ram) problems.push(`${label}: add a RAM ID`);
  });
  const emails = CORE_OFFICERS.map(({ key }) => o[key].email).filter(Boolean);
  if (new Set(emails).size !== emails.length) problems.push('Each officer needs a different email');
  return problems;
}
export function normalizeRoster(roster) {
  return (roster || [])
    .map((r) => ({ name: clean(r.name), email: lower(r.email), ram: clean(r.ram) }))
    .filter((r) => r.name || r.email || r.ram);
}

export function validateRoster(roster) {
  const rows = normalizeRoster(roster);
  const problems = [];
  const complete = rows.filter((r) => r.name && r.ram && isValidEmail(r.email));
  if (rows.length !== complete.length) problems.push('Finish or clear the rows marked in red');
  if (complete.length < MIN_ROSTER) {
    problems.push(
      `${MIN_ROSTER - complete.length} more student${MIN_ROSTER - complete.length === 1 ? '' : 's'} needed`
    );
  }
  const emails = complete.map((r) => r.email);
  const rams = complete.map((r) => r.ram);
  if (new Set(emails).size !== emails.length) problems.push('Two students share an email');
  if (new Set(rams).size !== rams.length) problems.push('Two students share a RAM ID');
  return problems;
}
// ---------- attaching a file (PDF or photo) ----------
function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}
// Photos are shrunk first (same helper the background photos use); PDFs are
// stored as they are, so they must be small.
export async function fileToStoredDoc(file) {
  if (!file) throw new Error('Choose a file first.');
  const isImage = (file.type || '').startsWith('image/');
  const isPdf = file.type === 'application/pdf';
  if (!isImage && !isPdf) throw new Error('Attach a PDF or a photo (JPG or PNG).');
  let dataUrl;
  if (isImage) {
    dataUrl = await compressImageForBackground(file);
  } else {
    if (file.size > FILE_LIMIT_BYTES) {
      throw new Error(
        'That PDF is too large (the limit is about 650 KB). Compress it, or attach a photo of the pages.'
      );
    }
    dataUrl = await readAsDataUrl(file);
  }
  if (dataUrl.length > MAX_DATA_URL_LENGTH)
    throw new Error('That file is too large to store. Try a smaller one.');
  return {
    fileName: file.name,
    mimeType: isImage ? 'image/jpeg' : 'application/pdf',
    size: file.size,
    dataUrl
  };
}
// Opens a stored data URL in a new tab (data: URLs can't be navigated to
// directly in most browsers, so it goes through a Blob).
export function openStoredFile(stored) {
  if (!stored?.dataUrl) return;
  const [head, b64] = stored.dataUrl.split(',');
  const mime = (head.match(/data:(.*?);/) || [])[1] || stored.mimeType || 'application/octet-stream';
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) arr[i] = bytes.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([arr], { type: mime }));
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
// ---------- the application (officers, roster, constitution, advisor) ----------
const appRef = (clubId) => doc(db, 'clubs', clubId, 'paperwork', 'application');

const conRef = (clubId) => doc(db, 'clubs', clubId, 'paperwork', 'constitution');
export function listenToApplication(clubId, callback, onError) {
  return onSnapshot(
    appRef(clubId),
    (snap) => callback(snap.exists() ? snap.data() : null),
    (err) => {
      if (onError) onError(err);
    }
  );
}
export async function getConstitution(clubId) {
  const snap = await getDoc(conRef(clubId));
  return snap.exists() ? snap.data() : null;
}
export async function saveOfficers(clubId, officers, actor) {
  const problems = validateOfficers(officers);
  if (problems.length) throw new Error(problems[0]);
  await setDoc(
    appRef(clubId),
    {
      officers: normalizeOfficers(officers),
      updatedAt: serverTimestamp(),
      updatedBy: actor?.uid || null
    },
    { merge: true }
  );
}
export async function saveRoster(clubId, roster, actor) {
  const problems = validateRoster(roster);

  if (problems.length) throw new Error(problems[0]);
  await setDoc(
    appRef(clubId),
    {
      roster: normalizeRoster(roster),
      updatedAt: serverTimestamp(),
      updatedBy: actor?.uid || null
    },
    { merge: true }
  );
}
// The file goes in its own doc; the application doc only keeps its name and
// size, so the page never downloads the whole file just to show a row.
export async function saveConstitution(clubId, stored, actor) {
  await setDoc(conRef(clubId), {
    ...stored,
    uploadedAt: serverTimestamp(),
    uploadedBy: actor?.uid || null
  });
  await setDoc(
    appRef(clubId),
    {
      constitution: { fileName: stored.fileName, size: stored.size, mimeType: stored.mimeType },
      updatedAt: serverTimestamp(),
      updatedBy: actor?.uid || null
    },
    { merge: true }
  );
}
// Called once from the Create Club page, right after the club doc exists.
export async function submitApplication(
  clubId,
  clubName,
  actor,
  { officers, roster, constitution, advisor }
) {
  const problems = [...validateOfficers(officers), ...validateRoster(roster)];
  if (problems.length) throw new Error(problems[0]);
  if (!constitution) throw new Error('Attach your constitution first.');
  await saveConstitution(clubId, constitution, actor);
  await setDoc(
    appRef(clubId),
    {
      officers: normalizeOfficers(officers),
      roster: normalizeRoster(roster),
      advisor: advisor ? { uid: advisor.uid, name: advisor.name, email: advisor.email } : null,
      submittedAt: serverTimestamp(),
      submittedBy: actor?.uid || null,
      submittedByEmail: lower(actor?.email),

      updatedAt: serverTimestamp(),
      updatedBy: actor?.uid || null
    },
    { merge: true }
  );
  if (advisor) await requestAdvisor(clubId, clubName, advisor, actor);
}
// ---------- advisors ----------
// Faculty and staff accounts are the people a club can ask. (Per the team's
// existing rule, faculty accounts ARE staff - see services/rbac.js.)
export function listenToFaculty(callback) {
  const q = query(collection(db, 'users'), where('role', '==', 'faculty'));
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs
        .map((d) => ({ uid: d.id, name: d.data().name || 'Faculty member', email: d.data().email || '' }))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
  });
}
// One request per club (doc id = clubId). Asking someone new replaces the old one.
export async function requestAdvisor(clubId, clubName, advisor, actor) {
  const ref = doc(db, 'advisorRequests', clubId);
  // Clear any earlier request first (a no-op, and a harmless rejected
  // delete, when there isn't one).
  await deleteDoc(ref).catch(() => {});
  await setDoc(ref, {
    clubId,
    clubName,
    advisorUid: advisor.uid,
    advisorName: advisor.name,
    advisorEmail: advisor.email || '',
    requestedBy: actor.uid,
    requestedByName: actor.name || '',
    status: 'pending',
    createdAt: serverTimestamp()
  });
  // Keep a copy of who was chosen on the application too.
  await setDoc(
    appRef(clubId),
    {
      advisor: { uid: advisor.uid, name: advisor.name, email: advisor.email || '' }
    },
    { merge: true }
  ).catch(() => {});
}
export async function cancelAdvisorRequest(clubId) {
  await deleteDoc(doc(db, 'advisorRequests', clubId)).catch(() => {});
  await setDoc(appRef(clubId), { advisor: null }, { merge: true }).catch(() => {});
}
export function listenToClubAdvisorRequest(clubId, callback, onError) {
  const q = query(collection(db, 'advisorRequests'), where('clubId', '==', clubId));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.length ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null),
    (err) => {
      if (onError) onError(err);
    }
  );
}
export function listenToMyAdvisorRequests(uid, callback) {
  const q = query(
    collection(db, 'advisorRequests'),
    where('advisorUid', '==', uid),
    where('status', '==', 'pending')
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => callback([])
  );
}
export async function respondToAdvisorRequest(requestId, accept) {
  await updateDoc(doc(db, 'advisorRequests', requestId), {
    status: accept ? 'accepted' : 'declined',
    decidedAt: serverTimestamp()
  });
}
// ---------- roster invitations ----------

const inviteId = (clubId, email) => `${clubId}__${email}`;
// Staff approving a club turns its paperwork into invitations: the three
// other Core 4 officers (with their roles) and every roster student (as
// members). Nobody is added without agreeing - they see an invitation and
// choose Join or Decline. The person who submitted is already President.
async function createRosterInvites(clubId, clubName, application) {
  if (!application) return 0;
  const creator = lower(application.submittedByEmail);
  const invites = new Map();
  CORE_OFFICERS.forEach(({ key, role }) => {
    const o = application.officers?.[key];
    if (o && isValidEmail(o.email) && lower(o.email) !== creator) {
      invites.set(lower(o.email), { name: o.name, ramId: o.ram, role });
    }
  });
  (application.roster || []).forEach((r) => {
    const email = lower(r.email);
    if (isValidEmail(email) && email !== creator && !invites.has(email)) {
      invites.set(email, { name: r.name, ramId: r.ram, role: 'member' });
    }
  });
  const batch = writeBatch(db);
  invites.forEach((v, email) => {
    batch.set(doc(db, 'rosterInvites', inviteId(clubId, email)), {
      clubId,
      clubName,
      email,
      name: v.name,
      ramId: v.ramId,
      role: v.role,
      status: 'invited',
      createdAt: serverTimestamp()
    });
  });
  await batch.commit();
  return invites.size;
}
export function listenToMyInvites(email, callback) {
  const q = query(
    collection(db, 'rosterInvites'),
    where('email', '==', lower(email)),
    where('status', '==', 'invited')
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => callback([])
  );
}
export function listenToClubInvites(clubId, callback) {
  const q = query(collection(db, 'rosterInvites'), where('clubId', '==', clubId));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => callback([])
  );
}
export async function respondToInvite(invite, accept, uid, majors = []) {
  if (accept) {
    await joinClubFromInvite(invite.clubId, uid, invite.role || 'member', majors);
    await updateDoc(doc(db, 'rosterInvites', invite.id), {
      status: 'joined',
      uid,
      respondedAt: serverTimestamp()
    });
  } else {
    await updateDoc(doc(db, 'rosterInvites', invite.id), {
      status: 'declined',
      uid,
      respondedAt: serverTimestamp()
    });
  }
}
// ---------- Staff: approve / deny with the paperwork attached ----------
// Same approval as before (services/clubs.js), plus the invitations. If the
// invitations fail for any reason the club is STILL approved - the invites
// are a convenience, never a reason to block an approval.
export async function approveApplication(clubId, actor) {
  assertPermission(isStaff(actor), '403 Forbidden: only Staff can approve a club.');

  await approveClubApplication(clubId, actor);
  let invited = 0;
  try {
    const [appSnap, clubSnap] = await Promise.all([
      getDoc(appRef(clubId)),
      getDoc(doc(db, 'clubs', clubId))
    ]);
    invited = await createRosterInvites(
      clubId,
      clubSnap.exists() ? clubSnap.data().name : '',
      appSnap.exists() ? appSnap.data() : null
    );
    if (invited) {
      await logAudit({
        actor,
        action: 'send_roster_invites',
        target: clubSnap.data().name || clubId,
        targetType: 'club',
        details: `${invited} invitations`
      });
    }
  } catch (err) {
    console.error('[paperwork] club approved but invitations failed', err);
  }
  return invited;
}
export async function denyApplication(clubId, actor, reason) {
  assertPermission(isStaff(actor), '403 Forbidden: only Staff can deny a club application.');

  await denyClubApplication(clubId, actor);
  await updateDoc(doc(db, 'clubs', clubId), {
    denialReason: clean(reason),
    deniedAt: serverTimestamp()
  }).catch(() => {});
}
// ---------- officer trainings ----------
export function listenToTrainings(clubId, callback) {
  return onSnapshot(
    collection(db, 'clubs', clubId, 'trainings'),
    (snap) => {
      const byUid = {};
      snap.docs.forEach((d) => {
        byUid[d.id] = d.data();
      });
      callback(byUid);
    },
    () => callback({})
  );
}
// An officer marks ONE of their own trainings done (or undoes it).
export async function setTrainingDone(clubId, uid, key, done) {
  await setDoc(
    doc(db, 'clubs', clubId, 'trainings', uid),
    { uid, done: { [key]: done ? serverTimestamp() : deleteField() } },
    { merge: true }
  );
}
// Staff confirm (or undo confirming) a training against Farmingdale's records.
export async function setTrainingVerified(clubId, uid, key, verified, actor) {
  assertPermission(isStaff(actor), '403 Forbidden: only Staff can verify a training.');
  await setDoc(
    doc(db, 'clubs', clubId, 'trainings', uid),
    {
      uid,
      verified: {
        [key]: verified ? { by: actor.uid, name: actor.name || '', at: serverTimestamp() } : deleteField()
      }
    },
    { merge: true }
  );
  await logAudit({
    actor,
    action: verified ? 'verify_training' : 'unverify_training',
    target: `${clubId}/${uid}`,
    targetType: 'member',
    details: key
  });
} // Only the President, Co-President or Treasurer can file one: it includes an
// ---------- trips ----------

// Expense Authorization Form, which Farmingdale lets only a President or
// Treasurer prepare. (Same people as canViewClubFinances in rbac.js.)
export async function requestTrip({ clubId, clubName, trip, eaf, actor, actingMembership }) {
  assertPermission(
    canViewClubFinances(actingMembership?.role),
    '403 Forbidden: only a club President or Treasurer can request a trip.'
  );
  const ref = await addDoc(collection(db, 'tripRequests'), {
    clubId,
    clubName,
    requestedBy: actor.uid,
    requestedByName: actor.name || '',
    status: 'pending',
    trip,
    eaf: { ...eaf, preparedBy: CLUB_ROLE_LABELS[actingMembership.role] || actingMembership.role },
    createdAt: serverTimestamp()
  });
  return ref.id;
}
export function listenToClubTrips(clubId, callback) {
  const q = query(collection(db, 'tripRequests'), where('clubId', '==', clubId));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      callback(items);
    },
    () => callback([])
  );
}
export function listenToPendingTrips(callback) {
  const q = query(collection(db, 'tripRequests'), where('status', '==', 'pending'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => callback([])
  );
}
// Staff add the liability waiver to the event in RamCentral themselves, so
// approval is blocked until they confirm they did.
export async function decideTrip(tripId, approve, { waiverAdded, reason }, actor) {
  assertPermission(isStaff(actor), '403 Forbidden: only Staff can decide a trip request.');
  if (approve) assertPermission(waiverAdded, 'Add the liability waiver to the event in RamCentral first.');
  await updateDoc(doc(db, 'tripRequests', tripId), {
    status: approve ? 'approved' : 'denied',
    waiverAdded: !!waiverAdded,
    denialReason: approve ? '' : clean(reason),

    decidedAt: serverTimestamp(),
    decidedBy: actor.uid
  });
  await logAudit({
    actor,
    action: approve ? 'approve_trip' : 'deny_trip',
    target: tripId,
    targetType: 'trip'
  });
}
