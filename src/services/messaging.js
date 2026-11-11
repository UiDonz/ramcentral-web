// Firestore-backed instant messaging per club (clubs/{clubId}/messages). Deliberately minimal: a flat, append-only
// list ordered by time, with no threads, reactions, edits or typing indicators. The subcollection is created on first send.
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// Most recent N messages: enough scrollback without loading a club's whole history.
const MESSAGE_PAGE_SIZE = 200;

// A plain onSnapshot like the other listeners; ClubChat shows its own loading state until the first snapshot arrives.
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