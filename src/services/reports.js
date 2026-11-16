// Club chat message reports. Chat messages themselves are immutable
// (firestore.rules: update/delete false), so a report stores a SNAPSHOT of
// the message - its text and author - inside the report doc. Staff then see
// exactly what was reported even if the chat history is later pruned.
//
// Reports live in one top-level collection, messageReports, so the Staff
// dashboard can read every open report with a single query:
//   - any approved member of the club can CREATE a report about it
//   - only Staff can read, review, or dismiss them (see firestore.rules)
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { assertPermission, isStaff } from './rbac';
import { logAudit } from './admin';

export const REPORT_REASONS = [
  'Harassment or bullying',
  'Hate speech',
  'Spam',
  'Inappropriate content',
  'Other'
];

// The doc id is clubId + messageId + reporterUid, so one person reporting
// the same message twice hits the same doc. A second setDoc on an existing
// report counts as an UPDATE, which the rules only allow for Staff - so it
// is rejected, and we turn that rejection into a friendly message.
export async function reportMessage({ clubId, clubName, message, reporter, reason }) {
  const reportId = `${clubId}_${message.id}_${reporter.uid}`;
  try {
    await setDoc(doc(db, 'messageReports', reportId), {
      clubId,
      clubName: clubName || '',
      messageId: message.id,
      messageText: (message.text || '').slice(0, 1000),
      messageAuthorId: message.authorId,
      messageAuthorName: message.authorName || 'Member',
      reporterUid: reporter.uid,
      reporterName: reporter.name || 'Member',
      reason,
      status: 'open',
      createdAt: serverTimestamp()
    });
  } catch (err) {
    if (err.code === 'permission-denied') {
      throw new Error('You have already reported this message.');
    }
    throw err;
  }
}

export function listenToOpenReports(callback, onError) {
  const q = query(
    collection(db, 'messageReports'),
    where('status', '==', 'open'),
    orderBy('createdAt', 'desc'),
    limit(100)
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('[reports] listenToOpenReports failed:', err);
      if (onError) onError(err);
    }
  );
}

// resolution: 'reviewed' (Staff looked at it and handled it) or
// 'dismissed' (nothing wrong). Either way it leaves the open queue and an
// audit entry is written, same as every other Staff action.
export async function resolveReport(reportId, resolution, actor, report) {
  assertPermission(isStaff(actor), '403 Forbidden: only Staff can review message reports.');
  await updateDoc(doc(db, 'messageReports', reportId), {
    status: resolution,
    reviewedBy: actor.uid,
    reviewedAt: serverTimestamp()
  });
  await logAudit({
    actor,
    action: `report_${resolution}`,
    target: report?.clubName || reportId,
    targetType: 'message report',
    details: report ? `${report.reason} - message by ${report.messageAuthorName}` : ''
  });
}