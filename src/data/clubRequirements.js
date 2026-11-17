// What Farmingdale State College's Office of Student Activities (OSA) and
// the Student Government Association (SGA) require of a club, written down
// in one place so the screens never hardcode it. Sources: the OSA Club
// Recognition page, the 2024-25 OSA Manual, the OSA Advisor Guide, and the
// SGA finance guide. If Farmingdale changes a requirement, change it HERE.
//
// Anything marked CONFIRM is something we could not verify from those
// documents - check it with Student Activities (studentactivities@
// farmingdale.edu, 934-420-2103) before relying on it.
// CONFIRM: we only know the RamCentral home page, not a direct link to each
// training or form. Replace these with the exact pages once OSA shares them.
export const RAMCENTRAL_URL = 'https://farmingdale.campuslabs.com/engage/';
export const OSA_EMAIL = 'studentactivities@farmingdale.edu';
export const OSA_PHONE = '934-420-2103';
// New clubs need at least 10 current students on the proposed roster.
export const MIN_ROSTER = 10;
// The "Core 4" officers every club must name. `role` is the club-role id
// used by services/rbac.js, so an accepted invitation gives the right role.
export const CORE_OFFICERS = [
  { key: 'pres', role: 'president', label: 'President' },
  { key: 'vp', role: 'vice_president', label: 'Vice President' },
  { key: 'tre', role: 'treasurer', label: 'Treasurer' },
  { key: 'sec', role: 'secretary', label: 'Secretary' }
];
// Trainings the Core 4 finish after a club is approved (OSA Manual p. 6, 34).
// Each officer does these in Farmingdale's own systems and then marks them
// done here; Staff can verify. CONFIRM the `url` of each.
export const TRAININGS = [
  {
    key: 'ebAck',
    label: 'Executive Board Acknowledgment & Orientation',
    url: RAMCENTRAL_URL,
    note: 'A form plus an orientation.'
  },
  {
    key: 'eventCoord',
    label: 'Event Coordinator Training',
    url: RAMCENTRAL_URL,
    note: 'Run by Student Activities.'
  },
  {
    key: 'saPrevention',
    label: 'Sexual Assault Prevention Training',
    url: RAMCENTRAL_URL,
    note: 'RSVP on RamCentral.'
  },
  { key: 'financial', label: 'Financial Tutorial', url: RAMCENTRAL_URL, note: 'Done in the SGA Portal.' }
];
// Expense Authorization Form (SGA finance guide). Only a President or
// Treasurer can prepare one.
export const EAF_ACCOUNTS = ['SGA Expense Account', 'Trust & Agency Account'];
export const EAF_TRANSACTIONS = [
  { id: 'check', label: 'Check: a contract or service paid to an outside company' },
  { id: 'online', label: 'Online order: the Program Advisor buys it with the SGA card' },
  { id: 'reimb', label: 'Reimbursement: paid back to a member who bought it' }
];
export const TRIP_LIMITS = { perStudent: 600, perYear: 6000, needsVpApprovalOver: 5000 };
export const TRANSPORT_MODES = [
  { id: 'self', label: 'Drive yourselves (local trip)', needsDriverForm: false },
  { id: 'carpool', label: 'Carpool', needsDriverForm: true },
  { id: 'rental', label: 'Rental car', needsDriverForm: true },
  { id: 'bus', label: 'Charter bus (Program Advisor books it)', needsDriverForm: false },
  { id: 'lirr', label: 'LIRR (Program Advisor helps)', needsDriverForm: false },
  {
    id: 'air',
    label: 'Airfare (Program Advisor books it; allow 5 extra business days)',
    needsDriverForm: false
  }
];
// Farmingdale only requires that a constitution states the club's purpose
// and mission. The other articles are common ones to start from.

export const CONSTITUTION_SECTIONS = [
  { title: 'Article I. Name', body: 'The name of this organization is [Club Name].' },
  {
    title: 'Article II. Purpose and Mission',
    required: true,
    body: '[Describe what the club exists to do and who it serves.]'
  },
  {
    title: 'Article III. Membership',
    body: 'Membership is open to current Farmingdale State College students. [Add any requirements.]'
  },
  {
    title: 'Article IV. Officers',
    body:
      'The Executive Board is the President, Vice President, Treasurer and Secretary. ' +
      "[List each role's duties.]"
  },
  {
    title: 'Article V. Elections',
    body: '[When officers are elected, how long they serve, how they are removed.]'
  },
  { title: 'Article VI. Meetings', body: '[How often the club meets and how decisions are made.]' },
  { title: 'Article VII. Dues', body: '[State the amount, or "This club does not collect dues."]' },
  { title: 'Article VIII. Amendments', body: '[How this constitution can be changed.]' }
];
// PDFs are stored as base64 text inside a Firestore document (same approach
// as background photos: no Firebase Storage). A document holds at most 1 MB,
// and base64 adds about a third, so keep raw files under about 650 KB.
export const FILE_LIMIT_BYTES = 650 * 1024;
export function isValidEmail(value) {
  return /^\S+@\S+\.\S+$/.test((value || '').trim());
}
// First Friday of a month (monthIndex 0-11).
function firstFriday(year, monthIndex) {
  const d = new Date(year, monthIndex, 1);
  while (d.getDay() !== 5) d.setDate(d.getDate() + 1);
  return d;
}
function fmt(d) {
  return d.toLocaleDateString([], { month: 'long', day: 'numeric' });
}
// New-club proposal windows: fall starts Apr 1 - May 1, spring starts
// Nov 1 - Dec 1. Informational only; the app never blocks a proposal on it.
export function proposalWindowInfo(now = new Date()) {
  const y = now.getFullYear();
  const windows = [
    { season: 'Spring', start: new Date(y, 10, 1), end: new Date(y, 11, 1) },
    { season: 'Fall', start: new Date(y, 3, 1), end: new Date(y, 4, 1) }
  ];
  const open = windows.find(
    (w) =>
      now >= w.start && now <= new Date(w.end.getFullYear(), w.end.getMonth(), w.end.getDate(), 23, 59, 59)
  );
  if (open)
    return {
      open: true,
      text: `The ${open.season.toLowerCase()} proposal window is open until ${fmt(open.end)}.`
    };
  return {
    open: false,
    text:
      'Proposals are accepted April 1 to May 1 (for fall) and November 1 to December 1 ' +
      '(for spring). You can still submit now, but Student Activities may hold it until ' +
      'the next window.'
  };
}
// Re-registration: fall June 1 - first Friday in October; spring
// December 1 - first Friday in March. Returns the next window to show.
export function nextReregistration(now = new Date()) {
  const y = now.getFullYear();
  const candidates = [
    { season: 'Spring', start: new Date(y - 1, 11, 1), end: firstFriday(y, 2) },
    { season: 'Fall', start: new Date(y, 5, 1), end: firstFriday(y, 9) },
    { season: 'Spring', start: new Date(y, 11, 1), end: firstFriday(y + 1, 2) }
  ];
  const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
  const current = candidates.find((w) => now >= w.start && now <= endOfDay(w.end));
  if (current)
    return {
      ...current,
      open: true,
      label: `${current.season} re-registration is open until ${fmt(current.end)}.`
    };
  const upcoming = candidates.filter((w) => w.start > now).sort((a, b) => a.start - b.start)[0];
  const days = Math.ceil((upcoming.start - now) / 86400000);
  return {
    ...upcoming,
    open: false,
    days,
    label:
      `Next window: ${fmt(upcoming.start)} to ${fmt(upcoming.end)} ` +
      `(${upcoming.season.toLowerCase()}), in ${days} day${days === 1 ? '' : 's'}.`
  };
}
