// Planning rules from the OSA E-Board Orientation ("Timelines - Events &
// Funding" and "Maintaining Active Club Status"), in one place so every
// screen reads the same numbers.

// How many days ahead each kind of event should be planned.
export const EVENT_TYPES = [
  { id: 'meeting', label: 'Meeting, info session or information table', days: 5 },
  { id: 'social', label: 'Craft / DIY, trivia or game night, movie night', days: 10 },
  { id: 'speaker', label: 'Guest speaker, sports & fitness, collection drive', days: 15 },
  { id: 'offsite', label: 'Off-campus trip, conference or outdoor event', days: 20 },
  { id: 'big', label: 'Party, banquet, performance or live show', days: 30 }
];

export const eventTypeOf = (id) => EVENT_TYPES.find((t) => t.id === id);

// A warning (or null) when `dateValue` is sooner than the type needs.
export function leadTimeWarning(typeId, dateValue) {
  const type = eventTypeOf(typeId);
  if (!type || !dateValue) return null;
  const when = new Date(dateValue);
  if (Number.isNaN(when.getTime())) return null;
  const days = Math.ceil((when - new Date()) / 86400000);
  if (days >= type.days) return null;
  return `This kind of event needs about ${type.days} days of planning, and it is ${Math.max(days, 0)} days away.`;
}

// Clubs must hold at least one meeting or event a month: 3 per semester.
export const EVENTS_PER_SEMESTER = 3;

// The current semester's dates. Spring is Jan-May, Fall is Sep-Dec; over the
// summer nothing is due.
export function semesterWindow(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (m <= 4)
    return {
      id: `${y}-spring`,
      label: `Spring ${y}`,
      start: new Date(y, 0, 1),
      end: new Date(y, 5, 1),
      inSession: true
    };
  if (m >= 8)
    return {
      id: `${y}-fall`,
      label: `Fall ${y}`,
      start: new Date(y, 8, 1),
      end: new Date(y + 1, 0, 1),
      inSession: true
    };
  return {
    id: `${y}-summer`,
    label: `Summer ${y}`,
    start: new Date(y, 5, 1),
    end: new Date(y, 8, 1),
    inSession: false
  };
}
