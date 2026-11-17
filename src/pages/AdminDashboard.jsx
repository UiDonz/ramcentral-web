import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  listenToAllClubsForStaff,
  listenToPendingClubs,
  approveClubApplication,
  denyClubApplication,
  archiveClub,
  unarchiveClub,
  recomputeMajorStats,
  importCampusClubs
} from '../services/clubs';
import {
  listenToPendingBudgetRequests,
  listenToPendingRoomBookings,
  decideBudgetRequest,
  decideRoomBooking,
  listenToAuditLog,
  getUserLabels,
  listenToCampusBudget,
  setCampusBudget,
  getQuickStats
} from '../services/admin';
import { listenToOpenReports, resolveReport } from '../services/reports';
import { listenToPendingTrips } from '../services/clubPaperwork';
import { listenToAllSpend, allocationOf, committedAmount } from '../services/clubMoney';
import { spendWarnings, categoryTotals, categoryOf } from '../data/moneyRules';
import { listenToEventsInRange } from '../services/events';
import { EVENTS_PER_SEMESTER, semesterWindow } from '../data/eventRules';
import { toDate } from '../utils/semester';
import { Chip, money } from '../components/money/SpendBits';
import { SpendApprovalCard, StaffFinanceTab } from '../components/money/StaffMoney';
import { ClubApplicationCard, TripReviewCard, ReregReviewCard } from '../components/paperwork/AdminReview';
import { listenToAllRereg, listenToSubmittedRereg } from '../services/reregistration';
import { listenToPendingStaffRequests, decideStaffRequest } from '../services/staffRequests';
import { needsReregistration, activeReregTerm, lastClosedRereg } from '../data/clubRequirements';

function StatTile({ label, value }) {
  return (
    <div className="stat-tile">
      <div className="stat-tile-value">{value}</div>
      <div className="stat-tile-label">{label}</div>
    </div>
  );
}

function formatWhen(ts) {
  if (!ts) return '...';
  const ms = ts.seconds != null ? ts.seconds * 1000 : ts;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

// Staff-only "God mode" dashboard - reachable at /admin, gated by
// StaffRoute (role === 'faculty'). Every mutation below goes through
// services/clubs.js or services/admin.js, which each carry their own
// RBAC guard (assertPermission(isStaff(actor), ...)) and their own
// audit-log write, so this component itself never touches Firestore
// directly - it only decides what to show and which service function
// to call.
export default function AdminDashboard() {
  const { profile } = useAuth();
  // role must travel with the actor - isStaff(actor) checks
  // actor.role === 'faculty', so omitting it makes every Staff check
  // fail even for a genuine faculty account.
  const actor = { uid: profile?.uid, name: profile?.name, role: profile?.role };

  const [allClubs, setAllClubs] = useState([]);
  const [pendingClubs, setPendingClubs] = useState([]);
  const [pendingBudget, setPendingBudget] = useState([]);
  const [pendingRooms, setPendingRooms] = useState([]);
  const [pendingTrips, setPendingTrips] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [openReports, setOpenReports] = useState([]);
  const [budget, setBudget] = useState({ total: 0, remaining: 0 });
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [budgetInput, setBudgetInput] = useState('');
  const [statsMessage, setStatsMessage] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [confirmImport, setConfirmImport] = useState(false);
  const [tab, setTab] = useState('overview');
  const [spend, setSpend] = useState([]);
  const [semEvents, setSemEvents] = useState([]);
  const [reregs, setReregs] = useState([]);
  const [submittedRereg, setSubmittedRereg] = useState([]);
  const [userLabels, setUserLabels] = useState({});
  const [staffRequests, setStaffRequests] = useState([]);
  const [onlyNeedsRereg, setOnlyNeedsRereg] = useState(false);

  useEffect(() => listenToAllClubsForStaff(setAllClubs), []);
  useEffect(() => listenToPendingClubs(setPendingClubs), []);
  useEffect(() => listenToPendingBudgetRequests(setPendingBudget), []);
  useEffect(() => listenToPendingRoomBookings(setPendingRooms), []);
  useEffect(() => listenToPendingTrips(setPendingTrips), []);
  // Lists only one tab uses are loaded while that tab is open, to save Firestore reads.
  const needsAudit = tab === 'overview' || tab === 'audit';
  useEffect(() => (needsAudit ? listenToAuditLog(setAuditLog) : undefined), [needsAudit]);
  // Member targets are stored as a user id (or clubId/userId); look up names to show instead.
  useEffect(() => {
    const uids = auditLog
      .filter((e) => e.targetType === 'member' && e.target)
      .map((e) => e.target.split('/').pop());
    if (uids.length === 0) return undefined;
    let active = true;
    getUserLabels(uids).then((labels) => {
      if (active) setUserLabels((prev) => ({ ...prev, ...labels }));
    });
    return () => {
      active = false;
    };
  }, [auditLog]);
  useEffect(() => listenToSubmittedRereg(setSubmittedRereg, () => setSubmittedRereg([])), []);
  useEffect(() => (tab === 'clubs' ? listenToAllRereg(setReregs, () => setReregs([])) : undefined), [tab]);
  useEffect(() => listenToPendingStaffRequests(setStaffRequests, () => setStaffRequests([])), []);
  // Every club's events this semester, to show how many each club has held.
  useEffect(() => {
    if (tab !== 'clubs') return undefined;
    const sem = semesterWindow();
    if (!sem.inSession) return undefined;
    return listenToEventsInRange(sem.start, sem.end, setSemEvents, () => setSemEvents([]));
  }, [tab]);
  useEffect(() => listenToAllSpend(setSpend, () => setError('Could not load spending requests.')), []);
  useEffect(
    () => listenToOpenReports(setOpenReports, () => setError('Could not load message reports.')),
    []
  );
  useEffect(() => listenToCampusBudget(setBudget), []);

  // The two "Quick Stats" counts that don't need to update live to the
  // second (active clubs, student count) are pulled with a cheap
  // aggregation query rather than kept as their own listener - this
  // just re-pulls them whenever the live club list changes, which is a
  // reasonable proxy for "something on campus changed."
  useEffect(() => {
    getQuickStats()
      .then(setStats)
      .catch((err) => setError(err.message));
  }, [allClubs.length]);

  async function handle(fn, ...args) {
    setError(null);
    try {
      await fn(...args);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSetBudget(e) {
    e.preventDefault();
    if (!budgetInput) return;
    await handle(setCampusBudget, Number(budgetInput), actor);
    setBudgetInput('');
  }

  async function handleRecomputeMajorStats() {
    // Reads every member of every club, so it costs a lot of the daily Firestore quota.
    if (!window.confirm('This reads every member of every club and uses a lot of the daily database quota. Run it now?')) return;
    setError(null);
    setStatsMessage('Recomputing...');
    try {
      const { clubsUpdated } = await recomputeMajorStats(actor);
      setStatsMessage(`Done - refreshed major stats for ${clubsUpdated} clubs.`);
    } catch (err) {
      setStatsMessage('');
      setError(err.message);
    }
  }

  async function handleImportClubs() {
    setError(null);
    setConfirmImport(false);
    setImportMessage('Importing...');
    try {
      const { created, skipped } = await importCampusClubs(actor);
      setImportMessage(`Done - added ${created} clubs (${skipped} already existed).`);
    } catch (err) {
      setImportMessage('');
      setError(err.message);
    }
  }

  const newSpend = spend.filter((r) => r.status === 'requested');
  const clubById = Object.fromEntries(allClubs.map((c) => [c.id, c]));
  // What an audit entry was done to, in words: a member's name, RAM ID and club instead of raw ids.
  function auditTarget(e) {
    if (!e.target) return '';
    if (e.targetType === 'member') {
      const parts = e.target.split('/');
      const who = userLabels[parts[parts.length - 1]] || 'Loading...';
      const club = parts.length > 1 ? clubById[parts[0]]?.name : null;
      return club ? `${who} in ${club}` : who;
    }
    return e.targetType ? `${e.targetType}: ${e.target}` : e.target;
  }
  // Re-registration: what's waiting on Staff, and each club's renewal status.
  const approvedTermsByClub = {};
  reregs
    .filter((r) => r.status === 'approved')
    .forEach((r) => {
      (approvedTermsByClub[r.clubId] = approvedTermsByClub[r.clubId] || new Set()).add(r.term);
    });
  const currentTerm = activeReregTerm();
  const lastTerm = lastClosedRereg();
  function reregCell(c) {
    if (needsReregistration(c, approvedTermsByClub[c.id] || new Set()))
      return <span className="status-pill status-archived">Needs re-registration</span>;
    const r = currentTerm && reregs.find((x) => x.clubId === c.id && x.term === currentTerm.id);
    if (r) {
      const label = { draft: 'In progress', submitted: 'Waiting for you', approved: 'Approved', returned: 'Sent back' }[r.status];
      return (
        <span className={`status-pill status-${r.status === 'approved' ? 'active' : 'pending'}`}>
          {currentTerm.termLabel}: {label}
        </span>
      );
    }
    if (lastTerm && (approvedTermsByClub[c.id]?.has(lastTerm.term.id) || c.lastReregTerm === lastTerm.term.id))
      return <span className="status-pill status-active">{lastTerm.term.label}: Approved</span>;
    return <span className="pw-sub">-</span>;
  }
  const pendingApprovalsTotal =
    staffRequests.length +
    submittedRereg.length +
    pendingClubs.length +
    pendingBudget.length +
    pendingRooms.length +
    pendingTrips.length +
    newSpend.length;
  // Finance tab badge: things Staff still have to do on money that is
  // already approved (place an order, check receipts, send a payment).
  const financeWaiting = spend.filter(
    (r) =>
      (r.status === 'approved' && r.payMethod !== 'reimburse') ||
      r.status === 'receipts' ||
      r.status === 'processing'
  ).length;
  // Left across clubs: every active club's yearly amount minus what it has
  // asked for or spent (denied requests don't count).
  const leftAcrossClubs = allClubs
    .filter((cl) => cl.status === 'active')
    .reduce((n, cl) => n + allocationOf(cl) - committedAmount(spend.filter((r) => r.clubId === cl.id)), 0);

  // The first four things waiting, for the Overview tab.
  const attention = [
    ...pendingClubs.map((cl) => ({
      key: `c${cl.id}`,
      kind: 'Club',
      title: cl.name,
      sub: 'New club application',
      btn: 'Review paperwork'
    })),
    ...newSpend.map((r) => {
      const mine = spend.filter((x) => x.clubId === r.clubId);
      return {
        key: `s${r.id}`,
        kind: 'Spending',
        title: `${r.clubName}: ${money(r.amount)} for ${(categoryOf(r.category)?.label || r.category).toLowerCase()}`,
        sub: `${r.item}${r.requestedByName ? ` · filed by ${r.requestedByName}` : ''}`,
        chips: spendWarnings({
          amount: r.amount,
          category: r.category,
          neededBy: r.neededBy,
          allocation: allocationOf(clubById[r.clubId]),
          committedOthers: committedAmount(mine, r.id),
          categoryUsedOthers: categoryTotals(mine, r.id)[r.category] || 0,
          payMethod: r.payMethod,
          eventType: r.eventType
        }),
        btn: 'Review'
      };
    }),
    ...pendingTrips.map((t) => ({
      key: `t${t.id}`,
      kind: 'Trip',
      title: t.clubName || 'Trip request',
      sub: 'Off-campus trip request',
      btn: 'Review'
    })),
    ...pendingBudget.map((r) => ({
      key: `b${r.id}`,
      kind: 'Funds',
      title: `${r.clubName}: $${r.amount}`,
      sub: r.reason || 'Extra funds request',
      btn: 'Review'
    })),
    ...pendingRooms.map((r) => ({
      key: `r${r.id}`,
      kind: 'Room',
      title: r.clubName,
      sub: `Room booking: ${r.room}`,
      btn: 'Review'
    }))
  ].slice(0, 4);
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'approvals', label: 'Approvals', badge: pendingApprovalsTotal },
    { id: 'clubs', label: 'Clubs' },
    { id: 'finance', label: 'Finance', badge: financeWaiting },
    { id: 'reports', label: 'Reports', badge: openReports.length },
    { id: 'audit', label: 'Audit trail' }
  ];

  return (
    <div className="page admin-page">
      <div className="page-header">
        <div>
          <h1>Command Center</h1>
          <p className="page-subtitle">
            Staff-only campus-wide controls: quick stats, the approval queue, the master club directory, and
            the audit trail.
          </p>
        </div>
      </div>

      <div className="tab-bar" role="tablist" aria-label="Command Center sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`tab-btn${tab === t.id ? ' selected' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.badge > 0 && (
              <span className="tab-badge" aria-label={`${t.badge} waiting`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && <p className="form-error">{error}</p>}

      {tab === 'overview' && (
        <section className="detail-section">
          <h2>Quick Stats</h2>
          <div className="stat-tile-row">
            <StatTile label="Active clubs" value={stats ? stats.activeClubs : '...'} />
            <StatTile label="Pending approvals" value={pendingApprovalsTotal} />
            <StatTile label="Open message reports" value={openReports.length} />
            <StatTile label="Students" value={stats ? stats.studentCount : '...'} />
            <StatTile label="Left across clubs" value={money(leftAcrossClubs)} />
          </div>
          {/* Nothing seeds settings/budget on its own - this is the one
           control that puts a real number in "Remaining budget" above,
           either the first time (seeding it) or any time Staff wants to
           reset the campus-wide total for a new period. Resets
           "remaining" to the new total rather than adding to it - see
           setCampusBudget in services/admin.js. */}
          <form onSubmit={handleSetBudget} className="inline-form">
            <label>
              Set total campus budget (resets remaining to this amount)
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder={`Current: $${(budget.total ?? 0).toLocaleString()}`}
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
              />
            </label>
            <button type="submit">Set budget</button>
          </form>
        </section>
      )}

      {tab === 'overview' && (
        <div className="overview-grid">
          <section className="detail-section">
            <h2>Needs your attention</h2>
            <p className="page-subtitle">
              The first four items in the queue.{' '}
              <button type="button" className="link-button" onClick={() => setTab('approvals')}>
                Open the full queue
              </button>
            </p>
            {attention.length === 0 && <p className="empty-state">Nothing waiting on approval.</p>}
            {attention.map((a) => (
              <div key={a.key} className="attention-item">
                <div className="attention-title">
                  <span className="kind-chip">{a.kind}</span> {a.title}
                </div>
                <div className="spend-meta">{a.sub}</div>
                {a.chips && a.chips.length > 0 && (
                  <div className="chip-row">
                    {a.chips.map((ch) => (
                      <Chip key={ch.text} ok={ch.ok}>
                        {ch.text}
                      </Chip>
                    ))}
                  </div>
                )}
                <div className="form-actions" style={{ marginTop: '0.6em' }}>
                  <button type="button" onClick={() => setTab('approvals')}>
                    {a.btn}
                  </button>
                </div>
              </div>
            ))}
          </section>
          <section className="detail-section">
            <h2>Recent activity</h2>
            <p className="page-subtitle">The last five Staff actions.</p>
            {auditLog.length === 0 && <p className="empty-state">No actions logged yet.</p>}
            {auditLog.slice(0, 5).map((e) => (
              <div key={e.id} className="activity-item">
                <div>
                  {e.action}
                  {e.target ? `: ${auditTarget(e)}` : ''}
                </div>
                <div className="spend-meta">
                  {e.actorName} &middot; {formatWhen(e.timestamp)}
                </div>
              </div>
            ))}
          </section>
        </div>
      )}

      {tab === 'approvals' && (
        <section className="detail-section">
          <h2>Action Queue</h2>
          {pendingApprovalsTotal === 0 && <p className="empty-state">Nothing waiting on approval.</p>}

          {/* Each application shows the paperwork the club attached, and
       Approve/Deny go through services/clubPaperwork.js (which wraps
       the same approveClubApplication/denyClubApplication as before
       and adds the roster invitations / denial reason). */}
          {pendingClubs.map((c) => (
            <ClubApplicationCard key={c.id} club={c} actor={actor} onError={setError} />
          ))}

          {/* People who signed up as Staff: approve gives them the Admin tab,
              deny keeps them as a Student account. */}
          {staffRequests.map((r) => (
            <div key={r.id} className="queue-item staff-request">
              <div>
                <strong>Staff access request:</strong> {r.name || 'New account'} ({r.email})
                {r.createdAt?.seconds && (
                  <span className="pw-sub"> · {new Date(r.createdAt.seconds * 1000).toLocaleDateString()}</span>
                )}
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => handle(decideStaffRequest, r, true, actor)}>
                  Approve
                </button>
                <button type="button" className="secondary" onClick={() => handle(decideStaffRequest, r, false, actor)}>
                  Deny
                </button>
              </div>
            </div>
          ))}

          {submittedRereg.map((r) => (
            <ReregReviewCard key={r.id} rr={r} actor={actor} onError={setError} />
          ))}

          {newSpend.map((r) => (
            <SpendApprovalCard
              key={r.id}
              r={r}
              club={clubById[r.clubId]}
              allSpend={spend}
              actor={actor}
              onError={setError}
            />
          ))}

          {pendingTrips.map((t) => (
            <TripReviewCard key={t.id} request={t} actor={actor} onError={setError} />
          ))}

          {pendingBudget.map((r) => (
            <div key={r.id} className="member-row">
              <span>
                Budget request: <strong>{r.clubName}</strong> &mdash; ${r.amount}
                {r.reason ? ` (${r.reason})` : ''}
              </span>
              <button onClick={() => handle(decideBudgetRequest, r.id, true, actor)}>Approve</button>
              <button className="secondary" onClick={() => handle(decideBudgetRequest, r.id, false, actor)}>
                Deny
              </button>
            </div>
          ))}
          {pendingRooms.map((r) => (
            <div key={r.id} className="member-row">
              <span>
                Room booking: <strong>{r.clubName}</strong> &mdash; {r.room}
                {r.dateTime ? `, ${formatWhen(r.dateTime)}` : ''}
              </span>
              <button onClick={() => handle(decideRoomBooking, r.id, true, actor)}>Approve</button>
              <button className="secondary" onClick={() => handle(decideRoomBooking, r.id, false, actor)}>
                Deny
              </button>
            </div>
          ))}
        </section>
      )}

      {tab === 'reports' && (
        <section className="detail-section">
          <h2>Reported Messages</h2>
          <p className="page-subtitle">
            Club chat messages members have reported. Mark one reviewed once you've dealt with it, or
            dismiss it if nothing's wrong - either way it leaves this list and is logged in the Audit Trail.
          </p>
          {openReports.length === 0 && <p className="empty-state">No open reports.</p>}
          {openReports.map((r) => (
            <div key={r.id} className="report-card">
              <div className="report-card-meta">
                <span className="badge">{r.reason}</span>
                <Link to={`/clubs/${r.clubId}`}>{r.clubName || 'Club'}</Link>
                <span>{formatWhen(r.createdAt)}</span>
              </div>
              <blockquote className="report-card-quote">{r.messageText}</blockquote>
              <div className="report-card-people">
                Sent by <strong>{r.messageAuthorName}</strong> &middot; reported by {r.reporterName}
              </div>
              <div className="form-actions">
                <button onClick={() => handle(resolveReport, r.id, 'reviewed', actor, r)}>
                  Mark reviewed
                </button>
                <button
                  className="secondary"
                  onClick={() => handle(resolveReport, r.id, 'dismissed', actor, r)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === 'clubs' && (
        <section className="detail-section">
          <h2>Master Club Directory</h2>
          {/* One-time backfill after the major-recommendations feature ships
      (existing members predate the counters), and a repair tool if
      the counters ever drift. */}
          <div className="form-actions" style={{ marginBottom: '0.8em' }}>
            <button type="button" className="secondary" onClick={handleRecomputeMajorStats}>
              Recompute major stats
            </button>
            {statsMessage && <span className="badge">{statsMessage}</span>}
          </div>
          {/* Adds every club on the Farmingdale list that isn't already here
      as an active, officer-less club. Two clicks (button, then
      confirm) because it creates dozens of documents. */}
          <div className="form-actions" style={{ marginBottom: '0.8em' }}>
            {!confirmImport ? (
              <button type="button" className="secondary" onClick={() => setConfirmImport(true)}>
                Import Farmingdale club list
              </button>
            ) : (
              <>
                <button type="button" onClick={handleImportClubs}>
                  Yes, add all missing clubs
                </button>
                <button type="button" className="secondary" onClick={() => setConfirmImport(false)}>
                  Cancel
                </button>
              </>
            )}
            {importMessage && <span className="badge">{importMessage}</span>}
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={onlyNeedsRereg}
              onChange={(e) => setOnlyNeedsRereg(e.target.checked)}
            />
            Only clubs that need re-registration
          </label>
          {/* Scrolls inside its own box so 60+ clubs don't make the page endless. */}
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Members</th>
                  <th>Events held this semester</th>
                  <th>Re-registration</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...allClubs]
                  .filter((c) => !onlyNeedsRereg || needsReregistration(c, approvedTermsByClub[c.id] || new Set()))
                  .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                  .map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link to={`/clubs/${c.id}`}>{c.name}</Link>
                      </td>
                      <td>
                        <span className={`status-pill status-${c.status}`}>{c.status}</span>
                      </td>
                      <td>{c.memberCount || 0}</td>
                      <td>
                        {(() => {
                          if (!semesterWindow().inSession) return 'Summer break';
                          const n = semEvents.filter(
                            (e) => e.clubId === c.id && toDate(e.dateTime) <= new Date()
                          ).length;
                          return (
                            <span
                              className={n >= EVENTS_PER_SEMESTER ? 'pw-ok' : n === 0 ? 'pw-needed' : ''}
                            >
                              {n} of {EVENTS_PER_SEMESTER}
                            </span>
                          );
                        })()}
                      </td>
                      <td>{reregCell(c)}</td>
                      <td>
                        {c.status === 'active' && (
                          <button className="link-button" onClick={() => handle(archiveClub, c.id, actor)}>
                            Archive
                          </button>
                        )}
                        {(c.status === 'archived' || c.status === 'pending') && (
                          <button
                            className="link-button"
                            onClick={() => handle(unarchiveClub, c.id, actor)}
                          >
                            {c.status === 'pending' ? 'Force active' : 'Restore'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                {allClubs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      No clubs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'finance' && (
        <StaffFinanceTab spend={spend} clubs={allClubs} actor={actor} onError={setError} />
      )}

      {tab === 'audit' && (
        <section className="detail-section">
          <h2>Audit Trail</h2>
          {auditLog.length === 0 ? (
            <p className="empty-state">No administrative actions logged yet.</p>
          ) : (
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Target</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatWhen(entry.timestamp)}</td>
                      <td>{entry.actorName}</td>
                      <td>{entry.action}</td>
                      <td>
                        {auditTarget(entry) || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
