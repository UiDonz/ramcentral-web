// Read-only access to the news/calendar data the scraper writes (scripts/scrape-news.js).
// The client never writes to these collections.
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { readCache, writeCache } from '../utils/cache';
// The scraper only updates these once a day, so a live listener is wasted reads.
// Each list is fetched once and kept in localStorage for a few hours.
const NEWS_TTL = 6 * 60 * 60 * 1000;
// Loads a list from the cache or Firestore. Returns an "unsubscribe" so callers
// can keep using these like listeners (it just ignores a late result).
function loadCached(key, fetchList, callback, onError, label) {
  let active = true;
  const cached = readCache(key, NEWS_TTL);
  if (cached) {
    callback(cached);
    return () => {};
  }
  fetchList()
    .then((items) => {
      writeCache(key, items);
      if (active) callback(items);
    })
    .catch((err) => {
      console.error(`[news] ${label} failed:`, err);
      if (active && onError) onError(err);
    });
  return () => {
    active = false;
  };
}
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
return loadCached(
`news-${category}`,
async () => {
const snap = await getDocs(q);
const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
// Oldest to newest.
items.sort((a, b) => toTimestamp(a.date) - toTimestamp(b.date));
return items;
},
callback,
onError,
`listenToNewsByCategory("${category}")`
);
}
// Every academic-calendar entry for the school year, filtered by month locally. Cached (see loadCached).
export function listenToAcademicCalendar(callback, onError) {
const q = query(collection(db, 'academicCalendar'), orderBy('date', 'asc'));
return loadCached(
'academic-calendar-v2',
// Entries with no category are leftovers from the first scraper and can be on the wrong day.
async () => (await getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => e.category),
callback,
onError,
'listenToAcademicCalendar'
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