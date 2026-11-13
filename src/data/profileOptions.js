// The choices offered by the new-account questions (Onboarding.jsx) and
// the Profile page. Majors are stored on users/{uid}.majors as these
// stable `id` slugs (never the display label), because the club stats
// added in Issue #58 use them as Firestore map keys - a label like
// "Computer Programming & Information Systems" would be an awkward,
// fragile field path. Rename a `label` any time; never change an `id`.
//
// NOTE: starter list - the team should reconcile it with the real
// Farmingdale program list before launch (add/remove rows freely).

export const MAX_MAJORS = 2;

export const MAJORS = [
  { id: 'cpis', short: 'CPIS', label: 'Computer Programming & Information Systems (CPIS)' },
  { id: 'csia', short: 'CSIA', label: 'Computer Security & Information Assurance (CSIA)' },
  { id: 'business', short: 'Business', label: 'Business Administration' },
  { id: 'aviation', short: 'Aviation', label: 'Aviation' },
  { id: 'nursing', short: 'Nursing', label: 'Nursing' },
  { id: 'biology', short: 'Biology', label: 'Biology' },
  { id: 'engineering-tech', short: 'Eng. Tech', label: 'Engineering Technology' },
  { id: 'construction', short: 'Construction', label: 'Construction Management' },
  { id: 'visual-comm', short: 'Visual Comm', label: 'Visual Communications' },
  { id: 'education', short: 'Education', label: 'Education' },
  { id: 'health-sciences', short: 'Health Sci.', label: 'Health Sciences' },
  { id: 'undeclared', short: 'Undeclared', label: 'Undeclared' },
  { id: 'other', short: 'Other', label: 'Other' }
];

// `keywords` are matched (case-insensitive) against a club's category and
// name by services/recommendations.js, because club categories are free
// text ("Gaming", "Cultural / Dance", ...) rather than a fixed list.
export const INTERESTS = [
  { id: 'gaming', label: 'Gaming & Esports', keywords: ['gaming', 'game', 'esports', 'e-sports'] },
  {
    id: 'technology',
    label: 'Technology & Coding',
    keywords: ['tech', 'coding', 'computer', 'cyber', 'robotics', 'software']
  },
  {
    id: 'sports',
    label: 'Sports & Fitness',
    keywords: ['sport', 'fitness', 'athletic', 'recreation', 'wellness']
  },
  {
    id: 'arts',
    label: 'Arts, Music & Theater',
    keywords: ['art', 'music', 'theater', 'theatre', 'dance', 'film', 'design']
  },
  {
    id: 'cultural',
    label: 'Cultural & Identity',
    keywords: ['cultur', 'heritage', 'identity', 'international', 'language']
  },
  {
    id: 'academic',
    label: 'Academic & Honor Societies',
    keywords: ['academic', 'honor', 'study', 'science', 'research']
  },
  {
    id: 'service',
    label: 'Service & Volunteering',
    keywords: ['service', 'volunteer', 'community', 'charity']
  },
  {
    id: 'career',
    label: 'Career & Business',
    keywords: ['career', 'business', 'entrepreneur', 'professional', 'finance']
  },
  {
    id: 'media',
    label: 'Media & Publications',
    keywords: ['media', 'news', 'journal', 'radio', 'publication', 'podcast']
  },
  {
    id: 'faith',
    label: 'Faith & Spirituality',
    keywords: ['faith', 'religio', 'spiritual', 'christian', 'muslim', 'jewish']
  },
  { id: 'social', label: 'Social & Hobbies', keywords: ['social', 'hobby', 'club', 'anime', 'board'] }
];

export function majorById(id) {
  return MAJORS.find((m) => m.id === id) || null;
}

export function majorShort(id) {
  const m = majorById(id);
  return m ? m.short : id;
}

export function interestById(id) {
  return INTERESTS.find((i) => i.id === id) || null;
}
