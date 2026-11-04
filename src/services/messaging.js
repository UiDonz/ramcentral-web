// Firestore-backed instant messaging, scoped per club
// (clubs/{clubId}/messages). Deliberately minimal - a flat, append-only
// list ordered by time, no threads/reactions/edits/typing indicators -
// this is a scaffold the team can build on, not a finished chat
// product. A club's messages subcollection is created implicitly the
// moment anyone sends a first message, so nothing needs to be
// provisioned up front when a club is created.
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// Most-recent N messages - enough for a useful scrollback without
// pulling a club's entire message history into memory on every visit.
const MESSAGE_PAGE_SIZE = 200;

// A plain onSnapshot, exactly like every other real-time listener in
// this app (listenToMembers, listenToAnnouncements, listenToClubEvents)
// - mounting it never blocks the rest of ClubDetail from rendering.
// ClubChat.jsx shows its own "Loading chat..." state until the first
// snapshot arrives while the rest of the page is already interactive.
export function listenToClubMessages(clubId, callback, onError) {
  const q = query(
    collection(db, 'clubs', clubId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(MESSAGE_PAGE_SIZE)
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error(`[messaging] listenToClubMessages("${clubId}") failed:`, err);
      if (onError) onError(err);
    }
  );
}

export async function sendClubMessage(clubId, { uid, name, text }) {
  const trimmed = (text || '').trim();
  if (!trimmed) return;
  await addDoc(collection(db, 'clubs', clubId, 'messages'), {
    text: trimmed,
    authorId: uid,
    authorName: name || 'Member',
    createdAt: serverTimestamp()
  });
}