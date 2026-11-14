// Club recommendations. Pure functions (no Firestore calls) - they work
// entirely from the club docs the Home page already has in memory, using
// the majorCounts / majorSampleSize counters from Issue #58.
import { INTERESTS, majorShort } from '../data/profileOptions';

// A club's "most common majors" only mean something with a real sample:
// with 2 members, "50% CPIS" is one person. Below this many members who
// listed a major, a club never counts as a major match.
export const MIN_SAMPLE_SIZE = 3;
// Share of a club's (major-reporting) members a major must make up before
// that club is recommended to students in the same major.
export const MIN_SHARE = 0.25;
export const MAX_RECOMMENDATIONS = 6;

export const MAJOR_REASON = 'Liked by others in your major';
export const INTEREST_REASON = 'Matches your interests';



// [{ id, short, count, share }] sorted by share, biggest first.
export function majorBreakdown(club, limit = 3) {
  const counts = club.majorCounts || {};
  const total = club.majorSampleSize || 0;
  if (total <= 0) return [];
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([id, count]) => ({ id, short: majorShort(id), count, share: Math.min(count / total, 1) }))
    .sort((a, b) => b.share - a.share)
    .slice(0, limit);
}

export function formatShare(share) {
  return `${Math.round(share * 100)}%`;
}

function interestMatch(club, interestIds) {
  const text = `${club.category || ''} ${club.name || ''}`.toLowerCase();
  const hit = INTERESTS.find((i) => interestIds.includes(i.id) && i.keywords.some((k) => text.includes(k)));
  return hit ? hit.label : null;
}

// clubs: active clubs. majors/interests: the signed-in user's ids.
// joinedIds: Set of club ids they already belong to (never recommended).
// Returns [{ club, reason, detail, score }], best first.
export function recommendClubs({ clubs, majors = [], interests = [], joinedIds = new Set() }) {
  const results = [];
  for (const club of clubs) {
    if (joinedIds.has(club.id)) continue;

      let majorHit = null;
      if ((club.majorSampleSize || 0) >= MIN_SAMPLE_SIZE) {
        majorHit =
          majorBreakdown(club, 20).find((m) => majors.includes(m.id) && m.share >= MIN_SHARE) || null;
      }
      const interestHit = interestMatch(club, interests);
      if (!majorHit && !interestHit) continue;

      // A major match always outranks an interest-only match (score >= 1);
      // within each group, a bigger share / more members ranks higher.
      const score = (majorHit ? 1 + majorHit.share : 0) + (interestHit ? 0.25 : 0);
      results.push({
        club,
        reason: majorHit ? MAJOR_REASON : INTEREST_REASON,
        detail: majorHit ? `${formatShare(majorHit.share)} of members are ${majorHit.short} majors` : null,
        score
      });
    }
    results.sort((a, b) => b.score - a.score || (b.club.memberCount || 0) - (a.club.memberCount || 0));
    return results.slice(0, MAX_RECOMMENDATIONS);
}
