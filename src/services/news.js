// Read-only access to the news/calendar data written by the scraper
// (scripts/scrape-news.js, run on a schedule via GitHub Actions - see
// .github/workflows/scrape-news.yml). The client never writes to these
// collections and never calls the summarization API directly - it only
// ever reads what the scraper already generated and stored.
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
// schoolNews stores `date` as a human-readable string straight from the
// scraped headline (e.g. "July 16, 2026"), not a Firestore Timestamp - so a
// Firestore-side `orderBy('date', ...)` sorts those strings alphabetically
// ("July" before "September" is right, but "September 9" sorts before
// "September 15" too, since '1' < '9' as characters). That's what was
// producing the scrambled-looking order in the feeds. Sorting client-side
// after actually parsing each string into a real date fixes it properly.
function toTimestamp(dateStr) {
const t = Date.parse(dateStr);
return Number.isNaN(t) ? 0 : t;
}
// category: 'academic' | 'clubs' | 'campus'
// onError is optional - if the query fails (missing composite index,
// rules rejection, etc.) onSnapshot's success callback never fires, so
// without this the UI would just spin forever with no clue why. Pass an
// onError to surface it instead of only logging to the console.
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
// Every academic-calendar entry for the whole school year. This collection
// is small (well under a thousand rows for a year), so the client just
// listens to all of it and filters by month locally instead of running a
// separate query per month.
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