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

// One color per category, used everywhere on this page that shows a
// category at a glance: the calendar's day dots, the day-click bullets, and
// now the small tag on every feed/overview card too - so the same color
// always means the same thing no matter where you see it.
const CATEGORY_COLORS = { academic: '#0c447c', clubs: '#72243e', campus: '#27500a' };
const CATEGORY_LABELS = { academic: 'ACADEMIC', clubs: 'CLUBS', campus: 'CAMPUS' };

// A real, officer-created club event is still shown with the "clubs" color,
// just with its own more specific label (and it's the one case a card's tag
// isn't just "whatever section this card is in" - see getItemTag below).
function getItemTag(item, sectionCategory) {
  // Gold tag only for events from a club the signed-in user belongs to;
  // everyone else sees the regular clubs color.
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

// Today's digest is one AI-written paragraph with no per-sentence category
// data attached, so its tag is a best guess from keywords - the same idea
// as the scraper's own categorize() function, just run client-side against
// each split-out sentence instead of a headline.
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

// Firestore only gives us an error code + message, not something a
// non-dev teammate can act on - translate the couple of codes we
// actually expect to hit while this feature is still being wired up.
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

// The scraper's AI-written summaries/digest were written as chat replies,
// so they sometimes contain markdown bold (**like this**) - without this,
// the raw asterisks show up literally and make the text look broken/jumbled.
// This only handles **bold** (the one pattern that actually shows up),
// not full markdown.
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

// The daily digest comes back from the scraper as one dense paragraph -
// readable enough in a chat, but a wall of text in a UI. This breaks it
// into individual sentences so each can be shown as its own separated
// row (same "one item, clearly apart from the next" idea as a news
// card), and drops the short "today at a glance" framing sentences the
// scraper's prompt tends to produce (e.g. a bare "**Today at a Glance**"
// or "Here's a friendly ... overview:") since they just repeat the
// "Overview" label already shown above the list.
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

// A club's own officers can create real events from the club page - those
// carry a clubId (see buildClubEventItem below) instead of an external
// `url`, so they read the club's actual RSVP page instead of the "read the
// article" pattern the scraped items use.
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

// Clicking a story now zooms it into a large centered panel (see ZoomCard)
// instead of expanding in place - which also means it's no longer limited
// to the tiny fixed-height scroll box a long summary used to get clipped
// inside of. onZoomChange bubbles up to AutoScrollFeed so it can pause the
// auto-scroll while a story from that feed is open.
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

// A non-interactive stand-in for FeedItem, used only for the auto-scroll
// feed's duplicate copy (see AutoScrollFeed below). It stays permanently
// "collapsed" so its height always matches the real item's collapsed
// height - the seamless-loop trick depends on both copies being the same
// total height.
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

// A feed list that scrolls itself when you're not touching it, and hands
// control back to a normal, native scrollbar the moment your cursor is
// over it (wheel/drag/trackpad all just work, since it's a real
// overflow-y: auto element the whole time - hovering only stops the
// automatic increment, it never disables scrolling).

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

// Same zoom-to-center treatment as a feed card, so a Today item behaves
// exactly like the ones below it instead of just being flat text - even
// though there's no extra detail to reveal beyond the sentence itself, the
// expanded panel shows it bigger and centered, same as the others.
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

// One card per thing happening that day - a calendar event, or a news
// item published that date. No AI call needed here: each card just shows
// the real scraped title/description directly, which is more trustworthy
// for "is there a governance meeting today" than a paraphrased summary
// would be. Given the same click-to-enlarge treatment as every other card
// on this page (FeedItem, TodayBulletItem) via ZoomCard, instead of being
// a flat, non-interactive row with only a tiny outbound link.
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

// Only ever rendered for the two non-list states - still loading, or
// loaded-but-genuinely-empty. Once there are real items, AutoScrollFeed
// takes over rendering entirely (this used to also render the item list
// itself, but that path was effectively dead code: it was only ever
// called when there were zero items to render).
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
  // Real, officer-created club events (the same ones ClubDetail/Events show)
  // - these go in the "Clubs & fairs" feed ahead of anything the scraper
  // found, since they're actual RamCentral activity rather than a guess
  // from a headline's keywords.
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

  // Auto-scrolls the whole News page itself when you're not doing anything
  // scroll-related, and gets out of the way the instant you are - scoped to
  // just this page (not the whole app) so it never fights you while filling
  // out a form elsewhere, like Login or Create Club. "Doing something"
  // means an actual scroll input (wheel, touch, arrow/page keys, grabbing
  // the scrollbar) rather than just mouse movement, so idly moving the
  // mouse while reading doesn't constantly reset the idle timer. It also
  // respects the zoom-card scroll lock (see ZoomCard.jsx) and reduced-
  // motion, and loops back to the top once it reaches the bottom.
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

            {/* Placed directly under the calendar (rather than as its own
                full-width block further down the page) so clicking a date
                shows its detail right where you clicked, instead of
                leaving a stretch of empty space between the calendar and
                its own answer. */}
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
