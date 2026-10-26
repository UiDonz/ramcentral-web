
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Calendar from '../components/Calendar';
import LoadingSpinner from '../components/LoadingSpinner';
import ZoomCard from '../components/ZoomCard';
import {
  listenToNewsByCategory,
  listenToAcademicCalendar,
  getDigest,
} from '../services/news';
import { listenToUpcomingEvents } from '../services/events';
import { listenToClubs } from '../services/clubs';

const ACADEMIC_CALENDAR_URL =
  'https://www.farmingdale.edu/calendar/academic/index.shtml';

const AUTO_SCROLL_SPEED = 22;

const CATEGORY_COLORS = {
  academic: '#0c447c',
  clubs: '#72243e',
  campus: '#27500a',
};

const CATEGORY_LABELS = {
  academic: 'ACADEMIC',
  clubs: 'CLUBS',
  campus: 'CAMPUS',
};

const CLUB_KEYWORDS = [
  'club',
  'fair',
  'involvement',
  'student org',
  'society',
  'fraternity',
  'sorority',
  'rsvp',
];

const CAMPUS_KEYWORDS = [
  'rams',
  'soccer',
  'basketball',
  'volleyball',
  'sports',
  'athletics',
  'award',
  'anniversary',
  'campus',
];

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function dateKeyFromValue(value) {
  if (!value) return '';

  let date;

  if (typeof value === 'string') {
    // Preserve date-only strings without timezone conversion.
    const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

    if (match) {
      return `${Number(match[1])}-${Number(match[2])}-${Number(match[3])}`;
    }

    date = new Date(value);
  } else if (value?.seconds != null) {
    date = new Date(value.seconds * 1000);
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) return '';

  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function formatEventDateTime(value) {
  if (!value) return '';

  const date =
    value?.seconds != null
      ? new Date(value.seconds * 1000)
      : new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function describeNewsError(error) {
  if (!error) return 'Something went wrong while loading the page.';

  if (error.code === 'failed-precondition') {
    return 'Firestore needs an index for this query. Check the browser console for the index creation link.';
  }

  if (error.code === 'permission-denied') {
    return 'Firestore denied access. Check that you are signed in and that the database rules are deployed.';
  }

  return `Could not load data: ${error.message || error.code || 'Unknown error'}`;
}

function renderWithBold(text) {
  if (!text) return text;

  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={index}>{part.slice(2, -2)}</strong>
    ) : (
      part
    )
  );
}

function splitDigestIntoBullets(text) {
  if (!text) return [];

  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z])/g)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .filter((sentence) => {
      const plainText = sentence.replace(/\*\*/g, '').trim();

      return !(
        /today at a glance/i.test(plainText) &&
        plainText.split(/\s+/).length <= 12
      );
    });
}

function guessBulletCategory(text) {
  const lower = text.toLowerCase();

  if (CLUB_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return 'clubs';
  }

  if (CAMPUS_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return 'campus';
  }

  return 'academic';
}

function getItemTag(item, sectionCategory) {
  if (item?.isClubEvent) {
    return { category: 'clubs', label: 'CLUB EVENT' };
  }

  if (!sectionCategory) return null;

  return {
    category: sectionCategory,
    label: CATEGORY_LABELS[sectionCategory],
  };
}

function CategoryTag({ tag }) {
  if (!tag) return null;

  return (
    <span className={`feed-item-tag tag-${tag.category}`}>
      {tag.label}
    </span>
  );
}

function FeedItem({ item, sectionCategory, onZoomChange }) {
  const tag = getItemTag(item, sectionCategory);

  return (
    <ZoomCard
      className={`feed-item${item.isClubEvent ? ' feed-item-club' : ''}`}
      ariaLabel={`Read more: ${item.title || 'News item'}`}
      onOpenChange={onZoomChange}
      preview={
        <div className="feed-item-toggle">
          <span className="feed-item-title">
            <CategoryTag tag={tag} />
            {item.title || 'Untitled'}
          </span>

          <span className="feed-item-date">{item.date || ''}</span>
        </div>
      }
      expanded={
        <>
          <CategoryTag tag={tag} />

          <h3 className="zoom-panel-title">
            {item.title || 'Untitled'}
          </h3>

          <div className="zoom-panel-meta">{item.date || ''}</div>

          <span className="overview-label">Overview</span>

          <p className="zoom-panel-body">
            {item.summary
              ? renderWithBold(item.summary)
              : 'No overview available for this story yet.'}
          </p>

          {item.clubId ? (
            <div className="zoom-panel-actions">
              <Link
                to={`/clubs/${item.clubId}`}
                className="feed-item-link"
              >
                View club &amp; RSVP &rarr;
              </Link>
            </div>
          ) : item.url ? (
            <div className="zoom-panel-actions">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="feed-item-link"
              >
                Read the full article &#8599;
              </a>
            </div>
          ) : null}
        </>
      }
    />
  );
}

function TickerGhostItem({ item, sectionCategory }) {
  const tag = getItemTag(item, sectionCategory);

  return (
    <div
      className={`feed-item${item.isClubEvent ? ' feed-item-club' : ''}`}
      aria-hidden="true"
    >
      <div className="feed-item-toggle">
        <span className="feed-item-title">
          <CategoryTag tag={tag} />
          {item.title || 'Untitled'}
        </span>

        <span className="feed-item-date">{item.date || ''}</span>
      </div>
    </div>
  );
}

function AutoScrollFeed({ items, size, category }) {
  const containerRef = useRef(null);
  const primarySetRef = useRef(null);
  const pausedRef = useRef(false);
  const openCardsRef = useRef(0);
  const animationRef = useRef(null);
  const lastTimeRef = useRef(null);
  const [needsLoop, setNeedsLoop] = useState(false);

  function handleZoomChange(isOpen) {
    openCardsRef.current = Math.max(
      0,
      openCardsRef.current + (isOpen ? 1 : -1)
    );
  }

  useEffect(() => {
    const container = containerRef.current;
    const primary = primarySetRef.current;

    if (!container || !primary) return;

    setNeedsLoop(primary.scrollHeight > container.clientHeight);
  }, [items]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return undefined;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function step(timestamp) {
      const element = containerRef.current;

      if (
        element &&
        needsLoop &&
        !pausedRef.current &&
        !reducedMotion &&
        openCardsRef.current === 0
      ) {
        if (lastTimeRef.current != null) {
          const elapsed = (timestamp - lastTimeRef.current) / 1000;
          const halfHeight = element.scrollHeight / 2;

          if (halfHeight > 0) {
            element.scrollTop += AUTO_SCROLL_SPEED * elapsed;

            if (element.scrollTop >= halfHeight) {
              element.scrollTop -= halfHeight;
            }
          }
        }
      }

      lastTimeRef.current = timestamp;
      animationRef.current = requestAnimationFrame(step);
    }

    animationRef.current = requestAnimationFrame(step);

    return () => {
      if (animationRef.current != null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [needsLoop, items]);

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
          {items.map((item, index) => (
            <FeedItem
              key={item.id || `${category}-${index}`}
              item={item}
              sectionCategory={category}
              onZoomChange={handleZoomChange}
            />
          ))}
        </div>

        {needsLoop && items.length > 0 && (
          <div className="feed-ticker-set" aria-hidden="true">
            {items.map((item, index) => (
              <TickerGhostItem
                key={`duplicate-${item.id || index}`}
                item={item}
                sectionCategory={category}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TodayBulletItem({ sentence }) {
  const category = guessBulletCategory(sentence);
  const tag = {
    category,
    label: CATEGORY_LABELS[category],
  };

  return (
    <ZoomCard
      className="today-bullet"
      ariaLabel="Read today's overview item"
      preview={
        <>
          <span
            className="today-bullet-dot"
            style={{ background: CATEGORY_COLORS[category] }}
          />

          <span className="today-bullet-text">
            <CategoryTag tag={tag} />
            {renderWithBold(sentence)}
          </span>
        </>
      }
      expanded={
        <>
          <CategoryTag tag={tag} />

          <p className="zoom-panel-body" style={{ marginTop: '0.6em' }}>
            {renderWithBold(sentence)}
          </p>
        </>
      }
    />
  );
}

function DayBullet({ color, title, detail, linkLabel, linkUrl }) {
  return (
    <div className="day-bullet">
      <span
        className="day-bullet-dot"
        style={{ background: color }}
      />

      <div>
        <div className="day-bullet-text">
          <strong>{title}</strong>
          {detail ? ` — ${detail}` : ''}
        </div>

        {linkUrl && (
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="day-bullet-link"
          >
            {linkLabel || 'More information'} &#8599;
          </a>
        )}
      </div>
    </div>
  );
}

function FeedSection({ loading, loadingLabel, emptyLabel }) {
  if (loading) {
    return <LoadingSpinner label={loadingLabel} />;
  }

  return <p className="day-panel-empty">{emptyLabel}</p>;
}

export default function News() {
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [academic, setAcademic] = useState([]);
  const [academicLoading, setAcademicLoading] = useState(true);
  const [clubsFairs, setClubsFairs] = useState([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [campus, setCampus] = useState([]);
  const [campusLoading, setCampusLoading] = useState(true);
  const [todayDigest, setTodayDigest] = useState('');
  const [dayPanel, setDayPanel] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [clubEvents, setClubEvents] = useState([]);
  const [clubNames, setClubNames] = useState({});

  useEffect(() => {
    const unsubscribers = [];

    function handleError(error) {
      setLoadError(describeNewsError(error));
    }

    unsubscribers.push(
      listenToAcademicCalendar(
        (items) => {
          setCalendarEvents(
            items.map((item) => ({
              ...item,
              date: dateKeyFromValue(item.date),
              category: 'academic',
            }))
          );
        },
        handleError
      )
    );

    unsubscribers.push(
      listenToNewsByCategory(
        'academic',
        (items) => {
          setAcademic(items);
          setAcademicLoading(false);
        },
        (error) => {
          handleError(error);
          setAcademicLoading(false);
        }
      )
    );

    unsubscribers.push(
      listenToNewsByCategory(
        'clubs',
        (items) => {
          setClubsFairs(items);
          setClubsLoading(false);
        },
        (error) => {
          handleError(error);
          setClubsLoading(false);
        }
      )
    );

    unsubscribers.push(
      listenToNewsByCategory(
        'campus',
        (items) => {
          setCampus(items);
          setCampusLoading(false);
        },
        (error) => {
          handleError(error);
          setCampusLoading(false);
        }
      )
    );

    unsubscribers.push(
      listenToUpcomingEvents(
        (events) => {
          setClubEvents(events);
        }
      )
    );

    unsubscribers.push(
      listenToClubs((clubs) => {
        const names = {};

        clubs.forEach((club) => {
          names[club.id] = club.name;
        });

        setClubNames(names);
      })
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDigest() {
      const digest = await getDigest(todayKey());

      if (cancelled) return;

      if (typeof digest === 'string') {
        setTodayDigest(digest);
      } else {
        setTodayDigest(
          digest?.summary ||
          digest?.digest ||
          digest?.text ||
          digest?.content ||
          ''
        );
      }
    }

    loadDigest();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleDayClick(dateKey, dateLabel, eventsForDay) {
    setDayPanel({
      dateKey,
      dateLabel,
      events: eventsForDay,
    });
  }

  const todayBullets = splitDigestIntoBullets(todayDigest);

  const clubEventItems = clubEvents.map((event) => ({
    id: `event-${event.id}`,
    title: event.title,
    date: formatEventDateTime(event.dateTime),
    summary: [
      clubNames[event.clubId]
        ? `Posted by ${clubNames[event.clubId]}.`
        : '',
      event.location ? `Location: ${event.location}.` : '',
      event.description || '',
    ]
      .filter(Boolean)
      .join(' '),
    clubId: event.clubId,
    isClubEvent: true,
  }));

  // Real club events appear before the scraped clubs/fairs stories.
  const clubsFeedItems = [...clubEventItems, ...clubsFairs];

  const dayNews = dayPanel
    ? [
        ...academic.filter(
          (item) => dateKeyFromValue(item.date) === dayPanel.dateKey
        ),
        ...clubsFairs.filter(
          (item) => dateKeyFromValue(item.date) === dayPanel.dateKey
        ),
        ...campus.filter(
          (item) => dateKeyFromValue(item.date) === dayPanel.dateKey
        ),
      ]
    : [];

  return (
    <main className="news-page">
      <header className="news-hero">
        <p className="news-eyebrow">RAMCENTRAL</p>
        <h1>News &amp; Campus Calendar</h1>
        <p>
          Stay up to date with academic deadlines, club activities, and campus
          news.
        </p>
      </header>

      {loadError && (
        <div className="news-error" role="alert">
          {loadError}
        </div>
      )}

      <div className="news-top-row">
        <section className="news-calendar-col">
          <h2>Campus Calendar</h2>

          <Calendar
            events={calendarEvents}
            onDayClick={handleDayClick}
          />

          <a
            className="feed-item-link"
            href={ACADEMIC_CALENDAR_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Official academic calendar &#8599;
          </a>

          {dayPanel && (
            <div className="day-panel">
              <div className="day-panel-header">
                <h3>{dayPanel.dateLabel}</h3>

                <button
                  type="button"
                  className="link-button"
                  onClick={() => setDayPanel(null)}
                >
                  Close
                </button>
              </div>

              {dayPanel.events.length === 0 && dayNews.length === 0 ? (
                <p className="day-panel-empty">
                  No calendar events or news found for this date.
                </p>
              ) : (
                <>
                  {dayPanel.events.map((event, index) => (
                    <DayBullet
                      key={`calendar-${event.id || index}`}
                      color={CATEGORY_COLORS.academic}
                      title={event.title || 'Academic calendar event'}
                      detail={event.description || ''}
                      linkLabel="Official academic calendar"
                      linkUrl={ACADEMIC_CALENDAR_URL}
                    />
                  ))}

                  {dayNews.map((item, index) => (
                    <DayBullet
                      key={`news-${item.id || index}`}
                      color={
                        CATEGORY_COLORS[item.category] ||
                        CATEGORY_COLORS.academic
                      }
                      title={item.title || 'News item'}
                      detail={item.summary || ''}
                      linkLabel="Read article"
                      linkUrl={item.url}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </section>

        <section className="news-today-col">
          <div className="today-card">
            <h2>Today's Overview</h2>

            <p className="overview-label">
              {new Date().toLocaleDateString([], {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </p>

            <div className="today-feed">
              {todayBullets.length > 0 ? (
                todayBullets.map((sentence, index) => (
                  <TodayBulletItem
                    key={`${index}-${sentence.slice(0, 20)}`}
                    sentence={sentence}
                  />
                ))
              ) : (
                <p className="day-panel-empty">
                  Today's overview is not available yet.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>

      <div className="news-bottom-row">
        <section className="news-feed-section">
          <h2>Academic News</h2>

          {academicLoading || academic.length === 0 ? (
            <FeedSection
              loading={academicLoading}
              loadingLabel="Loading academic news..."
              emptyLabel="No academic news available right now."
            />
          ) : (
            <AutoScrollFeed
              items={academic}
              size="large"
              category="academic"
            />
          )}
        </section>

        <section className="news-feed-section">
          <h2>Clubs &amp; Fairs</h2>

          {clubsLoading && clubEventItems.length === 0 ? (
            <FeedSection
              loading
              loadingLabel="Loading clubs and fairs..."
              emptyLabel="No clubs or fairs available right now."
            />
          ) : clubsFeedItems.length === 0 ? (
            <FeedSection
              loading={false}
              loadingLabel=""
              emptyLabel="No clubs or fairs available right now."
            />
          ) : (
            <AutoScrollFeed
              items={clubsFeedItems}
              size="large"
              category="clubs"
            />
          )}
        </section>

        <section className="news-feed-section">
          <h2>Campus News</h2>

          {campusLoading || campus.length === 0 ? (
            <FeedSection
              loading={campusLoading}
              loadingLabel="Loading campus news..."
              emptyLabel="No campus news available right now."
            />
          ) : (
            <AutoScrollFeed
              items={campus}
              size="large"
              category="campus"
            />
          )}
        </section>
      </div>
    </main>
  );
}
