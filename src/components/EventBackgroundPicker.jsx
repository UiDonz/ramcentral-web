import { useState } from 'react';
import { CARD_THEMES, cardThemeClass, cardThemeStyle } from '../data/cardThemes';
import CardThemeIcon from './CardThemeIcon';

// "Nov 20, 6:30 PM" from the form's 'YYYY-MM-DDTHH:mm' value; '' when not set yet.
function previewWhen(dateTime) {
  if (!dateTime) return '';
  const d = new Date(dateTime);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// The same Colors / Images / Pictures options as "Club card style", for an event.
// value is a card theme id ('' means the plain card); onChange gets the new id.
// It starts collapsed: the header shows the current choice, and opening it shows
// the tiles plus a live preview of the event card. title / dateTime / location
// are only used for that preview.
export default function EventBackgroundPicker({ value, onChange, title, dateTime, location }) {
  const [open, setOpen] = useState(false);
  const current = value || 'default';
  const theme = CARD_THEMES.find((t) => t.id === current);
  const currentLabel = current === 'default' || !theme ? 'Default' : theme.label;
  const when = previewWhen(dateTime);

  return (
    <div className={`theme-picker event-bg-picker${open ? ' open' : ''}`}>
      <button
        type="button"
        className="event-bg-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span
          className={`event-bg-chip${cardThemeClass(current)}`}
          style={current === 'default' ? { background: 'var(--white)' } : cardThemeStyle(current)}
          aria-hidden="true"
        />
        <span className="event-bg-toggle-text">
          Event background: <strong>{currentLabel}</strong>
        </span>
        <span className="event-bg-caret" aria-hidden="true">
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open && (
        <div className="event-bg-body">
          <div className="event-bg-preview-wrap">
            <span className="event-bg-preview-label">Preview</span>
            <div
              className={`event-card event-bg-preview${cardThemeClass(current)}`}
              style={cardThemeStyle(current)}
            >
              <CardThemeIcon themeId={current} />
              <h3>{title || 'Event title'}</h3>
              <p>{when || 'Date and time'}</p>
              <p>{location || 'Location'}</p>
            </div>
          </div>

          {['Colors', 'Images', 'Pictures'].map((group) => (
            <div key={group} className="event-bg-group">
              <span className="event-bg-group-label">{group}</span>
              <div className="theme-picker-group" role="radiogroup" aria-label={`${group} event backgrounds`}>
                {CARD_THEMES.filter((t) => t.group === group).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={current === t.id}
                    title={t.id === 'default' ? 'Default' : t.label}
                    className={`theme-swatch${cardThemeClass(t.id)}${current === t.id ? ' selected' : ''}`}
                    style={t.id === 'default' ? { background: 'var(--white)' } : cardThemeStyle(t.id)}
                    onClick={() => onChange(t.id === 'default' ? '' : t.id)}
                  >
                    <CardThemeIcon themeId={t.id} />
                    <span className="theme-swatch-label">{t.id === 'default' ? 'Default' : t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
