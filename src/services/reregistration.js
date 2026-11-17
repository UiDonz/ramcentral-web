// Club re-registration in RamConnect: once a semester, during OSA's window,
// a club renews itself. The President starts it, each Core 4 officer accepts
// their position's Terms and Conditions, the President fills in the
// constitution / advisor / mission statement and submits, and Staff approve
// it (or send it back) in the Command Center's Approvals tab.
//
// Data model (see firestore.rules):
// reregistrations/{clubId}__{termId}          one per club per semester
// reregistrations/{clubId}__{termId}/files/constitution   a new constitution, if uploaded
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { assertPermission, isStaff } from './rbac';
import { logAudit } from './admin';
import { CORE_OFFICERS } from '../data/clubRequirements';

const col = () => collection(db, 'reregistrations');
export const reregId = (clubId, termId) => `${clubId}__${termId}`;
const fileRef = (id) => doc(db, 'reregistrations', id, 'files', 'constitution');

// The Core 4 as they are right now on the club's Members list.
export function currentCoreOfficers(members, memberNames = {}) {
  const out = {};
  CORE_OFFICERS.forEach(({ key, role }) => {
    const m = members.find((x) => x.status === 'approved' && x.role === role);
    out[key] = m ? { uid: m.uid, name: memberNames[m.uid] || m.name || 'Officer' } : null;
  });
  return out;
}
export const missingOfficerRoles = (officers) =>
  CORE_OFFICERS.filter(({ key }) => !officers?.[key]).map(({ label }) => label);
export const allAccepted = (rr) => CORE_OFFICERS.every(({ key }) => rr?.accepted?.[key]);

export function listenToClubRereg(clubId, termId, callback) {
  return onSnapshot(
    doc(db, 'reregistrations', reregId(clubId, termId)),
    (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    () => callback(null)
  );
}

// Starts this semester's re-registration (or refreshes the officer list on an
// existing draft, keeping acceptances from officers who are still in place).
export async function startRereg({ club, clubId, term, members, memberNames, actor }) {
  const id = reregId(clubId, term.id);
  const ref = doc(db, 'reregistrations', id);
  const officers = currentCoreOfficers(members, memberNames);
  const officerUids = Object.values(officers)
    .filter(Boolean)
    .map((o) => o.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      clubId,
      clubName: club.name,
      term: term.id,
      termLabel: term.termLabel,
      status: 'draft',
      officers,
      officerUids,
      accepted: {},
      constitutionChoice: 'keep',
      advisorChanged: false,
      newAdvisor: { name: '', email: '' },
      mission: club.mission || club.description || '',
      startedBy: actor.uid,
      startedByName: actor.name || '',
      createdAt: serverTimestamp()
    });
    await logAudit({ actor, action: 'start_rereg', target: `${club.name} (${term.termLabel})`, targetType: 'club' });
    return;
  }
  const old = snap.data();
  const accepted = {};
  CORE_OFFICERS.forEach(({ key }) => {
    if (old.accepted?.[key] && officers[key] && old.accepted[key].uid === officers[key].uid) {
      accepted[key] = old.accepted[key];
    }
  });
  await updateDoc(ref, { officers, officerUids, accepted });
}

// One Core 4 officer accepts their own position's terms.
export async function acceptTerms(rr, key, actor) {
  const officer = rr.officers?.[key];
  assertPermission(officer && officer.uid === actor.uid, 'Only that officer can accept these terms.');
  await updateDoc(doc(db, 'reregistrations', rr.id), {
    [`accepted.${key}`]: { uid: actor.uid, name: actor.name || officer.name, at: serverTimestamp() }
  });
}

export async function saveReregDetails(id, { constitutionChoice, advisorChanged, newAdvisor, mission }) {
  await updateDoc(doc(db, 'reregistrations', id), {
    constitutionChoice,
    advisorChanged: !!advisorChanged,
    newAdvisor: {
      name: (newAdvisor?.name || '').trim(),
      email: (newAdvisor?.email || '').trim().toLowerCase()
    },
    mission: (mission || '').trim()
  });
}

// stored: the result of fileToStoredDoc (services/clubPaperwork.js).
export async function saveReregConstitution(id, stored) {
  await setDoc(fileRef(id), { ...stored, uploadedAt: serverTimestamp() });
  await updateDoc(doc(db, 'reregistrations', id), {
    constitutionChoice: 'new',
    constitutionFile: { fileName: stored.fileName, size: stored.size }
  });
}
export async function getReregConstitution(id) {
  const snap = await getDoc(fileRef(id));
  return snap.exists() ? snap.data() : null;
}

// Problems that block submitting (empty list = ready).
export function reregProblems(rr, { hasConstitutionOnFile }) {
  const out = [];
  const missing = missingOfficerRoles(rr.officers);
  if (missing.length) out.push(`Assign a ${missing.join(', ')} on the Members tab, then refresh the officer list.`);
  else if (!allAccepted(rr)) out.push('All four officers need to accept their terms.');
  if (rr.constitutionChoice === 'keep' && !hasConstitutionOnFile)
    out.push('There is no constitution on file. Upload one.');
  if (rr.constitutionChoice === 'new' && !rr.constitutionFile) out.push('Upload the new constitution.');
  if (rr.advisorChanged && !(rr.newAdvisor?.name && rr.newAdvisor?.email))
    out.push("Add the new advisor's name and email.");
  if (!(rr.mission || '').trim()) out.push('Write a mission statement.');
  return out;
}

export async function submitRereg(rr, actor, ctx) {
  const problems = reregProblems(rr, ctx);
  if (problems.length) throw new Error(problems[0]);
  await updateDoc(doc(db, 'reregistrations', rr.id), {
    status: 'submitted',
    submittedBy: actor.uid,
    submittedByName: actor.name || '',
    submittedAt: serverTimestamp()
  });
  await logAudit({ actor, action: 'submit_rereg', target: `${rr.clubName} (${rr.termLabel})`, targetType: 'club' });
}

// Things a signed-in officer still has to do: accept their own terms.
export function listenToMyReregTasks(uid, callback) {
  const q = query(col(), where('officerUids', 'array-contains', uid));
  return onSnapshot(
    q,
    (snap) =>
      callback(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((rr) => rr.status === 'draft' || rr.status === 'returned')
          .map((rr) => {
            const entry = CORE_OFFICERS.find(({ key }) => rr.officers?.[key]?.uid === uid);
            return entry && !rr.accepted?.[entry.key] ? { ...rr, myKey: entry.key, myLabel: entry.label } : null;
          })
          .filter(Boolean)
      ),
    () => callback([])
  );
}

// ---------- Staff ----------
// Only the ones waiting on Staff, for the Approvals tab (much smaller than the full list).
export function listenToSubmittedRereg(callback, onError) {
  return onSnapshot(
    query(col(), where('status', '==', 'submitted')),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      if (onError) onError(err);
    }
  );
}

export function listenToAllRereg(callback, onError) {
  return onSnapshot(
    col(),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      if (onError) onError(err);
    }
  );
}

export async function decideRereg(rr, approve, { reason } = {}, actor) {
  assertPermission(isStaff(actor), '403 Forbidden: only Staff can approve a re-registration.');
  if (!approve && !(reason || '').trim()) throw new Error('Say what the club needs to fix.');
  await updateDoc(doc(db, 'reregistrations', rr.id), {
    status: approve ? 'approved' : 'returned',
    returnReason: approve ? '' : reason.trim(),
    decidedBy: actor.uid,
    decidedByName: actor.name || '',
    decidedAt: serverTimestamp()
  });
  if (approve) {
    // The club is renewed for this term; keep its mission statement current.
    await updateDoc(doc(db, 'clubs', rr.clubId), {
      lastReregTerm: rr.term,
      mission: rr.mission || ''
    }).catch(() => {});
    // A new constitution replaces the one on file.
    if (rr.constitutionChoice === 'new') {
      const stored = await getReregConstitution(rr.id);
      if (stored) {
        await setDoc(doc(db, 'clubs', rr.clubId, 'paperwork', 'constitution'), stored).catch(() => {});
        await setDoc(
          doc(db, 'clubs', rr.clubId, 'paperwork', 'application'),
          { constitution: { fileName: stored.fileName, size: stored.size, mimeType: stored.mimeType } },
          { merge: true }
        ).catch(() => {});
      }
    }
  }
  await logAudit({
    actor,
    action: approve ? 'approve_rereg' : 'return_rereg',
    target: `${rr.clubName} (${rr.termLabel})`,
    targetType: 'club',
    details: approve ? '' : reason.trim()
  });
}
