// Runs on a schedule via .github/workflows/scrape-news.yml (GitHub Actions),
// never in the browser. It is the only part of this project that holds
// admin-level Firebase access and an Anthropic API key - both come from
// GitHub Actions secrets at runtime and are never committed to the repo.
//
// What it does, in order:
// 1. Fetches Farmingdale's public News Room page (headlines) and the JSON
// feed behind the school's real calendar page - the same one at
// farmingdale.edu/calendar/, covering academic deadlines, RamCentral/
// CampusLabs club events, general campus events, and athletics.
// 2. Parses out headline/date/link (news) and date/title/description/url
// (calendar events, one entry per event - a day can have several).
// 3. Categorizes each news item as 'academic' | 'clubs' | 'campus' by
// keyword match, and each calendar event the same way from its source.
// 4. Calls Claude to write a short, original-words summary for each news
// item, and one combined "today at a glance" digest (never stores the
// original article's full text - see README notes on why, under
// "Known simplifications").
// 5. Writes everything to Firestore: schoolNews, academicCalendar, and a
// single campusDigest doc for today combining both sources.
//
// Run locally with: node scripts/scrape-news.js
// Requires env vars: FIREBASE_SERVICE_ACCOUNT_JSON, ANTHROPIC_API_KEY
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as cheerio from 'cheerio';
import Anthropic from '@anthropic-ai/sdk';
const NEWS_ROOM_URL = 'https://www.farmingdale.edu/news/feed.shtml?type=news-room';
// The old ACADEMIC_CALENDAR_URL (.../calendar/academic/index.shtml) was just
// a static table of a few dozen registrar deadlines - it's why the app's
// calendar looked so empty. The school's real calendar page (.../calendar/)
// is a JS-driven "FullCalendar" widget that pulls its events from this same
// URL with a `fullcalendar=true` query string, returning JSON. It's the same
// public page the widget itself calls (no auth, no key), and it covers
// everything: academic deadlines, RamCentral/CampusLabs club events, general
// FSC events, and athletics games.
const CALENDAR_FEED_URL = 'https://www.farmingdale.edu/calendar/index.shtml';
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const CLUB_KEYWORDS = ['club', 'fair', 'involvement', 'student org', 'society', 'fraternity',
'sorority'];
const CAMPUS_KEYWORDS = ['rams', 'soccer', 'basketball', 'volleyball', 'sports', 'athletics', 'award',
'anniversary'];
function categorize(title) {
const lower = title.toLowerCase();
if (CLUB_KEYWORDS.some((k) => lower.includes(k))) return 'clubs';
if (CAMPUS_KEYWORDS.some((k) => lower.includes(k))) return 'campus';
return 'academic';
}
async function fetchNewsRoom() {
const res = await fetch(NEWS_ROOM_URL);
const html = await res.text();
const $ = cheerio.load(html);
const items = [];
$('h3 a, h2 a').each((_, el) => {
const title = $(el).text().trim();
const href = $(el).attr('href');
if (!title || !href) return;
const dateText = $(el).closest('div').text().match(/[A-Z][a-z]+ \d{1,2}, \d{4}/);
items.push({
title,
url: href.startsWith('http') ? href : `https://www.farmingdale.edu${href}`,
date: dateText ? dateText[0] : null,
});
});
return items.slice(0, 15); // most recent batch only
}
// Pulls every event on the school's real calendar in a rolling window
// (a few days back, so "today" is never missed right at a day boundary,
// through ~2 months out - roughly what the calendar page itself shows
// before you'd have to click "next month" a bunch of times). Each event
// keeps its own date, so - unlike the old one-row-per-day table - more than
// one thing can land on the same day, which is normal (e.g. a club meeting
// and a soccer game on the same afternoon).
function calendarCategory(source) {
if (source === 'ramcentral') return 'clubs'; // posted through the school's own club/event platform
if (source === 'academic') return 'academic';
return 'campus'; // 'fsc' (general campus events) and 'athletics' both read as general campus news
}
async function fetchCampusCalendarEvents() {
const start = new Date();
start.setDate(start.getDate() - 3);
const end = new Date();
end.setDate(end.getDate() + 60);
const url =
`${CALENDAR_FEED_URL}?fullcalendar=true&start=${start.toISOString()}&end=${end.toISOString()}`;
const res = await fetch(url);
const raw = await res.json();
const events = [];
for (const ev of raw) {
// Dates come back with no timezone offset (e.g. "2026-08-31T00:00:00").
// Pulling the Y/M/D straight out of the string with a regex - rather
// than handing it to `new Date(...)` and reading the fields back off -
// sidesteps any chance of the runner's timezone shifting a midnight
// event onto the wrong day.
const m = /^(\d{4})-(\d{2})-(\d{2})T/.exec(ev.start || '');
if (!m) continue;
const dateKey = `${Number(m[1])}-${Number(m[2])}-${Number(m[3])}`;
const title = (ev.title || '').trim();
if (!title) continue;
events.push({
date: dateKey,
title,
description: (ev.description || ev.extendedProps?.display?.location || '').trim(),
url: ev.url || null,
category: calendarCategory(ev.extendedProps?.source),
time: ev.extendedProps?.display?.time || '',
});
}
return events;
}
async function summarize(prompt) {
const msg = await anthropic.messages.create({
model: 'claude-sonnet-4-6',
max_tokens: 200,
messages: [{ role: 'user', content: prompt }],
});
return msg.content.find((b) => b.type === 'text')?.text?.trim() || '';
}
async function run() {
const [newsItems, calendarEvents] = await Promise.all([fetchNewsRoom(),
fetchCampusCalendarEvents()]);
// News items -> schoolNews, each with its own AI summary.
for (const item of newsItems) {
const category = categorize(item.title);
const summary = await summarize(
`In 2-3 plain sentences, summarize what this Farmingdale State College news headline is ` +
`probably about, for a student browsing a campus app. Do not invent specifics you can't ` +
`know from the title alone - keep it general if needed. Headline: "${item.title}"`
);
await db.collection('schoolNews').doc(Buffer.from(item.url).toString('base64url')).set({
title: item.title,
url: item.url,
date: item.date,
category,
summary,
scrapedAt: Timestamp.now(),
});
}
// Calendar events -> academicCalendar. Collection name is a holdover from
// when this only held registrar deadlines - it now holds every event type,
// but renaming a Firestore collection every client already reads from
// isn't worth doing for a name. Doc id is a hash of the day + title (not
// just the day, like before) since a single day can now hold several
// events; re-running the scraper re-writes the same id for an unchanged
// event instead of piling up duplicates.
for (const ev of calendarEvents) {
const docId = Buffer.from(`${ev.date}::${ev.title}`).toString('base64url').slice(0, 300);
await db.collection('academicCalendar').doc(docId).set({
date: ev.date,
title: ev.title,
description: ev.description,
url: ev.url,
category: ev.category,
time: ev.time,
});
}
// One combined "today" digest, written once per run. Only today's own
// events go in the prompt now - calendarEvents spans ~2 months, and
// "today at a glance" should mean today, not everything coming up this
// fall.
const today = new Date();
const todayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
const todaysEvents = calendarEvents.filter((ev) => ev.date === todayKey);
const todayHeadlines = newsItems.slice(0, 5).map((n) => n.title).join('; ');
const digestText = await summarize(
`Write a friendly "today at a glance" overview for a college club-management app. Write it ` +
`as a plain list of the distinct things happening, one short clause each, separated by ` +
`periods - not a single flowing paragraph, and don't add a title or lead-in sentence like ` +
`"here's your overview" since the app already shows one. Today's calendar events: ` +
`${todaysEvents.map((e) => `${e.title}${e.time ? ` (${e.time})` : ''}`).join('; ') || 'none'}. ` +
`Recent headlines (not necessarily today): ${todayHeadlines || 'none'}. If there's truly ` +
`nothing today, just say it's a quiet day - don't pad it out.`
);
await db.collection('campusDigest').doc(todayKey).set({
date: todayKey,
type: 'daily',
text: digestText,
generatedAt: Timestamp.now(),
});
console.log(`Wrote ${newsItems.length} news items, ${calendarEvents.length} calendar events, 1
digest.`);
}
run().catch((err) => {
console.error(err);
process.exit(1);
});