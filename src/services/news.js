// Read-only access to the news/calendar data the scraper writes (scripts/scrape-news.js).
// The client never writes to these collections.
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
// schoolNews dates are strings like "July 16, 2026", so Firestore's orderBy sorts them alphabetically;
// sorting client-side after parsing them fixes the scrambled order.
function toTimestamp(dateStr) {
const t = Date.parse(dateStr);
return Number.isNaN(t) ? 0 : t;
}
// category: 'academic' | 'clubs' | 'campus'. onError is optional; without it a failed query
// (e.g. a missing index) leaves the UI spinning forever.
export function listenToNewsByCategory(category, callback, onError) {
const q = query(collection(db, 'schoolNews'), where('category', '==', category));
return onSnapshot(
q,
(snap) => {
const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
// Oldest to newest.
items.sort((a, b) => toTimestamp(a.date) - toTimestamp(b.date));
callback(items);
},
(err) => {
console.error(`[news] listenToNewsByCategory("${category}") failed:`, err);
if (onError) onError(err);
}
);
}
// Every academic-calendar entry for the school year; small enough to listen to all and filter by month locally.
export function listenToAcademicCalendar(callback, onError) {
const q = query(collection(db, 'academicCalendar'), orderBy('date', 'asc'));
return onSnapshot(
q,
(snap) => {
callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
},
(err) => {
console.error('[news] listenToAcademicCalendar failed:', err);
if (onError) onError(err);
}
);
}
// One-off fetch for a specific day's or week's precomputed digest.
// dateKey format: 'YYYY-M-D' for a daily digest, 'week-of-YYYY-M-D' for weekly.
export async function getDigest(dateKey) {
try {
const snap = await getDoc(doc(db, 'campusDigest', dateKey));
return snap.exists() ? snap.data() : null;
} catch (err) {
console.error('[news] getDigest failed:', err);
return null;
}
}