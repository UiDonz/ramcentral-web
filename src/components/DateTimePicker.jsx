import { useEffect, useRef, useState } from 'react';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const QUICK_TIMES = [
  { label: '9 AM', hour: 9, minute: 0 },
  { label: 'Noon', hour: 12, minute: 0 },
  { label: '6 PM', hour: 18, minute: 0 },
  { label: 'End of day', hour: 23, minute: 59 }
];

const pad = (n) => String(n).padStart(2, '0');

// Uses the same 'YYYY-MM-DDTHH:mm' text as <input type="datetime-local">, so the forms and createEvent are unchanged.
function toValue(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseValue(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function DateTimePicker({ value, onChange, placeholder = 'Choose date and time' }) {
  const selected = parseValue(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const base = selected || new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [time, setTime] = useState(() => ({
    hour: selected ? selected.getHours() : 12,
    minute: selected ? selected.getMinutes() : 0
  }));
  const wrapRef = useRef(null);
  const fieldRef = useRef(null);
  const popRef = useRef(null);

  // Keep the time boxes in step when the form changes the value (for example, clearing it after Create event).
  useEffect(() => {
    const d = parseValue(value);
    setTime(d ? { hour: d.getHours(), minute: d.getMinutes() } : { hour: 12, minute: 0 });
    if (d) setView(new Date(d.getFullYear(), d.getMonth(), 1));
  }, [value]);

  // When the calendar opens, scroll the page just enough to show all of it.
  useEffect(() => {
    if (open && popRef.current) popRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        setOpen(false);
        if (fieldRef.current) fieldRef.current.focus();
      }
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function emit(day, t) {
    onChange(toValue(new Date(day.getFullYear(), day.getMonth(), day.getDate(), t.hour, t.minute)));
  }

  function pickDay(day, fromTodayButton) {
    let t = time;
    const picked = new Date(day.getFullYear(), day.getMonth(), day.getDate(), t.hour, t.minute);
    // Today with a time that already passed (or the Today button): use 11:59 PM so the event doesn't vanish at once.
    if (sameDay(day, new Date()) && (fromTodayButton || picked < new Date())) t = { hour: 23, minute: 59 };
    setTime(t);
    emit(day, t);
  }

  function changeTime(next) {
    setTime(next);
    if (selected) emit(selected, next);
  }

  const hour12 = time.hour % 12 || 12;
  const isPm = time.hour >= 12;
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => {
    return new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
  });
  const today = new Date();

  return (
    <div className="dtp" ref={wrapRef}>
      <button
        type="button"
        className="dtp-field"
        ref={fieldRef}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={selected ? '' : 'dtp-placeholder'}>
          {selected
            ? selected.toLocaleString([], {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              })
            : placeholder}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      </button>

      {open && (
        <div className="dtp-pop" ref={popRef} role="dialog" aria-label="Choose date and time">
          <div className="dtp-head">
            <strong>
              {MONTHS[view.getMonth()]} {view.getFullYear()}
            </strong>
            <div className="dtp-nav">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
              >
                &#8249;
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
              >
                &#8250;
              </button>
            </div>
          </div>

          <div className="dtp-grid">
            {WEEKDAYS.map((w) => (
              <div key={w} className="dtp-dow">
                {w}
              </div>
            ))}
            {days.map((d) => {
              const cls = ['dtp-day'];
              if (d.getMonth() !== view.getMonth()) cls.push('dtp-out');
              if (sameDay(d, today)) cls.push('dtp-today');
              if (selected && sameDay(d, selected)) cls.push('dtp-sel');
              return (
                <button
                  key={d.getTime()}
                  type="button"
                  className={cls.join(' ')}
                  aria-label={d.toDateString()}
                  onClick={() => pickDay(d, false)}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <div className="dtp-time">
            <span>Time</span>
            <select
              aria-label="Hour"
              value={hour12}
              onChange={(e) =>
                changeTime({ hour: (Number(e.target.value) % 12) + (isPm ? 12 : 0), minute: time.minute })
              }
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <span>:</span>
            <select
              aria-label="Minute"
              value={time.minute}
              onChange={(e) => changeTime({ hour: time.hour, minute: Number(e.target.value) })}
            >
              {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                <option key={m} value={m}>
                  {pad(m)}
                </option>
              ))}
            </select>
            <select
              aria-label="AM or PM"
              value={isPm ? 'PM' : 'AM'}
              onChange={(e) => changeTime({ hour: (time.hour % 12) + (e.target.value === 'PM' ? 12 : 0), minute: time.minute })}
            >
              <option>AM</option>
              <option>PM</option>
            </select>
          </div>

          <div className="dtp-chips">
            {QUICK_TIMES.map((q) => (
              <button
                key={q.label}
                type="button"
                className="dtp-chip"
                onClick={() => changeTime({ hour: q.hour, minute: q.minute })}
              >
                {q.label}
              </button>
            ))}
          </div>

          <div className="dtp-foot">
            <button type="button" className="dtp-link" onClick={() => onChange('')}>
              Clear
            </button>
            <button type="button" className="dtp-link" onClick={() => pickDay(new Date(), true)}>
              Today
            </button>
            <button type="button" className="dtp-link" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
