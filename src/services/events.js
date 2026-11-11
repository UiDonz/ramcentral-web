import {
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';

const eventsCol = collection(db, 'events');

// Midnight at the start of today. Listing events from here (not from this exact
// moment) keeps an event made for "now" or earlier today from vanishing at once.
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function listenToUpcomingEvents(callback) {
  const q = query(eventsCol, where('dateTime', '>=', startOfToday()), orderBy('dateTime', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}
export function listenToClubEvents(clubId, callback, onError) {
  const q = query(
    eventsCol,
    where('clubId', '==', clubId),
    where('dateTime', '>=', startOfToday()),
    orderBy('dateTime', 'asc')
  );
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => {
      console.error(`[events] listenToClubEvents("${clubId}") failed:`, err);
      if (onError) onError(err);
    }
  );
}

export async function createEvent({ clubId, title, description, location, dateTime, createdBy }) {
  await addDoc(eventsCol, {
    clubId,
    title,
    description: description || '',
    location: location || '',
    dateTime: new Date(dateTime),
    status: 'published',
    attendeeCount: 0,
    createdBy,
    createdAt: serverTimestamp()
  });
}

// Edits an existing event; only the fields the edit form shows can change.
export async function updateEvent(eventId, { title, description, location, dateTime }) {
  await updateDoc(doc(db, 'events', eventId), {
    title,
    description: description || '',
    location: location || '',
    dateTime: new Date(dateTime)
  });
}

export async function rsvpToEvent(eventId, uid) {
  await setDoc(doc(db, 'events', eventId, 'attendees', uid), {
    uid,
    rsvpStatus: 'going',
    rsvpAt: serverTimestamp()
  });
}

// Cancelling an event deletes it, which also removes it from the News page.
// The UI only offers this to a club's President, Co-President or Vice President.
export async function cancelEvent(eventId) {
  await deleteDoc(doc(db, 'events', eventId));
}

export async function cancelRsvp(eventId, uid) {
  await deleteDoc(doc(db, 'events', eventId, 'attendees', uid));
}