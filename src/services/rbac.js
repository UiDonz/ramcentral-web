// Shared role vocabulary + permission helpers for RBAC across the app.
// This file is the single source of truth for role names/labels so
// clubs.js, admin.js, ClubDetail.jsx, and AdminDashboard.jsx never
// hardcode a role string independently.
//
// The real enforcement boundary is still firestore.rules - a client can
// always be tricked into calling a function it shouldn't, but Firestore
// itself can't. The helpers here exist for a friendlier layer on top of
// that: hide/disable actions a user can't perform, and fail fast with a
// clear "403 Forbidden: ..." message instead of a confusing raw
// permission-denied bubbling up from a rejected write.
// Club-scoped officer roles, ordered highest-authority first. 'officer'
// is kept for backward compatibility with membership docs written
// before this hierarchy existed (Sprint 1/2's promoteToOfficer()
// default) - it's treated as a generic mid-level officer wherever rank
// matters, one rung below Vice President.
export const CLUB_ROLES = [
'president',
'co_president',
'vice_president',
'secretary',
'treasurer',
'officer',
'member'
];
export const CLUB_ROLE_LABELS = {
president: 'President',
co_president: 'Co-President',
vice_president: 'Vice President',
secretary: 'Secretary',
treasurer: 'Treasurer',
officer: 'Officer',
member: 'Member'
};
// Lower number = more authority. Secretary/Treasurer/the legacy generic
// "officer" all sit at the same rank - they're peers under the VP, not
// ranked against each other.
const RANK = {
president: 0,
co_president: 1,
vice_president: 2,
secretary: 3,
treasurer: 3,
officer: 3,
member: 4
};
export function rankOf(role) {
return RANK[role] ?? RANK.member;
}
// True for any club-scoped role that isn't a plain member - used
// wherever the app previously checked `role in ['president', 'officer']`,
// so Secretary/Treasurer/VP/Co-President all get the same day-to-day
// officer permissions (posting announcements, creating events,
// approving join requests) that a generic 'officer' always had.
export function isClubOfficerRole(role) {
return !!role && role !== 'member';
}
// Only the club's President or Co-President can promote, demote, or
// reassign roles. A Secretary or Treasurer is still "an officer" for
// day-to-day permissions, but role management stays at the top of the
// club's own hierarchy so two co-equal officers can't demote each other
// in a tug of war, and so a random officer can't quietly hand
// themselves the presidency.
export function canManageRoles(actingMembership) {
return !!actingMembership && ['president', 'co_president'].includes(actingMembership.role);
}
// A President/Co-President can assign any role at or below their own
// rank - a Co-President (rank 1) can't hand out the Presidency (rank 0),
// but a President (rank 0) can reassign any role, including the
// Presidency itself (rank 0 >= 0), which is how a club transfers
// leadership to someone else.
export function canAssignRole(actingMembership, targetRole) {
return canManageRoles(actingMembership) && rankOf(targetRole) >= rankOf(actingMembership.role);
}
// Staff / Super Admin is not a club-scoped role - it's the campus-wide
// "God mode" role from the top-level users collection. Per team
// decision, faculty accounts ARE staff: there's no separate self-serve
// staff signup, and the app already separates 'student' from 'faculty'
// at signup (see AuthContext.signup), so this is the one place that
// mapping lives rather than repeating `profile.role === 'faculty'`
// (or worse, a fourth role value) all over the codebase.
export function isStaff(profile) {
return profile?.role === 'faculty';
}
// Club-level financial visibility - who gets the "Club Finances" panel
// on a club's page (budget received/spent, request history, logging an
// expense, filing a new request). Mirrors how a real college club runs
// its books: the Treasurer keeps them day to day, and the President/
// Co-President - ultimately accountable for the club to Staff and to
// their own members - can see and use them too. Vice President,
// Secretary, a legacy generic 'officer', and plain members do NOT get
// this panel; that's a deliberate choice, not an oversight, to match
// "only certain roles have club budget data."
const CLUB_FINANCE_ROLES = ['treasurer', 'president', 'co_president'];
export function canViewClubFinances(role) {
return !!role && CLUB_FINANCE_ROLES.includes(role);
}
// Narrower than canViewClubFinances above: actually filing a budget
// request or logging an expense (a real disbursement/ask for money) is
// Treasurer-only. "Full control over the ledger... draft semester
// budget requests" is specifically the Treasurer's job in a real club,
// while the President/Co-President can still see everything (oversight/
// sign-off, via canViewClubFinances) but cannot themselves log an
// expense or file a request - matching "President cannot unilaterally
// disburse funds without Treasurer verification."
export function canManageClubFinances(role) {
return role === 'treasurer';
}
// Event/room logistics ("submit event room reservations and logistics
// paperwork") sits with a club's executive officers - President,
// Co-President, and especially Vice President, whose day-to-day role is
// overseeing events and logistics - not the Treasurer (who "cannot book
// campus rooms") or the Secretary (who cannot "submit room reservation
// contracts independently").
const CLUB_LOGISTICS_ROLES = ['president', 'co_president', 'vice_president'];
export function canManageLogistics(role) {
return !!role && CLUB_LOGISTICS_ROLES.includes(role);
}
// Thrown by write helpers when a client-side permission check fails
// before ever reaching Firestore. Callers catch this and show
// err.message directly - it's deliberately written as a plain
// "403 Forbidden: ..." sentence so it reads the same whether it came
// from here or (for anyone bypassing the UI) from a rejected Firestore
// write, without this app having an actual HTTP layer to return a real
// 403 from.
export class ForbiddenError extends Error {
constructor(message) {
super(message || '403 Forbidden: you do not have permission to do that.');
this.name = 'ForbiddenError';
this.code = 403;
}
}
export function assertPermission(condition, message) {
if (!condition) throw new ForbiddenError(message);
}