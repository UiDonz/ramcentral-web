import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listenToApplication,
  listenToClubAdvisorRequest,
  getConstitution,
  openStoredFile,
  approveApplication,
  denyApplication,
  decideTrip,
  listenToTrainings
} from '../../services/clubPaperwork';
import { decideRereg, getReregConstitution } from '../../services/reregistration';
import { CORE_OFFICERS, MIN_ROSTER, EAF_TRANSACTIONS, TRIP_LIMITS, TRAININGS } from '../../data/clubRequirements';
function whenLong(v) {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}
// One pending club application in Staff's Action Queue, with everything the
// club attached. Approve stays off until Staff confirm the officers are
// eligible (registered for classes, in good standing) - that check lives
// with Student Activities, not in this app, so it's a deliberate tick-box.
// A pending club with NO paperwork (made before this feature, or created
// by an import) keeps the old behaviour: Approve works straight away.
export function ClubApplicationCard({ club, actor, onError }) {
  const [application, setApplication] = useState(undefined);
  const [advisorReq, setAdvisorReq] = useState(null);
  const [showRoster, setShowRoster] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [denying, setDenying] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => listenToApplication(club.id, setApplication, () => setApplication(null)), [club.id]);
  useEffect(() => listenToClubAdvisorRequest(club.id, setAdvisorReq, () => setAdvisorReq(null)), [club.id]);
  const hasPaperwork = !!(application && application.officers);
  const roster = application?.roster || [];
  const complete = hasPaperwork && roster.length >= MIN_ROSTER && !!application.constitution;
  const canApprove = !hasPaperwork || eligible;
  async function guarded(fn) {
    onError(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      onError(err.message);
    }
    setBusy(false);
  }
  async function openConstitution() {
    await guarded(async () => {
      const stored = await getConstitution(club.id);
      if (!stored) throw new Error('No constitution file found.');
      openStoredFile(stored);
    });
  }
  return (
    <div className="pw-review">
      <div className="pw-review-head">
        <span>
          New club application:{' '}
          <strong>
            <Link to={`/clubs/${club.id}`}>{club.name}</Link>
          </strong>{' '}
           ({club.category || 'General'}){' '}
        </span>
        {hasPaperwork && (
          <span className={`pw-tag ${complete ? 'pw-tag-ok' : 'pw-tag-req'}`}>
            {complete ? 'All required items attached' : 'Missing items'}
          </span>
        )}
        {application === null && <span className="pw-tag">No paperwork on file</span>}
      </div>
      {hasPaperwork && (
        <div className="pw-review-body">
          {/* The full Executive Board Data Sheet: role, name, FSC email and RAM ID,
              so Staff can verify each officer's standing. */}
          <div>
            <strong>Executive Board:</strong>
            <div className="pw-board-scroll">
              <table className="pw-board-table">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Name</th>
                    <th>FSC email</th>
                    <th>RAM ID</th>
                  </tr>
                </thead>
                <tbody>
                  {CORE_OFFICERS.map(({ key, label }) => {
                    const o = application.officers?.[key] || {};
                    return (
                      <tr key={key}>
                        <td>{label}</td>
                        <td>{(o.name || '').replace(/[,\s]+$/, '') || <span className="pw-needed">Missing</span>}</td>
                        <td>{o.email ? <span className="pw-copy">{o.email}</span> : <span className="pw-needed">Missing</span>}</td>
                        <td>{o.ram || <span className="pw-needed">Missing</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <strong>Roster:</strong> {roster.length} students (minimum {MIN_ROSTER}){' '}
            <button type="button" className="link-button" onClick={() => setShowRoster((s) => !s)}>
              {showRoster ? 'Hide list' : 'View list'}
            </button>
          </div>
          {showRoster && (
            <div className="pw-roster-grid">
              {roster.map((r) => (
                <div key={r.email}>
                  <span>{r.name}</span>
                  <span className="pw-sub">
                    {r.ram} &middot; {r.email}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div>
            <strong>Constitution:</strong>{' '}
            {application.constitution ? (
              <>
                {application.constitution.fileName}{' '}
                <button type="button" className="link-button" onClick={openConstitution}>
                  Open
                </button>
              </>
            ) : (
              <span className="pw-needed">Missing</span>
            )}
          </div>
          <div>
            <strong>Advisor (optional):</strong>{' '}
            {advisorReq
              ? `${advisorReq.advisorName}: ${advisorReq.status === 'accepted' ? 'accepted the Advisor Agreement' : advisorReq.status === 'declined' ? 'declined' : 'waiting to accept'}`
              : 'None'}
          </div>
          <label className="checkbox-label">
            <input type="checkbox" checked={eligible} onChange={(e) => setEligible(e.target.checked)} />
            All four officers are registered for classes and in good academic and disciplinary standing
          </label>
        </div>
      )}
      <div className="form-actions">
        <button
          type="button"
          disabled={!canApprove || busy}
          onClick={() => guarded(() => approveApplication(club.id, actor))}
        >
          Approve
        </button>
        <button type="button" className="secondary" disabled={busy} onClick={() => setDenying((d) => !d)}>
          Deny
        </button>{' '}
        {!canApprove && <span className="pw-problem">Confirm the officer check first</span>}
      </div>
      {denying && (
        <div className="pw-deny">
          <label>
            Tell them why, so they can fix it and reapply
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. The roster needs 10 students with valid RAM IDs"
            />
          </label>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => guarded(() => denyApplication(club.id, actor, reason))}
          >
            Confirm deny
          </button>
        </div>
      )}
    </div>
  );
}
// One pending trip request: the trip, chaperone, transportation and the
// Expense Authorization Form. Student Activities add the liability waiver

// to the event in RamCentral themselves, so Approve stays off until Staff
// tick that they did.
export function TripReviewCard({ request, actor, onError }) {
  const t = request.trip || {};
  const eaf = request.eaf || {};
  const [waiver, setWaiver] = useState(false);
  const [denying, setDenying] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  async function guarded(fn) {
    onError(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      onError(err.message);
    }
    setBusy(false);
  }
  const perStudent =
    t.students > 0 ? (Number((eaf.amount || '').replace(/[^0-9.]/g, '')) || 0) / t.students : 0;
  return (
    <div className="pw-review">
      <div className="pw-review-head">
        <span>
          Trip request:{' '}
          <strong>
             <Link to={`/clubs/${request.clubId}`}>{request.clubName}</Link>
          </strong>{' '}
          &mdash; {t.destination}
        </span>{' '}
        <span className="pw-tag">Waiver: Staff adds on approval</span>
      </div>
      <div className="pw-review-body">
        <div>
          <strong>Trip:</strong> {whenLong(t.departure)} to {whenLong(t.returnTime)} &middot; {t.students}{' '}
          students {t.hotel ? ` · overnight at ${t.hotel}` : ''}
        </div>
        <div>
          <strong>Purpose:</strong> {t.purpose}
        </div>
        <div>
          <strong>Chaperone:</strong>{' '}
          {t.exemption
            ? 'Exemption requested (check the Chaperone Exemption Form in RamCentral)'
            : `${t.chaperone?.name} · ${t.chaperone?.email} ·
 ${t.chaperone?.phone}`}
        </div>
        <div>
          <strong>Transportation:</strong> {t.transport?.label}
          {t.transport?.drivers
            ? ` · ${t.transport.drivers} driver(s), Drivers Record Forms sent to University Police`
            : ''}{' '}
        </div>
        <div>
          <strong>Expense Authorization:</strong> {eaf.vendor} &middot; up to {eaf.amount}
          <div className="pw-sub">
            {EAF_TRANSACTIONS.find((x) => x.id === eaf.txn)?.label.split(':')[0]} &middot; {eaf.acct}{' '}
            (account {eaf.acctNo}) &middot; prepared by the {eaf.preparedBy} &middot; invoice
            {eaf.inv || 'N/A'}
          </div>
          <div className="pw-sub">{eaf.desc}</div>
          {perStudent > TRIP_LIMITS.perStudent && (
            <div className="pw-needed">
              About ${Math.round(perStudent)} per student, over the ${TRIP_LIMITS.perStudent} limit.
            </div>
          )}
        </div>
        <label className="checkbox-label">
          <input type="checkbox" checked={waiver} onChange={(e) => setWaiver(e.target.checked)} />
          The liability waiver was added to the event in RamCentral
        </label>
      </div>
      <div className="form-actions">
        <button
          type="button"
          disabled={!waiver || busy}
          onClick={() => guarded(() => decideTrip(request.id, true, { waiverAdded: waiver }, actor))}
        >
          Approve
        </button>
        <button type="button" className="secondary" disabled={busy} onClick={() => setDenying((d) => !d)}>
          Deny
        </button>{' '}
        {!waiver && <span className="pw-problem">Add the waiver first</span>}
      </div>
      {denying && (
        <div className="pw-deny">
          <label>
            Tell them why
            <input value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() =>
              guarded(() => decideTrip(request.id, false, { waiverAdded: false, reason }, actor))
            }
          >
            Confirm deny
          </button>
        </div>
      )}
    </div>
  );
}

// A club's semester re-registration, waiting in Staff's Action Queue.
export function ReregReviewCard({ rr, actor, onError }) {
  const [trainings, setTrainings] = useState({});
  const [sending, setSending] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => listenToTrainings(rr.clubId, setTrainings), [rr.clubId]);

  async function guarded(fn) {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      onError(err.message || 'Something went wrong.');
    }
    setBusy(false);
  }
  function trainingsLeft(uid) {
    const done = trainings[uid]?.done || {};
    return TRAININGS.filter((t) => !done[t.key]).length;
  }

  return (
    <div className="queue-item pw-review">
      <div>
        Re-registration: <Link to={`/clubs/${rr.clubId}`}>{rr.clubName}</Link> ({rr.termLabel})
      </div>
      <div className="pw-review-body">
        <div className="pw-board-scroll">
          <table className="pw-board-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Officer</th>
                <th>Terms</th>
                <th>Trainings</th>
              </tr>
            </thead>
            <tbody>
              {CORE_OFFICERS.map(({ key, label }) => {
                const o = rr.officers?.[key];
                const left = o ? trainingsLeft(o.uid) : null;
                return (
                  <tr key={key}>
                    <td>{label}</td>
                    <td>{o ? o.name : <span className="pw-needed">Missing</span>}</td>
                    <td>{rr.accepted?.[key] ? <span className="pw-ok">Accepted</span> : <span className="pw-needed">No</span>}</td>
                    <td>
                      {left === 0 ? (
                        <span className="pw-ok">All done</span>
                      ) : left != null ? (
                        <span className="pw-needed">{left} left</span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div>
          <strong>Constitution:</strong>{' '}
          {rr.constitutionChoice === 'new' ? (
            <>
              New: {rr.constitutionFile?.fileName || 'missing'}{' '}
              <button
                type="button"
                className="link-button"
                onClick={() =>
                  guarded(async () => {
                    const stored = await getReregConstitution(rr.id);
                    if (!stored) throw new Error('No file found.');
                    openStoredFile(stored);
                  })
                }
              >
                Open
              </button>
            </>
          ) : (
            'No changes (keeping the one on file)'
          )}
        </div>
        <div>
          <strong>Advisor:</strong>{' '}
          {rr.advisorChanged ? `Changed to ${rr.newAdvisor?.name} (${rr.newAdvisor?.email})` : 'Same advisor'}
        </div>
        <div>
          <strong>Mission statement:</strong> {rr.mission}
        </div>
        <div className="pw-sub">
          Submitted by {rr.submittedByName || 'the club'}
          {rr.submittedAt?.seconds ? ` on ${whenLong(rr.submittedAt.seconds * 1000)}` : ''}
        </div>
      </div>
      {sending ? (
        <div className="form-actions">
          <input
            placeholder="What the club needs to fix"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => guarded(() => decideRereg(rr, false, { reason }, actor))}
          >
            Send back
          </button>
          <button type="button" className="secondary" onClick={() => setSending(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="form-actions">
          <button type="button" disabled={busy} onClick={() => guarded(() => decideRereg(rr, true, {}, actor))}>
            Approve
          </button>
          <button type="button" className="secondary" disabled={busy} onClick={() => setSending(true)}>
            Send back
          </button>
        </div>
      )}
    </div>
  );
}
