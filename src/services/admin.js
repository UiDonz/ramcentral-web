
// Firestore access layer for the Staff Command Center
// Handles budget requests, room bookings, audit logs, and campus statistics.

import {
  collection,
  addDoc,
  doc,
  updateDoc,
  setDoc,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  getCountFromServer
} from 'firebase/firestore';

import { db } from '../firebase';

import {
  assertPermission,
  isStaff,
  canManageClubFinances,
  canManageLogistics
} from './rbac';

// --- AUDIT TRAIL ---

export async function logAudit({
  actor,
  action,
  target,
  targetType,
  details
}) {
  await addDoc(collection(db, 'auditLog'), {
    actorUid: actor?.uid || null,
    actorName: actor?.name || 'Unknown',
    action,
    target: target || null,
    targetType: targetType || null,
    details: details || '',
    timestamp: serverTimestamp()
  });
}

export function listenToAuditLog(callback, count = 50) {
  const q = query(
    collection(db, 'auditLog'),
    orderBy('timestamp', 'desc'),
    limit(count)
  );

  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }))
    );
  });
}

// --- BUDGET REQUESTS ---

export async function requestBudget({
  clubId,
  clubName,
  amount,
  reason,
  requestedBy,
  actingMembership
}) {
  assertPermission(
    canManageClubFinances(actingMembership?.role),
    '403 Forbidden: only a club Treasurer can request budget.'
  );

  await addDoc(collection(db, 'budgetRequests'), {
    clubId,
    clubName,
    amount: Number(amount) || 0,
    reason: reason || '',
    status: 'pending',
    requestedBy,
    createdAt: serverTimestamp()
  });
}

export function listenToPendingBudgetRequests(callback) {
  const q = query(
    collection(db, 'budgetRequests'),
    where('status', '==', 'pending')
  );

  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }))
    );
  });
}

export function listenToClubBudgetRequests(clubId, callback) {
  const q = query(
    collection(db, 'budgetRequests'),
    where('clubId', '==', clubId)
  );

  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));

    items.sort(
      (a, b) =>
        (b.createdAt?.seconds || 0) -
        (a.createdAt?.seconds || 0)
    );

    callback(items);
  });
}

export async function decideBudgetRequest(
  requestId,
  approve,
  actor
) {
  assertPermission(
    isStaff(actor),
    '403 Forbidden: only Staff can decide a budget request.'
  );

  const reqSnap = await getDoc(
    doc(db, 'budgetRequests', requestId)
  );

  const req = reqSnap.exists() ? reqSnap.data() : null;

  await updateDoc(
    doc(db, 'budgetRequests', requestId),
    {
      status: approve ? 'approved' : 'denied'
    }
  );

  if (approve && req) {
    await setDoc(
      doc(db, 'settings', 'budget'),
      {
        remaining: increment(-Math.abs(req.amount || 0))
      },
      {
        merge: true
      }
    );

    // Credit the requesting club's budget.
    if (req.clubId) {
      await updateDoc(
        doc(db, 'clubs', req.clubId),
        {
          budgetReceived: increment(
            Math.abs(req.amount || 0)
          )
        }
      );
    }
  }

  await logAudit({
    actor,
    action: approve
      ? 'approve_budget_request'
      : 'deny_budget_request',
    target: req
      ? `${req.clubName} ($${req.amount})`
      : requestId,
    targetType: 'budgetRequest'
  });
}

// --- PER-CLUB EXPENSE LEDGER ---

export async function logClubExpense(
  clubId,
  { amount, description },
  actingMembership,
  actor
) {
  assertPermission(
    canManageClubFinances(actingMembership?.role),
    '403 Forbidden: only a club Treasurer can log an expense.'
  );

  const amt = Math.abs(Number(amount) || 0);

  await addDoc(
    collection(db, 'clubs', clubId, 'expenses'),
    {
      amount: amt,
      description: description || '',
      loggedBy: actor?.uid || null,
      loggedByName: actor?.name || 'Unknown',
      createdAt: serverTimestamp()
    }
  );

  await updateDoc(
    doc(db, 'clubs', clubId),
    {
      budgetSpent: increment(amt)
    }
  );

  await logAudit({
    actor,
    action: 'log_club_expense',
    target: `${description || 'expense'} ($${amt})`,
    targetType: 'clubExpense'
  });
}

export function listenToClubExpenses(clubId, callback) {
  const q = query(
    collection(db, 'clubs', clubId, 'expenses'),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }))
    );
  });
}

// --- ROOM BOOKINGS ---

export async function requestRoomBooking({
  clubId,
  clubName,
  room,
  dateTime,
  purpose,
  requestedBy,
  actingMembership
}) {
  assertPermission(
    canManageLogistics(actingMembership?.role),
    '403 Forbidden: only a club President, Co-President, or Vice President can request a room booking.'
  );

  await addDoc(collection(db, 'roomBookings'), {
    clubId,
    clubName,
    room,
    dateTime: dateTime ? new Date(dateTime) : null,
    purpose: purpose || '',
    status: 'pending',
    requestedBy,
    createdAt: serverTimestamp()
  });
}

export function listenToPendingRoomBookings(callback) {
  const q = query(
    collection(db, 'roomBookings'),
    where('status', '==', 'pending')
  );

  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }))
    );
  });
}

export function listenToClubRoomBookings(clubId, callback) {
  const q = query(
    collection(db, 'roomBookings'),
    where('clubId', '==', clubId)
  );

  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));

    items.sort(
      (a, b) =>
        (b.createdAt?.seconds || 0) -
        (a.createdAt?.seconds || 0)
    );

    callback(items);
  });
}

export async function decideRoomBooking(
  bookingId,
  approve,
  actor
) {
  assertPermission(
    isStaff(actor),
    '403 Forbidden: only Staff can decide a room booking.'
  );

  const snap = await getDoc(
    doc(db, 'roomBookings', bookingId)
  );

  const booking = snap.exists() ? snap.data() : null;

  await updateDoc(
    doc(db, 'roomBookings', bookingId),
    {
      status: approve ? 'approved' : 'denied'
    }
  );

  await logAudit({
    actor,
    action: approve
      ? 'approve_room_booking'
      : 'deny_room_booking',
    target: booking
      ? `${booking.clubName} - ${booking.room}`
      : bookingId,
    targetType: 'roomBooking'
  });
}

// --- CAMPUS BUDGET ---

const DEFAULT_BUDGET = {
  total: 0,
  remaining: 0
};

export async function getCampusBudget() {
  const snap = await getDoc(
    doc(db, 'settings', 'budget')
  );

  return snap.exists()
    ? {
        ...DEFAULT_BUDGET,
        ...snap.data()
      }
    : DEFAULT_BUDGET;
}

export function listenToCampusBudget(callback) {
  return onSnapshot(
    doc(db, 'settings', 'budget'),
    (snap) => {
      callback(
        snap.exists()
          ? {
              ...DEFAULT_BUDGET,
              ...snap.data()
            }
          : DEFAULT_BUDGET
      );
    }
  );
}

export async function setCampusBudget(total, actor) {
  assertPermission(
    isStaff(actor),
    '403 Forbidden: only Staff can set the campus budget.'
  );

  const amount = Number(total) || 0;

  await setDoc(
    doc(db, 'settings', 'budget'),
    {
      total: amount,
      remaining: amount
    },
    {
      merge: true
    }
  );

  await logAudit({
    actor,
    action: 'set_campus_budget',
    target: `$${amount}`,
    targetType: 'settings'
  });
}

// --- QUICK STATS ---

export async function getQuickStats() {
  const [
    activeClubsSnap,
    studentsSnap,
    budget
  ] = await Promise.all([
    getCountFromServer(
      query(
        collection(db, 'clubs'),
        where('status', '==', 'active')
      )
    ),

    getCountFromServer(
      query(
        collection(db, 'users'),
        where('role', '==', 'student')
      )
    ),

    getCampusBudget()
  ]);

  return {
    activeClubs: activeClubsSnap.data().count,
    studentCount: studentsSnap.data().count,
    remainingBudget: budget.remaining ?? 0
  };
}
