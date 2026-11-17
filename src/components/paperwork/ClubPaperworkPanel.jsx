import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listenToApplication,
  listenToClubAdvisorRequest,
  listenToClubInvites,
  listenToClubTrips,
  saveOfficers,
  saveRoster,
  saveConstitution,
  getConstitution,
  openStoredFile,
  fileToStoredDoc,
  requestAdvisor,
  cancelAdvisorRequest
} from '../../services/clubPaperwork';

import { canViewClubFinances } from '../../services/rbac';
import { CORE_OFFICERS, MIN_ROSTER, nextReregistration } from '../../data/clubRequirements';
import OfficerSheetModal from './OfficerSheetModal';
import RosterModal from './RosterModal';
import ConstitutionTemplateModal from './ConstitutionTemplateModal';
import AdvisorPickerModal from './AdvisorPickerModal';
import TrainingTable from './TrainingTable';
const kb = (n) => `${Math.max(1, Math.round((n || 0) / 1024))} KB`;
function when(ts) {
  if (!ts) return '';
  const ms = ts.seconds != null ? ts.seconds * 1000 : ts;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
// The paperwork section of a club's page. Only rendered for that club's
// officers and for Staff (ClubDetail decides), and firestore.rules enforce
// the same thing on the reads, so a plain member never receives this data.
export default function ClubPaperworkPanel({
  clubId,
  club,
  members,
  memberNames,
  myMembership,
  currentUser,
  profile,
  isStaffUser,
  isOfficer,
  actor
}) {
  const [application, setApplication] = useState(undefined); // undefined = loading, null = none
  const [advisorReq, setAdvisorReq] = useState(null);

  const [invites, setInvites] = useState([]);
  const [trips, setTrips] = useState([]);
  const [open, setOpen] = useState(null);
  const [showRoster, setShowRoster] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef(null);
  const canTrip = canViewClubFinances(myMembership?.role);
  const rereg = nextReregistration();
  useEffect(() => listenToApplication(clubId, setApplication, () => setApplication(null)), [clubId]);
  useEffect(() => listenToClubAdvisorRequest(clubId, setAdvisorReq, () => setAdvisorReq(null)), [clubId]);
  useEffect(() => listenToClubInvites(clubId, setInvites), [clubId]);
  useEffect(() => {
    if (!canTrip && !isStaffUser) return undefined;
    return listenToClubTrips(clubId, setTrips);
  }, [clubId, canTrip, isStaffUser]);
  async function run(fn) {
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    }
  }
  async function handleOpenConstitution() {
    await run(async () => {
      const stored = await getConstitution(clubId);
      if (!stored) throw new Error('No constitution file found.');
      openStoredFile(stored);
    });
  }
  async function handleReplaceFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    await run(async () => saveConstitution(clubId, await fileToStoredDoc(file), actor));
  }
  // Still loading, or a club with no paperwork that this person can't add
  // to (e.g. an imported club, seen by Staff): show nothing.
  if (application === undefined) return null;
  if (application === null && !isOfficer) return null;
  const invited = invites.filter((i) => i.status === 'invited').length;
  const joined = invites.filter((i) => i.status === 'joined').length;
  const declined = invites.filter((i) => i.status === 'declined').length;
  const roster = application?.roster || [];
  const officers = application?.officers;
  let advisorLine = <span className="pw-sub">No advisor chosen (optional).</span>;
  if (advisorReq) {
    if (advisorReq.status === 'accepted')
      advisorLine = (
        <span className="pw-ok">
          &#10003; {advisorReq.advisorName} accepted the Advisor Agreement
          {when(advisorReq.decidedAt)}
        </span>
      );
    else if (advisorReq.status === 'declined')
      advisorLine = (
        <span className="pw-needed">{advisorReq.advisorName} declined. Choose someone else.</span>
      );
    else
      advisorLine = (
        <span>
          Waiting for <strong>{advisorReq.advisorName}</strong> to accept. They'll see the request when they
          sign in.
        </span>
      );
  }
  return (
    <section className="detail-section pw-panel">
      <h2>
        Club paperwork{' '}
        <span className="pw-tag pw-tag-private">Only officers and Staff can see this</span>{' '}
      </h2>
      {club.status === 'archived' && club.denialReason && (
        <p className="form-error">This application was denied: {club.denialReason}</p>
      )}
      {error && <p className="form-error">{error}</p>}
      <div className="pw-list">
        <div className="pw-list-row">
          <div>
            <strong>Constitution</strong>
            <div className="pw-sub">
              {application?.constitution
                ? `${application.constitution.fileName} (${kb(application.constitution.size)})`
                : 'Not added yet'}
            </div>
          </div>
          <div className="pw-list-actions">
            {application?.constitution && (
              <button type="button" className="secondary" onClick={handleOpenConstitution}>
                Open
              </button>
            )}{' '}
            <button
              type="button"
              className="link-button"
              onClick={() => fileInput.current && fileInput.current.click()}
            >
              {' '}
              {application?.constitution ? 'Replace' : 'Attach'}
            </button>
            <button type="button" className="link-button" onClick={() => setOpen('template')}>
              Template
            </button>{' '}
          </div>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,image/*"
          hidden
          onChange={handleReplaceFile}
        />
        <div className="pw-list-row pw-col">
          <div className="pw-list-top">
            <div>
              <strong>Executive Board</strong>
              <div className="pw-sub">The Core 4 are required.</div>
            </div>
            <div className="pw-list-actions">
              <button type="button" className="link-button" onClick={() => setOpen('officers')}>
                {officers ? 'Edit' : 'Add'}
              </button>{' '}
            </div>
          </div>
          {officers && (
            <div className="pw-officer-table">
              {CORE_OFFICERS.map(({ key, label }) => (
                <div key={key}>
                  <span className="pw-role">{label}</span>
                  <span>{officers[key]?.name}</span>
                  <span className="pw-sub">
                    {officers[key]?.email} &middot; RAM ID {officers[key]?.ram}
                  </span>{' '}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="pw-list-row pw-col">
          <div className="pw-list-top">
            <div>
              <strong>Roster</strong>
              <div className="pw-sub">
                {roster.length > 0 ? `${roster.length} students (minimum ${MIN_ROSTER})` : 'Not added yet'}{' '}
                {invites.length > 0 &&
                  ` · ${joined} joined, ${invited} invited${
                    declined
                      ? `,
${declined} declined`
                      : ''
                  }`}{' '}
              </div>
            </div>
            <div className="pw-list-actions">
              {roster.length > 0 && (
                <button type="button" className="secondary" onClick={() => setShowRoster((s) => !s)}>
                  {showRoster ? 'Hide roster' : 'View roster'}
                </button>
              )}
              <button type="button" className="link-button" onClick={() => setOpen('roster')}>
                {roster.length > 0 ? 'Edit' : 'Add'}
              </button>{' '}
            </div>
          </div>
          {showRoster && (
            <div className="pw-roster-grid">
              {roster.map((r) => {
                const inv = invites.find((i) => i.email === r.email);
                return (
                  <div key={r.email}>
                    <span>{r.name}</span>
                    <span className="pw-sub">
                      {r.ram}
                      {inv &&
                        ` · ${inv.status === 'joined' ? 'joined' : inv.status === 'declined' ? 'declined' : 'invited'}`}{' '}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="pw-list-row">
          <div>
            <strong>
              Advisor <span className="pw-sub">(optional)</span>{' '}
            </strong>
            <div>{advisorLine}</div>
          </div>
          <div className="pw-list-actions">
            {advisorReq && advisorReq.status === 'pending' && (
              <button
                type="button"
                className="link-button"
                onClick={() => run(() => cancelAdvisorRequest(clubId))}
              >
                Cancel request
              </button>
            )}
            <button type="button" className="link-button" onClick={() => setOpen('advisor')}>
              {advisorReq ? 'Change' : 'Choose'}
            </button>{' '}
          </div>
        </div>
      </div>
      {roster.length > 0 && (
        <p className="pw-sub">
          Students added to the roster after the club was approved aren't invited automatically.
        </p>
      )}
      <h3>Officer trainings</h3>
      <p className="pw-hint">
        Farmingdale requires these after a club is approved. Do each one in Farmingdale's own system, then
        mark it done here. Staff can verify it.
      </p>
      <TrainingTable
        clubId={clubId}
        members={members}
        memberNames={memberNames}
        currentUser={currentUser}
        isStaffUser={isStaffUser}
        actor={actor}
      />
      <h3>Re-registration</h3>
      <div className="pw-card">
        <strong>{rereg.label}</strong>
        <p className="pw-hint">
          Every semester the president renews in RamCentral. The Core 4 officers finish their trainings and
          accept their position's Terms and Conditions. You also upload your current constitution, say
          whether your advisor changed, and submit a mission statement.
        </p>
      </div>
      {(canTrip || isStaffUser) && (
        <>
          <h3>Trips</h3>
          {canTrip && (
            <p>
              <Link className="pw-btn-link" to={`/clubs/${clubId}/trip`}>
                Request a trip
              </Link>
            </p>
          )}
          {trips.length === 0 && <p className="empty-state">No trip requests yet.</p>}
          {trips.map((t) => (
            <div key={t.id} className="member-row">
              <span>
                {t.trip?.destination || 'Trip'}
                {t.trip?.departure ? `, ${t.trip.departure}` : ''}
                {t.status === 'denied' && t.denialReason ? ` (denied: ${t.denialReason})` : ''}
              </span>
              <span
                className={`status-pill status-${t.status === 'pending' ? 'pending' : t.status === 'approved' ? 'active' : 'archived'}`}
              >
                {t.status}
              </span>
            </div>
          ))}
        </>
      )}
      {open === 'officers' && (
        <OfficerSheetModal
          initial={officers}
          defaults={
            isStaffUser ? undefined : { name: profile?.name, email: profile?.email, ram: profile?.ramId }
          }
          onSave={(o) => saveOfficers(clubId, o, actor)}
          onClose={() => setOpen(null)}
        />
      )}
      {open === 'roster' && (
        <RosterModal
          initial={roster}
          onSave={(r) => saveRoster(clubId, r, actor)}
          onClose={() => setOpen(null)}
        />
      )}
      {open === 'template' && (
        <ConstitutionTemplateModal clubName={club.name} onClose={() => setOpen(null)} />
      )}{' '}
      {' '}
      {open === 'advisor' && (
        <AdvisorPickerModal
          selectedUid={advisorReq?.advisorUid}
          excludeUid={currentUser.uid}
          onPick={(person) => requestAdvisor(clubId, club.name, person, actor)}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}
