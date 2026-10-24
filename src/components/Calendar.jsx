import { useState, useMemo } from 'react';
// Same category -> color mapping used for news items elsewhere on the News
// page, so a glance at the calendar and a glance at the feeds below it read
// as one consistent system rather than two different color languages.
const CATEGORY_COLORS = {
academic: '#0c447c',
clubs: '#72243e',
campus: '#27500a',
};
const DEFAULT_DOT_COLOR = '#c99a3c';
// events: array of { date: 'YYYY-M-D', title, description, category? }
// A day can have more than one event (e.g. a governance meeting AND an
// add/drop deadline on the same date), so eventsByKey groups into arrays
// rather than overwriting - this used to silently drop same-day events.
// onDayClick(dateKey, dateLabel, eventsForDay: array, possibly empty)
export default function Calendar({ events, onDayClick }) {
const [current, setCurrent] = useState(() => new Date());
const today = useMemo(() => new Date(), []);
const eventsByKey = useMemo(() => {
const map = {};
for (const ev of events) {
if (!map[ev.date]) map[ev.date] = [];
map[ev.date].push(ev);
}
return map;
}, [events]);
const year = current.getFullYear();
const month = current.getMonth();
const monthLabel = current.toLocaleString('default', { month: 'long', year: 'numeric' });
const firstWeekday = new Date(year, month, 1).getDay();
const daysInMonth = new Date(year, month + 1, 0).getDate();
const daysInPrevMonth = new Date(year, month, 0).getDate();
const cells = [];
for (let i = firstWeekday - 1; i >= 0; i--) cells.push({ n: daysInPrevMonth - i, muted: true });
for (let d = 1; d <= daysInMonth; d++) cells.push({ n: d, muted: false });
let nextMonthDay = 1;
while (cells.length % 7 !== 0 || cells.length < 35) cells.push({ n: nextMonthDay++, muted: true });
function goPrev() {
setCurrent(new Date(year, month - 1, 1));
}
function goNext() {
setCurrent(new Date(year, month + 1, 1));
}
function handleClick(cell) {
if (cell.muted) return;
const key = `${year}-${month + 1}-${cell.n}`;
const label = `${current.toLocaleString('default', { month: 'long' })} ${cell.n}, ${year}`;
onDayClick(key, label, eventsByKey[key] || []);
}
return (
<div className="calendar">
<div className="calendar-header">
<button type="button" className="link-button" aria-label="Previous month"
onClick={goPrev}>&larr;</button>
<span className="calendar-month-label">{monthLabel}</span>
<button type="button" className="link-button" aria-label="Next month"
onClick={goNext}>&rarr;</button>
</div>
<div className="calendar-weekdays">
{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i}>{d}</span>)}
</div>
<div className="calendar-grid">
{cells.slice(0, 35).map((cell, i) => {
if (cell.muted) return <div key={i} className="calendar-cell muted">{cell.n}</div>;
const key = `${year}-${month + 1}-${cell.n}`;
const isToday = year === today.getFullYear() && month === today.getMonth() && cell.n ===
today.getDate();
const dayEvents = eventsByKey[key] || [];
// One dot per distinct category present that day (capped at 3 so
// a busy day doesn't overflow the cell), rather than a single
// generic "something's happening" dot.
const dotColors = [...new Set(dayEvents.map((ev) => ev.category).filter(Boolean))]
.map((cat) => CATEGORY_COLORS[cat] || DEFAULT_DOT_COLOR)
.slice(0, 3);
if (dotColors.length === 0 && dayEvents.length > 0) dotColors.push(DEFAULT_DOT_COLOR);
return (
<button
type="button"
key={i}
className={`calendar-cell${isToday ? ' today' : ''}`}
onClick={() => handleClick(cell)}
>
<span className="calendar-cell-num">{cell.n}</span>
{dotColors.length > 0 && (
<span className="calendar-dot-row">
{dotColors.map((color, di) => (
<span key={di} className="calendar-dot" style={{ background: color }} />
))}
</span>
)}
</button>
);
})}
</div>
</div>
);
}
