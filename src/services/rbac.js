// Shared role names and permission helpers for RBAC; the single source of truth so no file hardcodes a role string.
// The real enforcement is firestore.rules; these helpers hide/disable actions and fail fast with a clear
// "403 Forbidden: ..." message instead of a raw permission-denied.
// Club roles are ordered highest authority first; 'officer' is the legacy generic role and ranks one step below Vice President.
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
// Lower number = more authority. Secretary, Treasurer and the legacy 'officer' share a rank.
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
// True for any club role that isn't a plain member (these all get the day-to-day officer permissions).
export function isClubOfficerRole(role) {
return !!role && role !== 'member';
}
// Only the President or Co-President can promote, demote or reassign roles.
export function canManageRoles(actingMembership) {
return !!actingMembership && ['president', 'co_president'].includes(actingMembership.role);
}
// Assign any role at or below your own rank; only a President can hand out the Presidency (leadership transfer).
export function canAssignRole(actingMembership, targetRole) {
return canManageRoles(actingMembership) && rankOf(targetRole) >= rankOf(actingMembership.role);
}
// Staff / Super Admin is campus-wide, not a club role: faculty accounts ARE staff, and this is the one place that mapping lives.
export function isStaff(profile) {
return profile?.role === 'faculty';
}
// Who sees the "Club Finances" panel: the Treasurer, plus the President and Co-President for oversight.
const CLUB_FINANCE_ROLES = ['treasurer', 'president', 'co_president'];
export function canViewClubFinances(role) {
return !!role && CLUB_FINANCE_ROLES.includes(role);
}
// Filing a budget request or logging an expense is Treasurer-only; the President/Co-President can view but not disburse.
export function canManageClubFinances(role) {
return role === 'treasurer';
}
// Event/room logistics belong to the executive officers (President, Co-President, Vice President).
const CLUB_LOGISTICS_ROLES = ['president', 'co_president', 'vice_president'];
export function canManageLogistics(role) {
return !!role && CLUB_LOGISTICS_ROLES.includes(role);
}
// Thrown when a client-side permission check fails; written as a "403 Forbidden: ..." sentence that callers show directly.
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