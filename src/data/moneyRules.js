// Farmingdale club money rules (from the SGA finance guide), kept in one
// place so the club form, the Staff approval card and the warnings all read
// the same numbers. Change a number here and every screen follows.

export const RETURNING_ALLOCATION = 5000;
export const NEW_CLUB_ALLOCATION = 2500;
export const DEFAULT_ALLOCATION = RETURNING_ALLOCATION;

import { leadTimeWarning } from './eventRules';

// Spending over this needs the VP of Student Affairs to sign off too.
export const VP_APPROVAL_OVER = 5000;
// The Expense Authorization Form has to be in this many business days ahead.
export const BUSINESS_DAYS_AHEAD = 5;

// Limits and reminders are from the OSA E-Board Orientation ("Budget
// Overview") and the SGA Finance guide. limit = dollars per club per year.
export const SPEND_CATEGORIES = [
  {
    id: 'food',
    label: 'Food',
    limit: 1000,
    rules: [
      'Up to $1,000 a year. Food for meetings can be no more than $600 a year of that.',
      'Food has to come from Aramark unless Staff approve an exemption.'
    ]
  },
  {
    id: 'prizes',
    label: 'Prizes',
    limit: 500,
    rules: [
      'Up to $500 a year. No prize or gift card over $50, and no cash.',
      'One prize per person per event, and a Prize Receipt Form must be filled in.'
    ]
  },
  {
    id: 'apparel',
    label: 'Apparel & promo items',
    limit: 2000,
    rules: [
      'Up to $2,000 a year, and $25 per item per person including tax and shipping.',
      'Shirts, hoodies and hats only. No customization.'
    ]
  },
  { id: 'supplies', label: 'Supplies & printing', limit: null, rules: [] },
  { id: 'speaker', label: 'Speaker / event cost', limit: null, rules: [] }
];

export const PAY_METHODS = [
  { id: 'aramark', label: 'Aramark food order', who: 'Program Advisor orders it' },
  { id: 'card', label: "Advisor's SGA card", who: 'Staff place the order' },
  { id: 'check', label: 'Check to a vendor', who: 'Staff place the order' },
  { id: 'reimburse', label: 'Reimburse a member', who: 'A member buys it first' }
];

// SGA funds cannot be used for any of these (OSA Budget Overview).
export const NOT_ALLOWED = [
  'Fundraising, raffles, donations, or items bought to donate or give to charity',
  'Personal gain: gifts, awards, personalized items, graduation or class regalia (cords, sashes, pins, rings)',
  'Paying any currently enrolled Farmingdale student for goods or services (photography, design, DJ, performances, host or emcee, labor)'
];

// What a vendor paid by check has to send (OSA Vendor Requirements).
export const VENDOR_DOCS = [
  'A current W-9 and an itemized invoice (correct business address and who the check is payable to). No gratuity can be paid.',
  "Three Certificates of Insurance: Farmingdale State College, State University of New York, and the Student Government Association Inc. (plus Workers' Compensation if the vendor has more than 3 employees).",
  'Food vendors also need a Health Permit, and a Fire Marshal form if they use a generator or fire suppression.'
];
export const VENDOR_DOCS_DAYS = 10; // business days ahead for payment on the day of the event
export const VENDOR_DOCS_MIN_DAYS = 5; // after this, nothing new is accepted

// What the club and Staff see for each step of a spending request.
export const SPEND_STATUS = {
  requested: { label: 'Waiting for Staff', tone: 'pending' },
  approved: { label: 'Approved', tone: 'active' },
  purchased: { label: 'Bought - receipts needed', tone: 'pending' },
  receipts: { label: 'Receipts with Staff', tone: 'pending' },
  returned: { label: 'Receipts sent back', tone: 'danger' },
  processing: { label: 'Payment being prepared', tone: 'pending' },
  paid: { label: 'Paid', tone: 'active' },
  denied: { label: 'Denied', tone: 'danger' }
};

export const categoryOf = (id) => SPEND_CATEGORIES.find((c) => c.id === id);
export const payMethodOf = (id) => PAY_METHODS.find((p) => p.id === id);

export function businessDaysBetween(from, to) {
  const a = new Date(from);
  const b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  let count = 0;
  const d = new Date(a);
  while (d < b) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
}

// What a club has used so far in each category (requests that were not
// denied), so the yearly category limits can be checked and drawn as bars.
export function categoryTotals(list, exceptId) {
  const out = {};
  list.forEach((r) => {
    if (r.status === 'denied' || r.id === exceptId) return;
    out[r.category] = (out[r.category] || 0) + (Number(r.amount) || 0);
  });
  return out;
}

// The bars on the club's Finances tab. "Other" gathers the categories that
// have no limit.
export const CATEGORY_GROUPS = [
  { id: 'food', label: 'Food', cats: ['food'], limit: 1000 },
  { id: 'prizes', label: 'Prizes', cats: ['prizes'], limit: 500 },
  { id: 'apparel', label: 'Apparel', cats: ['apparel'], limit: 2000 },
  { id: 'other', label: 'Other', cats: ['supplies', 'speaker'], limit: null }
];

const fmt = (n) => `$${(Number(n) || 0).toLocaleString()}`;

// Checks Staff (and the club, before sending) should see. Each one is
// { ok, text }: a green tick when it is fine, a warning when it is not. They
// never block anything - the rules are Student Activities' call, this just
// points them out. committedOthers / categoryUsedOthers = what the club has
// already used on OTHER requests.
export function spendWarnings({
  amount,
  category,
  neededBy,
  allocation,
  committedOthers = 0,
  categoryUsedOthers = 0,
  payMethod,
  eventType
}) {
  const out = [];
  const amt = Number(amount) || 0;
  const cat = categoryOf(category);
  if (cat?.limit) {
    if (categoryUsedOthers + amt > cat.limit) {
      out.push({
        ok: false,
        text: `Over the ${cat.label} limit: ${fmt(categoryUsedOthers)} used of ${fmt(cat.limit)} this year`
      });
    } else {
      out.push({
        ok: true,
        text: `Within the ${cat.label} limit (${fmt(cat.limit - categoryUsedOthers - amt)} left)`
      });
    }
  }
  if (allocation != null) {
    if (committedOthers + amt > allocation) {
      out.push({ ok: false, text: `Past the club allocation (${fmt(allocation)} a year)` });
    } else {
      out.push({
        ok: true,
        text: `Within the club allocation (${fmt(allocation - committedOthers - amt)} left)`
      });
    }
  }
  if (category === 'food' && payMethod && payMethod !== 'aramark') {
    out.push({ ok: false, text: 'Food has to come from Aramark unless Staff approve an exemption' });
  }
  if (amt > VP_APPROVAL_OVER) {
    out.push({ ok: false, text: 'Over $5,000 also needs the VP of Student Affairs' });
  }
  const lead = leadTimeWarning(eventType, neededBy);
  if (lead) out.push({ ok: false, text: lead });
  if (neededBy) {
    const days = businessDaysBetween(new Date(), neededBy);
    if (days != null && days < BUSINESS_DAYS_AHEAD) {
      out.push({
        ok: false,
        text: `Needed in ${Math.max(days, 0)} business days - should be in ${BUSINESS_DAYS_AHEAD} ahead`
      });
    }
    if (payMethod === 'check' && days != null && days < VENDOR_DOCS_DAYS) {
      out.push({
        ok: false,
        text:
          days < VENDOR_DOCS_MIN_DAYS
            ? `Vendor paperwork is not accepted less than ${VENDOR_DOCS_MIN_DAYS} business days before the event`
            : `Vendor paperwork is due ${VENDOR_DOCS_DAYS} business days ahead to be paid on the day (${VENDOR_DOCS_MIN_DAYS} minimum)`
      });
    }
  }
  return out;
}
