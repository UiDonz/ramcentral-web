// Staff sign-up approval. Picking "Staff" on Sign up does NOT make an account
// Staff: it is created as a regular account (role 'student') with
// staffRequest: 'pending', plus a staffRequests/{uid} doc. An existing admin
// approves (role becomes 'faculty' = Staff) or denies (the account stays a
// Student account) in Command Center > Approvals. firestore.rules make sure
// nobody can give themselves the Staff role.
import { collection, doc, query, where, onSnapshot, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { assertPermission, isStaff } from './rbac';
import { logAudit } from './admin';

export function listenToPendingStaffRequests(callback, onError) {
  const q = query(collection(db, 'staffRequests'), where('status', '==', 'pending'));
  return onSnapshot(
    q,
    (snap) =>
      callback(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0))
      ),
    (err) => {
      if (onError) onError(err);
    }
  );
}

export async function decideStaffRequest(request, approve, actor) {
  assertPermission(isStaff(actor), '403 Forbidden: only an admin can approve Staff access.');
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', request.uid), {
    role: approve ? 'faculty' : 'student',
    staffRequest: approve ? 'approved' : 'denied'
  });
  batch.update(doc(db, 'staffRequests', request.uid), {
    status: approve ? 'approved' : 'denied',
    decidedBy: actor.uid,
    decidedByName: actor.name || '',
    decidedAt: serverTimestamp()
  });
  await batch.commit();
  await logAudit({
    actor,
    action: approve ? 'approve_staff' : 'deny_staff',
    target: `${request.name || 'Account'} (${request.email || request.uid})`,
    targetType: 'user'
  });
}
