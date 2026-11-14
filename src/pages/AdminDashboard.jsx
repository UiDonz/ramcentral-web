
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
  recomputeMajorStats
} from '../services/clubs';

import {
  listenToPendingBudgetRequests,
  listenToPendingRoomBookings,
  decideBudgetRequest,
  decideRoomBooking,
  listenToAuditLog,
  listenToCampusBudget,
  setCampusBudget,
  getQuickStats
} from '../services/admin';

function StatTile({ label, value }) {
  return (
    <div className="stat-tile">
      <h2>{value}</h2>
      <p>{label}</p>
    </div>
  );
}

function formatWhen(ts) {
  if (!ts) return '...';

  const ms = ts.seconds != null ? ts.seconds * 1000 : ts;
  const d = new Date(ms);

  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
}

export default function AdminDashboard() {
  const { profile } = useAuth();

  const actor = {
    uid: profile?.uid,
    name: profile?.name,
    role: profile?.role
  };

  const [allClubs, setAllClubs] = useState([]);
  const [pendingClubs, setPendingClubs] = useState([]);
  const [pendingBudget, setPendingBudget] = useState([]);
  const [pendingRooms, setPendingRooms] = useState([]);
  const [auditLog, setAuditLog] = useState([]);

  const [budget, setBudget] = useState({
    total: 0,
    remaining: 0
  });

  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [budgetInput, setBudgetInput] = useState('');
  const [statsMessage, setStatsMessage] = useState('');

  useEffect(() => listenToAllClubsForStaff(setAllClubs), []);
  useEffect(() => listenToPendingClubs(setPendingClubs), []);
  useEffect(() => listenToPendingBudgetRequests(setPendingBudget), []);
  useEffect(() => listenToPendingRoomBookings(setPendingRooms), []);
  useEffect(() => listenToAuditLog(setAuditLog), []);
  useEffect(() => listenToCampusBudget(setBudget), []);

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

  const pendingApprovalsTotal =
    pendingClubs.length +
    pendingBudget.length +
    pendingRooms.length;

  return (
    <div className="admin-dashboard">

      <h1>Command Center</h1>

      <p>
        Staff-only campus-wide controls: quick stats, the approval
        queue, the master club directory, and the audit trail.
      </p>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Quick Stats */}
      <section>
        <h2>Quick Stats</h2>

        <div className="stats-grid">
          <StatTile
            label="Active Clubs"
            value={stats?.activeClubs ?? 0}
          />

          <StatTile
            label="Total Students"
            value={stats?.studentCount ?? 0}
          />

          <StatTile
            label="Pending Approvals"
            value={pendingApprovalsTotal}
          />

          <StatTile
            label="Remaining Budget"
            value={`$${budget.remaining ?? 0}`}
          />
        </div>

        {/* Set Campus Budget */}
        <form onSubmit={handleSetBudget}>
          <label>
            Set total campus budget (resets remaining to this amount)
          </label>

          <input
            type="number"
            min="0"
            step="0.01"
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            placeholder="Enter total budget"
          />

          <button type="submit">
            Set Budget
          </button>
        </form>
      </section>

      {/* Action Queue */}
      <section>
        <h2>Action Queue</h2>

        {pendingApprovalsTotal === 0 && (
          <p>Nothing waiting on approval.</p>
        )}

        {/* Pending Club Applications */}
        {pendingClubs.map((c) => (
          <div key={c.id} className="queue-item">
            <p>
              New club application: <strong>{c.name}</strong>
              {' '}({c.category || 'General'})
            </p>

            <button
              onClick={() =>
                handle(approveClubApplication, c.id, actor)
              }
            >
              Approve
            </button>

            <button
              onClick={() =>
                handle(denyClubApplication, c.id, actor)
              }
            >
              Deny
            </button>
          </div>
        ))}

        {/* Pending Budget Requests */}
        {pendingBudget.map((r) => (
          <div key={r.id} className="queue-item">
            <p>
              Budget request: <strong>{r.clubName}</strong>
              {' '}— ${r.amount}
              {r.reason ? ` (${r.reason})` : ''}
            </p>

            <button
              onClick={() =>
                handle(decideBudgetRequest, r.id, true, actor)
              }
            >
              Approve
            </button>

            <button
              onClick={() =>
                handle(decideBudgetRequest, r.id, false, actor)
              }
            >
              Deny
            </button>
          </div>
        ))}

        {/* Pending Room Bookings */}
        {pendingRooms.map((r) => (
          <div key={r.id} className="queue-item">
            <p>
              Room booking: <strong>{r.clubName}</strong>
              {' '}— {r.room}
              {r.dateTime ? `, ${formatWhen(r.dateTime)}` : ''}
            </p>

            <button
              onClick={() =>
                handle(decideRoomBooking, r.id, true, actor)
              }
            >
              Approve
            </button>

            <button
              onClick={() =>
                handle(decideRoomBooking, r.id, false, actor)
              }
            >
              Deny
            </button>
          </div>
        ))}
      </section>

      {/* Master Club Directory */}
      <section>
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

           <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Members</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {allClubs.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.status}</td>
                <td>{c.memberCount || 0}</td>

                <td>
                  {c.status === 'active' && (
                    <button
                      onClick={() =>
                        handle(archiveClub, c.id, actor)
                      }
                    >
                      Archive
                    </button>
                  )}

                  {(c.status === 'archived' ||
                    c.status === 'pending') && (
                    <button
                      onClick={() =>
                        handle(unarchiveClub, c.id, actor)
                      }
                    >
                      {c.status === 'pending'
                        ? 'Force Active'
                        : 'Restore'}
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {allClubs.length === 0 && (
              <tr>
                <td colSpan="4">No clubs yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Audit Trail */}
      <section>
        <h2>Audit Trail</h2>

        {auditLog.length === 0 ? (
          <p>No administrative actions logged yet.</p>
        ) : (
          <table>
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
                    {entry.targetType
                      ? `${entry.targetType}: ${entry.target}`
                      : entry.target || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

    </div>
  );
}
