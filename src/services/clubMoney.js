// Club spending requests: the Farmingdale money flow.
//
//    requested -> (Staff approve) approved -> bought -> receipts sent
//      -> (Staff check) processing -> (Staff pay) paid
//    plus: denied, and receipts "returned" with a reason to fix and resend.
//
// Same two-layer RBAC as the rest of the app: firestore.rules is the real
// boundary, assertPermission gives a friendly message first.
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  getDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { assertPermission, isStaff, canRequestSpending } from './rbac';
import { logAudit } from './admin';
import { fileToStoredDoc } from './clubPaperwork';
import { DEFAULT_ALLOCATION, categoryOf } from '../data/moneyRules';

const spendCol = () => collection(db, 'spendRequests');

const byNewest = (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);

// What a club has committed: everything not denied counts against its yearly
// allocation, so the "left" number never lies about money already promised.
export function committedAmount(list, exceptId) {
  return list
    .filter((r) => r.status !== 'denied' && r.id !== exceptId)
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
}

export const allocationOf = (club) =>
  club?.allocation != null ? Number(club.allocation) : DEFAULT_ALLOCATION;

// Something the CLUB has to do next (drives the "Waiting for you" list and
// the red badge on the Finances tab).
export function clubActionNeeded(r) {
  return (
    (r.status === 'approved' && r.payMethod === 'reimburse') ||
    r.status === 'purchased' ||
    r.status === 'returned'
  );
}

export async function fileSpendRequest({ club, clubId, form, actor, actingMembership }) {
  assertPermission(
    canRequestSpending(actingMembership?.role),
    '403 Forbidden: only a club President or Treasurer can request spending.'
  );
  const amount = Math.abs(Number(form.amount) || 0);
  if (!form.item?.trim()) throw new Error('Say what you want to buy.');
  if (!amount) throw new Error('Enter the amount.');
  if (!form.category) throw new Error('Pick a category.');
  if (!form.ruleOk) throw new Error('Please confirm the purchase follows the spending rules.');
  if (form.payMethod === 'check' && !form.vendorDocsOk) {
    throw new Error(
      'Please confirm the vendor will send the required paperwork (W-9, invoice and insurance).'
    );
  }
  await addDoc(spendCol(), {
    clubId,
    clubName: club.name,
    item: form.item.trim(),
    category: form.category,
    amount,
    vendor: form.vendor?.trim() || '',
    payMethod: form.payMethod || 'card',
    vendorDocsOk: form.payMethod === 'check' ? !!form.vendorDocsOk : false,
    neededBy: form.neededBy || '',
    eventType: form.eventType || '',
    note: form.note?.trim() || '',
    status: 'requested',
    requestedBy: actor.uid,
    requestedByName: actor.name || '',
    createdAt: serverTimestamp()
  });
  await logAudit({
    actor,
    action: 'file_spend_request',
    target: `${club.name} - ${form.item.trim()} ($${amount})`,
    targetType: 'spendRequest'
  });
}

export function listenToClubSpend(clubId, callback) {
  const q = query(spendCol(), where('clubId', '==', clubId));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byNewest)),
    () => callback([])
  );
}

// Staff only (firestore.rules): every club's requests.
export function listenToAllSpend(callback, onError) {
  return onSnapshot(
    spendCol(),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byNewest)),
    onError
  );
}

async function getRequest(id) {
  const snap = await getDoc(doc(db, 'spendRequests', id));
  if (!snap.exists()) throw new Error('That request no longer exists.');
  return { id, ...snap.data() };
}

const label = (r) => `${r.clubName} - ${r.item} ($${r.amount})`;

export async function decideSpend(id, approve, { reason } = {}, actor) {
  assertPermission(isStaff(actor), '403 Forbidden: only Staff can decide a spending request.');
  if (!approve && !reason?.trim()) throw new Error('Give a short reason so the club knows why.');
  const r = await getRequest(id);
  await updateDoc(doc(db, 'spendRequests', id), {
    status: approve ? 'approved' : 'denied',
    decidedBy: actor.name || '',
    decidedAt: serverTimestamp(),
    denyReason: approve ? '' : reason.trim()
  });
  await logAudit({
    actor,
    action: approve ? 'approve_spend_request' : 'deny_spend_request',
    target: label(r),
    targetType: 'spendRequest',
    details: approve ? '' : reason.trim()
  });
}

// Card / check orders: Staff place the order, then mark it ordered.
export async function markOrdered(id, actor) {
  assertPermission(isStaff(actor), '403 Forbidden: only Staff can mark an order placed.');
  const r = await getRequest(id);
  await updateDoc(doc(db, 'spendRequests', id), { status: 'purchased', orderedBy: actor.name || '' });
  await logAudit({ actor, action: 'mark_spend_ordered', target: label(r), targetType: 'spendRequest' });
}

// Reimbursement: a member buys it, and the club says who. The buyer can't be
// the same person who filed the form (Farmingdale rule).
export async function markBought(id, boughtBy, actor, actingMembership) {
  assertPermission(
    canRequestSpending(actingMembership?.role),
    '403 Forbidden: only a club President or Treasurer can do that.'
  );
  const r = await getRequest(id);
  const who = boughtBy?.trim();
  if (!who) throw new Error('Type the name of the member who bought it.');
  if (who.toLowerCase() === (r.requestedByName || '').trim().toLowerCase()) {
    throw new Error("The person who bought it can't be the person who filed the form. Ask another member.");
  }
  await updateDoc(doc(db, 'spendRequests', id), {
    status: 'purchased',
    boughtBy: who,
    boughtAt: serverTimestamp()
  });
  await logAudit({
    actor,
    action: 'mark_spend_bought',
    target: label(r),
    targetType: 'spendRequest',
    details: `Bought by ${who}`
  });
}

// Receipts are stored one doc each under the request (same compress-or-cap
// helper the paperwork files use), then the request moves to "receipts".
export async function submitReceipts(id, files, actor, actingMembership) {
  assertPermission(
    canRequestSpending(actingMembership?.role),
    '403 Forbidden: only a club President or Treasurer can send receipts.'
  );
  if (!files?.length) throw new Error('Choose at least one receipt (photo or PDF).');
  const r = await getRequest(id);
  const stored = [];
  for (const f of files) stored.push(await fileToStoredDoc(f));
  const col = collection(db, 'spendRequests', id, 'receipts');
  for (const s of stored) {
    await addDoc(col, { ...s, uploadedBy: actor.uid, createdAt: serverTimestamp() });
  }
  await updateDoc(doc(db, 'spendRequests', id), {
    status: 'receipts',
    receiptCount: (r.receiptCount || 0) + stored.length,
    returnReason: '',
    receiptsAt: serverTimestamp()
  });
  await logAudit({ actor, action: 'send_spend_receipts', target: label(r), targetType: 'spendRequest' });
}

export function listenToReceipts(id, callback) {
  return onSnapshot(
    collection(db, 'spendRequests', id, 'receipts'),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => callback([])
  );
}

// Accept -> payment gets prepared. Send back -> the club sees the reason and
// uploads again.
export async function decideReceipts(id, accept, { reason } = {}, actor) {
  assertPermission(isStaff(actor), '403 Forbidden: only Staff can check receipts.');
  if (!accept && !reason?.trim()) throw new Error('Say what is wrong so the club can fix it.');
  const r = await getRequest(id);
  await updateDoc(doc(db, 'spendRequests', id), {
    status: accept ? 'processing' : 'returned',
    returnReason: accept ? '' : reason.trim()
  });
  await logAudit({
    actor,
    action: accept ? 'accept_spend_receipts' : 'return_spend_receipts',
    target: label(r),
    targetType: 'spendRequest',
    details: accept ? '' : reason.trim()
  });
}

export async function markPaid(id, actor) {
  assertPermission(isStaff(actor), '403 Forbidden: only Staff can mark a payment sent.');
  const r = await getRequest(id);
  await updateDoc(doc(db, 'spendRequests', id), {
    status: 'paid',
    paidAt: serverTimestamp(),
    paidBy: actor.name || ''
  });
  await logAudit({ actor, action: 'mark_spend_paid', target: label(r), targetType: 'spendRequest' });
}

export async function setClubAllocation(clubId, clubName, amount, actor) {
  assertPermission(isStaff(actor), "403 Forbidden: only Staff can set a club's yearly amount.");
  const n = Math.max(0, Number(amount) || 0);
  await updateDoc(doc(db, 'clubs', clubId), { allocation: n });
  await logAudit({
    actor,
    action: 'set_club_allocation',
    target: `${clubName} ($${n})`,
    targetType: 'club'
  });
}

export { categoryOf };
