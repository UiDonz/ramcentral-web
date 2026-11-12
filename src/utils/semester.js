// Semester-aware date formatting. RamCentral only ever said "posted 3
// weeks ago", which made a club's older events look like they never
// happened - the point of this file is the opposite: every past event
// gets a fixed, human label like "Fall 2026, October 20th" and a
// "how many semesters ago" count that doesn't drift with the calendar.
//
// Academic terms (Farmingdale-style, simplified):
// Spring = Jan-May, Summer = Jun-Aug, Fall = Sep-Dec
// For the "N semesters ago" count only Spring and Fall are real
// semesters, so Summer is counted as part of the Spring half of its
// year (a Summer 2027 event reads as "this semester" while Spring 2027
// is still the current one).
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
// Accepts a Firestore Timestamp, a JS Date, a millisecond number, or an
// ISO/datetime-local string - returns a Date, or null if it can't.
export function toDate(value) {
 if (!value) return null;
 if (typeof value.toDate === 'function') return value.toDate();
 if (value.seconds != null) return new Date(value.seconds * 1000);
 const d = value instanceof Date ? value : new Date(value);
 return Number.isNaN(d.getTime()) ? null : d;
}
export function getSemester(value) {
 const d = toDate(value);
 if (!d) return null;
 const m = d.getMonth();
 const season = m <= 4 ? 'Spring' : m <= 7 ? 'Summer' : 'Fall';
 const year = d.getFullYear();
 return {
 season,
 year,
 label: `${season} ${year}`,
 // Two real semesters per year; Summer shares Spring's slot.
 ordinal: year * 2 + (season === 'Fall' ? 1 : 0)
 };
}
export function ordinalDay(n) {
 const mod100 = n % 100;
 if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
 switch (n % 10) {
 case 1:
 return `${n}st`;
 case 2:
 return `${n}nd`;
 case 3:
 return `${n}rd`;
 default:
 return `${n}th`;
 }
}
// "Fall 2026, October 20th"
export function formatEventDate(value) {
 const d = toDate(value);
 if (!d) return '';
 return `${getSemester(d).label}, ${MONTHS[d.getMonth()]} ${ordinalDay(d.getDate())}`;
}
// Whole semesters between an event and now: 0 = this semester,
// 1 = last semester, negative = a future semester.
export function semestersAgo(value, now = new Date()) {
 const a = getSemester(value);
 const b = getSemester(now);
 if (!a || !b) return null;
 return b.ordinal - a.ordinal;
}
export function semestersAgoLabel(n) {
 if (n == null) return '';
 if (n < 0) return 'Upcoming semester';
 if (n === 0) return 'This semester';
 if (n === 1) return 'Last semester';
 return `${n} semesters ago`;
}