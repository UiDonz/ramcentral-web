// Tags an officer can add with one click in Edit club info (they can still type their own).
export const SUGGESTED_TAGS = [
  'beginner-friendly', 'meets-weekly', 'social', 'networking', 'career-prep', 'community-service',
  'volunteering', 'leadership', 'coding', 'engineering', 'stem', 'business', 'art', 'music', 'film',
  'performance', 'sports', 'fitness', 'gaming', 'culture', 'faith', 'wellness', 'study-group', 'research'
];

// Tags containing any of these are dropped.
const BLOCKED = ['fuck', 'shit', 'bitch', 'asshole', 'cunt', 'porn', 'nazi', 'nigg', 'fag'];

// Turns what an officer typed ("Coding, #Networking") or a saved list into a clean list of tags:
// lowercase, no #, no duplicates, no blocked words, at most 6 tags of up to 20 characters each.
export function parseTags(value) {
  const parts = Array.isArray(value) ? value : String(value || '').split(',');
  const tags = [];
  parts.forEach((p) => {
    const t = String(p).trim().replace(/^#+/, '').toLowerCase().slice(0, 20);
    if (t && !tags.includes(t) && !BLOCKED.some((w) => t.includes(w))) tags.push(t);
  });
  return tags.slice(0, 6);
}
