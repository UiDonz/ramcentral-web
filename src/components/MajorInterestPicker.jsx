import { useState } from 'react';
import { MAJORS, INTERESTS, MAX_MAJORS, majorById } from '../data/profileOptions';

const MAX_SUGGESTIONS = 8;

// Shared by the Onboarding page and the Profile page. Controlled: the
// parent owns { majors, interests } and passes onChange({ majors, interests }).
// Majors are picked by typing: the box suggests matching Farmingdale
// programs, and each pick becomes a removable chip (up to MAX_MAJORS).
export default function MajorInterestPicker({ majors, interests, onChange }) {
  const [query, setQuery] = useState('');

  const term = query.trim().toLowerCase();
  const suggestions = term === ''
    ? []
    : MAJORS
        .filter((m) => !majors.includes(m.id))
        .filter((m) => m.label.toLowerCase().includes(term) || m.short.toLowerCase().includes(term))
        // Names that START with what was typed come first.
        .sort((a, b) => Number(b.label.toLowerCase().startsWith(term)) - Number(a.label.toLowerCase().startsWith(term)))
        .slice(0, MAX_SUGGESTIONS);

  const majorsFull = majors.length >= MAX_MAJORS;

  function addMajor(id) {
    if (majorsFull || majors.includes(id)) return;
    onChange({ majors: [...majors, id], interests });
    setQuery('');
  }

  function removeMajor(id) {
    onChange({ majors: majors.filter((m) => m !== id), interests });
  }

  function toggleInterest(id) {
    onChange({
      majors,
      interests: interests.includes(id) ? interests.filter((i) => i !== id) : [...interests, id]
    });
  }

  return (
    <div className="picker">
      <fieldset className="picker-group">
        <legend>What's your major? <span className="picker-hint">(pick up to {MAX_MAJORS})</span></legend>

        {majors.length > 0 && (
          <div className="chip-row">
            {majors.map((id) => (
              <button
                type="button"
                key={id}
                className="chip selected"
                aria-label={`Remove ${majorById(id)?.label || id}`}
                onClick={() => removeMajor(id)}
              >
                {majorById(id)?.label || id} &times;
              </button>
            ))}
          </div>
        )}

        {!majorsFull && (
          <div className="major-search">
            <input
              type="search"
              value={query}
              placeholder="Start typing, e.g. computer, nursing, business"
              aria-label="Search majors"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // Enter picks the top suggestion instead of submitting the form.
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (suggestions[0]) addMajor(suggestions[0].id);
                }
              }}
            />
            {term !== '' && (
              <ul className="major-suggestions">
                {suggestions.length === 0 && <li className="major-none">No match. Try "Other" if yours isn't listed.</li>}
                {suggestions.map((m) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => addMajor(m.id)}>
                      {m.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </fieldset>

      <fieldset className="picker-group">
        <legend>
          What are you into? <span className="picker-hint">(pick any)</span>
        </legend>
        <div className="chip-row">
          {INTERESTS.map((i) => {
            const on = interests.includes(i.id);
            return (
              <button
                type="button"
                key={i.id}
                className={`chip${on ? ' selected' : ''}`}
                aria-pressed={on}
                onClick={() => toggleInterest(i.id)}
              >
                {i.label}
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}