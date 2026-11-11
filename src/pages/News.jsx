import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { collectionGroup, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import Calendar from '../components/Calendar';
import LoadingSpinner from '../components/LoadingSpinner';
import ZoomCard from '../components/ZoomCard';
import { listenToNewsByCategory, listenToAcademicCalendar, getDigest } from '../services/news';
import { listenToUpcomingEvents } from '../services/events';
import { listenToClubs } from '../services/clubs';

const ACADEMIC_CALENDAR_URL = 'https://www.farmingdale.edu/calendar/academic/index.shtml';
// How fast the auto-scroll feeds move, in pixels per second.
const AUTO_SCROLL_SPEED = 22;

// One color per category, used on the calendar dots, day bullets and feed/overview tags.
const CATEGORY_COLORS = { academic: '#0c447c', clubs: '#72243e', campus: '#27500a' };
const CATEGORY_LABELS = { academic: 'ACADEMIC', clubs: 'CLUBS', campus: 'CAMPUS' };

// A club-created event keeps the "clubs" color but gets its own label.
function getItemTag(item, sectionCategory) {
  // Gold tag only for events from a club the signed-in user belongs to.
  if (item?.isClubEvent) {
    return { category: item.isMine ? 'clubevent' : 'clubs', label: 'CLUB EVENT' };
  }
  if (!sectionCategory) return null;
  return { category: sectionCategory, label: CATEGORY_LABELS[sectionCategory] };
}

function CategoryTag({ tag }) {
  if (!tag) return null;
  return <span className={`feed-item-tag tag-${tag.category}`}>{tag.label}</span>;
}

// Today's digest has no category data, so each sentence's tag is guessed from keywords
// (same idea as the scraper's categorize()).
const CLUB_KEYWORDS = ['club', 'fair', 'involvement', 'student org', 'society', 'fraternity', 'sorority', 'rsvp'];
const CAMPUS_KEYWORDS = ['rams', 'soccer', 'basketball', 'volleyball', 'sports', 'athletics', 'award', 'anniversary', 'campus'];
function guessBulletCategory(text) {
  const lower = text.toLowerCase();
  if (CLUB_KEYWORDS.some((k) => lower.includes(k))) return 'clubs';
  if (CAMPUS_KEYWORDS.some((k) => lower.includes(k))) return 'campus';
  return 'academic';
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// Translates the Firestore error codes we expect into messages a teammate can act on.
function describeNewsError(err) {
  if (!err) return null;
  if (err.code === 'failed-precondition') {
    return "Firestore needs a composite index for this query and doesn't have one yet. " +
      'Open the browser console (F12) - Firestore prints a direct "create index" link there, ' +
      'or run `firebase deploy --only firestore:indexes` from the repo (see README setup step 4).';
  }
  if (err.code === 'permission-denied') {
    return "Firestore rejected this read (permission-denied). Make sure you're signed in, and " +
      'that firestore.rules has been deployed (`firebase deploy --only firestore:rules`).';
  }
  return `Couldn't load news/calendar data (${err.code || 'unknown error'}): ${err.message}`;
}

// Scraper summaries can contain **bold** markdown; this renders only that pattern.
function renderWithBold(text) {
  if (!text) return text;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      part
    )
  );
}

// Splits the digest paragraph into one bullet per sentence, dropping 'at a glance' framing sentences.
function splitDigestIntoBullets(text) {
  if (!text) return [];
  const sentences = text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z])/g)
    .map((s) => s.trim())
    .filter(Boolean);

  return sentences.filter((s) => {
    const bare = s.replace(/\*\*/g, '').trim();
    return !(/today at a glance/i.test(bare) && bare.split(/\s+/).length <= 12);
  });
}

// Club events carry a clubId (not a url), so they open the club's RSVP page.
function formatEventDateTime(dateTime) {
  const ms = dateTime?.seconds != null ? dateTime.seconds * 1000 : dateTime;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

// Turns a calendar event (date is 'YYYY-M-D') into the same shape the feed cards use.
function buildCalendarFeedItem(ev) {
  const [y, m, d] = ev.date.split('-').map(Number);
  const day = new Date(y, m - 1, d);
  return {
    id: `cal-${ev.id}`,
    title: ev.title,
    date: day.toLocaleDateString([], { month: 'short', day: 'numeric' }),
    summary: [ev.time, ev.description && ev.description !== ev.title ? ev.description : '']
      .filter(Boolean)
      .join(' — '),
    url: ev.url || ACADEMIC_CALENDAR_URL,
    dayStart: day.getTime(),
    category: ev.category,
  };
}

function buildClubEventItem(ev, clubName, isMine) {
  return {
    id: `event-${ev.id}`,
    title: ev.title,
    date: formatEventDateTime(ev.dateTime),
    summary: [
      clubName ? `Posted by ${clubName}.` : '',
      ev.location ? `Location: ${ev.location}.` : '',
      ev.description || '',
    ]
      .filter(Boolean)
      .join(' '),
    clubId: ev.clubId,
    isClubEvent: true,
    isMine,
  };
}

// Clicking a story zooms it into a centered ZoomCard; onZoomChange lets the feed pause auto-scroll.
function FeedItem({ item, sectionCategory, onZoomChange }) {
  const tag = getItemTag(item, sectionCategory);
  return (
    <ZoomCard
      className={`feed-item${item.isClubEvent ? ' feed-item-club' : ''}`}
      ariaLabel={`Read more: ${item.title}`}
      onOpenChange={onZoomChange}
      preview={
        <div className="feed-item-toggle">
          <span className="feed-item-title">
            <CategoryTag tag={tag} />
            {item.title}
          </span>
          <span className="feed-item-date">{item.date}</span>
        </div>
      }
      expanded={
        <>
          <CategoryTag tag={tag} />
          <h3 className="zoom-panel-title">{item.title}</h3>
          <div className="zoom-panel-meta">{item.date}</div>
          <span className="overview-label">Overview</span>
          <p className="zoom-panel-body">
            {item.summary ? renderWithBold(item.summary) : 'No overview available for this story yet.'}
          </p>
          {item.clubId ? (
            <div className="zoom-panel-actions">
              <Link to={`/clubs/${item.clubId}`} className="feed-item-link">
                View club &amp; RSVP &rarr;
              </Link>
            </div>
          ) : (
            item.url && (
              <div className="zoom-panel-actions">
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="feed-item-link">
                  Read the full article &#8599;
                </a>
              </div>
            )
          )}
        </>
      }
    />
  );
}

// Non-interactive copy used by AutoScrollFeed's loop; stays collapsed so both copies are the same height.
function TickerGhostItem({ item, sectionCategory }) {
  const tag = getItemTag(item, sectionCategory);
  return (
    <div className={`feed-item${item.isClubEvent ? ' feed-item-club' : ''}`} aria-hidden="true">
      <div className="feed-item-toggle">
        <span className="feed-item-title">
          <CategoryTag tag={tag} />
          {item.title}
        </span>
        <span className="feed-item-date">{item.date}</span>
      </div>
    </div>
  );
}

// Feed that auto-scrolls until hovered, then hands control back to native scrolling.

function AutoScrollFeed({ items, size, category, autoScroll = true }) {
  const containerRef = useRef(null);
  const primarySetRef = useRef(null);
  const pausedRef = useRef(false);
  const zoomOpenCountRef = useRef(0);
  const rafRef = useRef(null);
  const lastTsRef = useRef(null);
  const reducedMotionRef = useRef(false);
  const [needsLoop, setNeedsLoop] = useState(false);
  const needsLoopRef = useRef(false);

  function handleZoomChange(isOpen) {
    zoomOpenCountRef.current = Math.max(0, zoomOpenCountRef.current + (isOpen ? 1 : -1));
  }

  useLayoutEffect(() => {
    const el = containerRef.current;
    const primaryEl = primarySetRef.current;
    const loop = autoScroll && !!(el && primaryEl && primaryEl.scrollHeight > el.clientHeight);
    needsLoopRef.current = loop;
    setNeedsLoop(loop);
  }, [items, autoScroll]);

  useEffect(() => {
    if (!autoScroll) return undefined;
    reducedMotionRef.current =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function step(ts) {
      const el = containerRef.current;
      if (
        el &&
        needsLoopRef.current &&
        !pausedRef.current &&
        !reducedMotionRef.current &&
        zoomOpenCountRef.current === 0
      ) {
        if (lastTsRef.current != null) {
          const dt = (ts - lastTsRef.current) / 1000;
          const half = el.scrollHeight / 2;
          if (half > 0) {
            el.scrollTop += AUTO_SCROLL_SPEED * dt;
            if (el.scrollTop >= half) el.scrollTop -= half;
          }
        }
        lastTsRef.current = ts;
      } else {
        lastTsRef.current = ts;
      }
      rafRef.current = requestAnimationFrame(step);
    }

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [autoScroll]);

  return (
    <div className={`feed-box feed-box-${size}`}>
      <div
        ref={containerRef}
        className="feed-ticker"
        onMouseEnter={() => {
          pausedRef.current = true;
        }}
        onMouseLeave={() => {
          pausedRef.current = false;
        }}
      >
        <div className="feed-ticker-set" ref={primarySetRef}>
          {items.map((item) => (
            <FeedItem key={item.id} item={item} sectionCategory={category} onZoomChange={handleZoomChange} />
          ))}
        </div>
        {needsLoop && (
          <div className="feed-ticker-set" aria-hidden="true">
            {items.map((item) => (
              <TickerGhostItem key={`dup-${item.id}`} item={item} sectionCategory={category} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Same zoom-to-center behavior as the feed cards.
function TodayBulletItem({ sentence }) {
  const tag = { category: guessBulletCategory(sentence), label: null };
  tag.label = CATEGORY_LABELS[tag.category];
  return (
    <ZoomCard
      className="today-bullet"
      ariaLabel="Read more"
      preview={
        <>
          <span className="today-bullet-dot" style={{ background: CATEGORY_COLORS[tag.category] }} />
          <span className="today-bullet-text">
            <CategoryTag tag={tag} />
            {renderWithBold(sentence)}
          </span>
        </>
      }
      expanded={
        <>
          <CategoryTag tag={tag} />
          <p className="zoom-panel-body" style={{ marginTop: '0.6em' }}>{renderWithBold(sentence)}</p>
        </>
      }
    />
  );
}

// One card per calendar event or news item on the selected day, showing the real scraped text.
function DayEventCard({ color, tag, title, detail, linkLabel, linkUrl }) {
  return (
    <ZoomCard
      className="day-event-card"
      ariaLabel={`Read more: ${title}`}
      preview={
        <div className="day-bullet">
          <span className="day-bullet-dot" style={{ background: color }} />
          <div>
            <div className="day-bullet-text">
              <CategoryTag tag={tag} />
              <strong>{title}</strong>
            </div>
            {detail && <div className="day-event-card-detail">{detail}</div>}
          </div>
        </div>
      }
      expanded={
        <>
          <CategoryTag tag={tag} />
          <h3 className="zoom-panel-title">{title}</h3>
          {detail && <div className="zoom-panel-meta">{detail}</div>}
          {linkUrl && (
            <div className="zoom-panel-actions">
              <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="feed-item-link">
                {linkLabel} &#8599;
              </a>
            </div>
          )}
        </>
      }
    />
  );
}

// Only for the loading and empty states; AutoScrollFeed renders the actual items.
function FeedSection({ loading, loadingLabel, emptyLabel }) {
  if (loading) return <LoadingSpinner label={loadingLabel} />;
  return <p className="day-panel-empty">{emptyLabel}</p>;
}

export default function News() {
  const { currentUser } = useAuth();
  const [myClubIds, setMyClubIds] = useState(new Set());
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [academic, setAcademic] = useState([]);
  const [academicLoading, setAcademicLoading] = useState(true);
  const [clubsFairs, setClubsFairs] = useState([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [campus, setCampus] = useState([]);
  const [campusLoading, setCampusLoading] = useState(true);
  const [todayDigest, setTodayDigest] = useState(null);
  const [dayPanel, setDayPanel] = useState(null); // { label, calendarEvents, newsForDay }
  const [loadError, setLoadError] = useState(null);
  const [clubEvents, setClubEvents] = useState([]); // real events officers created, from services/events.js
  const [clubNames, setClubNames] = useState({}); // clubId -> name, for labeling those events

  // Which clubs the signed-in user is an approved member of (same query Home uses).
  useEffect(() => {
    if (!currentUser) return undefined;
    const q = query(
      collectionGroup(db, 'members'),
      where('uid', '==', currentUser.uid),
      where('status', '==', 'approved')
    );
    return onSnapshot(q, (snap) => {
      setMyClubIds(new Set(snap.docs.map((d) => d.ref.parent.parent.id)));
    });
  }, [currentUser]);

  useEffect(
    () => listenToAcademicCalendar(setCalendarEvents, (err) => setLoadError(describeNewsError(err))),
    []
  );
  // Real club-created events go ahead of scraped items in the 'Clubs & fairs' feed.
  useEffect(() => listenToUpcomingEvents(setClubEvents), []);
  useEffect(
    () => listenToClubs((clubs) => setClubNames(Object.fromEntries(clubs.map((c) => [c.id, c.name])))),
    []
  );
  useEffect(
    () =>
      listenToNewsByCategory(
        'academic',
        (items) => {
          setAcademic(items);
          setAcademicLoading(false);
        },
        (err) => {
          setLoadError(describeNewsError(err));
          setAcademicLoading(false);
        }
      ),
    []
  );
  useEffect(
    () =>
      listenToNewsByCategory(
        'clubs',
        (items) => {
          setClubsFairs(items);
          setClubsLoading(false);
        },
        (err) => {
          setLoadError(describeNewsError(err));
          setClubsLoading(false);
        }
      ),
    []
  );
  useEffect(
    () =>
      listenToNewsByCategory(
        'campus',
        (items) => {
          setCampus(items);
          setCampusLoading(false);
        },
        (err) => {
          setLoadError(describeNewsError(err));
          setCampusLoading(false);
        }
      ),
    []
  );

  useEffect(() => {
    getDigest(todayKey()).then(setTodayDigest);
  }, []);

  // Auto-scrolls the News page while idle; stops on real scroll input (wheel, touch, keys, scrollbar),
  // respects the ZoomCard scroll lock and reduced motion, and loops back to the top.
  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return undefined;

    const IDLE_DELAY_MS = 1800;
    const SPEED_PX_PER_SEC = 26;

    let lastInteraction = Date.now();
    let lastTs = null;
    let raf;

    function markInteraction() {
      lastInteraction = Date.now();
    }
    const interactionEvents = ['wheel', 'touchstart', 'keydown', 'mousedown'];
    interactionEvents.forEach((evt) => window.addEventListener(evt, markInteraction, { passive: true }));

    function step(ts) {
      if (lastTs != null) {
        const dt = (ts - lastTs) / 1000;
        const idle = Date.now() - lastInteraction > IDLE_DELAY_MS;
        const zoomLocked = document.body.classList.contains('zoom-locked');
        if (idle && !zoomLocked) {
          const doc = document.documentElement;
          const maxScroll = doc.scrollHeight - doc.clientHeight;
          if (maxScroll > 0) {
            const next = window.scrollY + SPEED_PX_PER_SEC * dt;
            window.scrollTo(0, next >= maxScroll ? 0 : next);
          }
        }
      }
      lastTs = ts;
      raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      interactionEvents.forEach((evt) => window.removeEventListener(evt, markInteraction));
    };
  }, []);

  function handleDayClick(dateKey, dateLabel, eventsForDay) {
    const allNews = [...academic, ...clubsFairs, ...campus];
    const newsForDay = allNews.filter((n) => n.date === dateKey);
    setDayPanel({ label: dateLabel, calendarEvents: eventsForDay, newsForDay });
  }

  const todayBullets = splitDigestIntoBullets(todayDigest?.text);

  const dayHasNothing = dayPanel && dayPanel.calendarEvents.length === 0 && dayPanel.newsForDay.length === 0;

  // Upcoming events: 7 days including today, soonest first. Anything
  // before today or later than that is hidden.
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const windowEndDate = new Date(todayStart);
  windowEndDate.setDate(windowEndDate.getDate() + 6);
  windowEndDate.setHours(23, 59, 59, 999);
  const windowEnd = windowEndDate.getTime();
  const upcomingCalendar = calendarEvents
    .filter((ev) => ev.date)
    .map(buildCalendarFeedItem)
    .filter((it) => it.dayStart >= todayStart && it.dayStart <= windowEnd)
    .sort((a, b) => a.dayStart - b.dayStart);
  const calendarFor = (cat) => upcomingCalendar.filter((it) => it.category === cat);

  // News headlines older than a week drop off; newest first.
  const newsCutoff = todayStart - 7 * 24 * 60 * 60 * 1000;
  const onlyRecent = (items) =>
    items.filter((n) => {
      const t = Date.parse(n.date);
      return Number.isNaN(t) || t >= newsCutoff;
    });
  const academicRecent = onlyRecent(academic).reverse();

  // Real club-created events go first, ahead of calendar events and scraped news.
  const clubEventItems = clubEvents
    .filter((ev) => {
      const ms = ev.dateTime?.seconds != null ? ev.dateTime.seconds * 1000 : ev.dateTime;
      return ms >= todayStart && ms <= windowEnd;
    })
    .map((ev) => buildClubEventItem(ev, clubNames[ev.clubId], myClubIds.has(ev.clubId)));
  const academicFeedItems = [...calendarFor('academic'), ...academicRecent];
  const clubsFeedItems = [...clubEventItems, ...calendarFor('clubs'), ...onlyRecent(clubsFairs).reverse()];
  const campusFeedItems = [...calendarFor('campus'), ...onlyRecent(campus).reverse()];
  const academicHasItems = !academicLoading && academicFeedItems.length > 0;
  const clubsHasItems = clubsFeedItems.length > 0;
  const campusHasItems = campusFeedItems.length > 0;

  return (
    <div className="page news-page">
      {loadError && (
        <div className="day-panel-empty" style={{ marginBottom: '1rem', border: '1px solid #c99a3c', padding: '0.75rem', borderRadius: '6px' }}>
          {loadError}
        </div>
      )}

      <div className="news-hero">
        <div className="news-top-row">
          <div className="news-calendar-col">
            <div className="section-label">Calendar</div>
            <Calendar events={calendarEvents} onDayClick={handleDayClick} />

            {/* Directly under the calendar so a clicked date's detail shows right where you clicked. */}
            {dayPanel && (
              <div className="day-panel">
                <div className="day-panel-date">{dayPanel.label}</div>
                {dayHasNothing && (
                  <p className="day-panel-empty">
                    Nothing on the calendar for this day, and no news from this date.
                  </p>
                )}
                {dayPanel.calendarEvents.map((ev, i) => (
                  <DayEventCard
                    key={`cal-${i}`}
                    color={CATEGORY_COLORS[ev.category] || '#c99a3c'}
                    tag={getItemTag(ev, ev.category)}
                    title={ev.title}
                    detail={
                      [ev.time, ev.description && ev.description !== ev.title ? ev.description : '']
                        .filter(Boolean)
                        .join(' — ')
                    }
                    linkLabel={ev.url ? 'View event' : 'View academic calendar'}
                    linkUrl={ev.url || ACADEMIC_CALENDAR_URL}
                  />
                ))}
                {dayPanel.newsForDay.map((item) => (
                  <DayEventCard
                    key={item.id}
                    color={CATEGORY_COLORS[item.category] || CATEGORY_COLORS.academic}
                    tag={getItemTag(item, item.category)}
                    title={item.title}
                    detail={item.summary}
                    linkLabel="Read full article"
                    linkUrl={item.url}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="news-today-col">
            <div className="section-label">Today</div>
            <div className="today-card">
              <span className="overview-label">Overview</span>
              <div className="today-feed">
                {todayBullets.length > 0 ? (
                  todayBullets.map((sentence, i) => <TodayBulletItem sentence={sentence} key={i} />)
                ) : (
                  <p className="today-empty">
                    Nothing scheduled today, and no notable headlines yet - check back later.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="news-hero">
        <div className="news-bottom-row">
          <div>
            <div className="section-label">Academic</div>
            {academicHasItems ? (
              <AutoScrollFeed items={academicFeedItems} size="large" category="academic" autoScroll={false} />
            ) : (
              <div className="feed-box feed-box-large">
                <FeedSection
                  loading={academicLoading}
                  loadingLabel="Loading..."
                  emptyLabel="Nothing academic coming up - check back soon."
                />
              </div>
            )}
          </div>
          <div>
            <div className="section-label">Clubs &amp; fairs</div>
            {clubsHasItems ? (
              <AutoScrollFeed items={clubsFeedItems} size="large" category="clubs" autoScroll={false} />
            ) : (
              <div className="feed-box feed-box-large">
                <FeedSection
                  loading={clubsLoading}
                  loadingLabel="Loading..."
                  emptyLabel="No club events or news right now - check back soon."
                />
              </div>
            )}
          </div>
          <div>
            <div className="section-label">Campus news</div>
            {campusHasItems ? (
              <AutoScrollFeed items={campusFeedItems} size="large" category="campus" autoScroll={false} />
            ) : (
              <div className="feed-box feed-box-large">
                <FeedSection
                  loading={campusLoading}
                  loadingLabel="Loading..."
                  emptyLabel="No campus news right now - check back soon."
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
