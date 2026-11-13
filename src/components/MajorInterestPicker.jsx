import { MAJORS, INTERESTS, MAX_MAJORS } from '../data/profileOptions';

// Shared by the Onboarding page and the Profile page. Controlled: the
// parent owns { majors, interests } and passes onChange({ majors, interests }).
export default function MajorInterestPicker({ majors, interests, onChange }) {
  function toggleMajor(id) {
    if (majors.includes(id)) {
      onChange({ majors: majors.filter((m) => m !== id), interests });
    } else if (majors.length < MAX_MAJORS) {
      onChange({ majors: [...majors, id], interests });
    }
  }

  function toggleInterest(id) {
    onChange({
      majors,
      interests: interests.includes(id) ? interests.filter((i) => i !== id) : [...interests, id]
    });
  }

  const majorsFull = majors.length >= MAX_MAJORS;

  return (
    <div className="picker">
      <fieldset className="picker-group">
        <legend>
          What's your major? <span className="picker-hint">(pick up to {MAX_MAJORS})</span>
        </legend>
        <div className="chip-row">
          {MAJORS.map((m) => {
            const on = majors.includes(m.id);
            return (
              <button
                type="button"
                key={m.id}
                className={`chip${on ? ' selected' : ''}`}
                aria-pressed={on}
                disabled={!on && majorsFull}
                onClick={() => toggleMajor(m.id)}
              >
                {m.label}
              </button>
            );
          })}
        </div>
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
