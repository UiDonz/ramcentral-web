// Read-only access to the news/calendar data the scraper writes (scripts/scrape-news.js).
// The client never writes to these collections.
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { readCacheEntry, writeCache } from '../utils/cache';
// The scraper only updates these once a day, so a live listener is wasted reads.
// Each list is saved in the browser and reused until the scraper runs again: the scraper
// stamps newsMeta/lastRun when it finishes, and the page reads only that one doc to check.
// If the stamp can't be read, a saved copy is trusted for up to 6 hours instead.
const FALLBACK_TTL = 6 * 60 * 60 * 1000;
let lastRunPromise = null;
let lastRunFetchedAt = 0;
// When the scraper last finished (ms), or null if unknown. Shared by all the lists on the
// page and re-checked at most once a minute, so a News visit costs one read for this.
function getLastScrape() {
  if (!lastRunPromise || Date.now() - lastRunFetchedAt > 60 * 1000) {
    lastRunFetchedAt = Date.now();
    lastRunPromise = getDoc(doc(db, 'newsMeta', 'lastRun'))
      .then((snap) => (snap.exists() ? snap.data().at?.toMillis?.() ?? null : null))
      .catch(() => null);
  }
  return lastRunPromise;
}
// Loads a list from the saved copy or Firestore. A saved copy shows right away; if the
// scraper has run since it was saved, fresh data loads and replaces it. Returns an
// "unsubscribe" so callers can keep using these like listeners (it ignores late results).
function loadCached(key, fetchList, callback, onError, label) {
  let active = true;
  const cached = readCacheEntry(key);
  if (cached) callback(cached.v);
  getLastScrape()
    .then((lastRun) => {
      const fresh = cached && (lastRun ? cached.t >= lastRun : Date.now() - cached.t < FALLBACK_TTL);
      if (fresh) return;
      return fetchList().then((items) => {
        writeCache(key, items);
        if (active) callback(items);
      });
    })
    .catch((err) => {
      console.error(`[news] ${label} failed:`, err);
      if (active && onError && !cached) onError(err);
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