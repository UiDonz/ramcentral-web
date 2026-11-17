import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getClub, getMembership } from '../services/clubs';
import { requestTrip } from '../services/clubPaperwork';

import { canViewClubFinances } from '../services/rbac';
import { TRANSPORT_MODES, TRIP_LIMITS, EAF_TRANSACTIONS } from '../data/clubRequirements';
import EafModal, { eafProblems } from '../components/paperwork/EafModal';
const EMPTY = {
  destination: '',

  departure: '',
  returnTime: '',
  students: '',
  purpose: '',
  hotel: '',
  chaperoneName: '',
  chaperoneEmail: '',
  chaperonePhone: '',
  exemption: false,
  mode: 'carpool',
  drivers: '1',
  driverFormsSent: false
};
// "Request a trip" - reached from a club's page. Collects what Student
// Activities asks for on an off-campus trip (OSA Manual pp. 31-32) plus the
// Expense Authorization Form. Only a President, Co-President or Treasurer
// can file one. Staff decide it from the Admin page.
export default function RequestTrip() {
  const { clubId } = useParams();
  const { currentUser, profile } = useAuth();
  const navigate = useNavigate();
  const [club, setClub] = useState(null);
  const [membership, setMembership] = useState(undefined);
  const [form, setForm] = useState(EMPTY);
  const [eaf, setEaf] = useState(null);
  const [eafOpen, setEafOpen] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    getClub(clubId).then(setClub);
    getMembership(clubId, currentUser.uid)
      .then(setMembership)
      .catch(() => setMembership(null));
  }, [clubId, currentUser.uid]);
  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  if (!club || membership === undefined) return <div className="page narrow">Loading...</div>;
  if (!canViewClubFinances(membership?.role)) {
    return (
      <div className="page narrow">
        <h1>Request a trip</h1>
        <p className="form-error">
          Only a club's President or Treasurer can request a trip, because it includes an Expense
          Authorization Form.
        </p>
        <Link to={`/clubs/${clubId}`}>Back to {club.name}</Link>
      </div>
    );
  }
  const mode = TRANSPORT_MODES.find((m) => m.id === form.mode) || TRANSPORT_MODES[0];
  const students = Number(form.students) || 0;
  const overnight = !!form.hotel.trim();
  const amountNumber = Number((eaf?.amount || '').replace(/[^0-9.]/g, '')) || 0;
  const perStudent = students > 0 ? amountNumber / students : 0;
  const problems = [];
  if (!form.destination.trim()) problems.push('Add a destination');
  if (!form.departure || !form.returnTime) problems.push('Add the departure and return times');
  if (students < 1) problems.push('Add how many students are going');
  if (!form.purpose.trim()) problems.push('Add the purpose');
  if (form.exemption) {
    if (overnight || form.mode === 'air')
      problems.push('A chaperone exemption is not available for overnight stays or airfare');
  } else if (!form.chaperoneName.trim() || !form.chaperoneEmail.trim() || !form.chaperonePhone.trim()) {
    problems.push('Add your chaperone (name, email and cell phone)');
  }
  if (mode.needsDriverForm && (Number(form.drivers) < 1 || !form.driverFormsSent)) {
    problems.push("Confirm each driver's Drivers Record Form was sent to University Police");
  }
  if (!eaf || eafProblems(eaf).length) problems.push('Fill out the Expense Authorization Form');
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await requestTrip({
        clubId,
        clubName: club.name,
        actor: { uid: currentUser.uid, name: profile?.name },
        actingMembership: membership,

        trip: {
          destination: form.destination.trim(),
          departure: form.departure,
          returnTime: form.returnTime,
          students,
          purpose: form.purpose.trim(),
          hotel: form.hotel.trim(),
          exemption: form.exemption,
          chaperone: form.exemption
            ? null
            : {
                name: form.chaperoneName.trim(),
                email: form.chaperoneEmail.trim(),
                phone: form.chaperonePhone.trim()
              },
          transport: {
            mode: form.mode,
            label: mode.label,
            drivers: mode.needsDriverForm ? Number(form.drivers) || 0 : 0,
            driverFormsSent: mode.needsDriverForm ? form.driverFormsSent : false
          }
        },
        eaf
      });
      navigate(`/clubs/${clubId}`);
    } catch (err) {
      setError(err.message || 'Could not send the trip request.');
      setSubmitting(false);
    }
  }
  return (
    <div className="page narrow">
      <h1>Request a trip</h1>
      <p className="page-subtitle">
        {club.name} &middot; off-campus trip. This goes to Staff for approval. Trip budgets are capped at $
        {TRIP_LIMITS.perStudent} per student and ${TRIP_LIMITS.perYear.toLocaleString()} per year. Send it
        at least 5 business days ahead.
      </p>
      <form onSubmit={handleSubmit} className="inline-form">
        <h2>Trip details</h2>
        <label>
          Destination
          <input
            value={form.destination}
            onChange={set('destination')}
            placeholder="e.g. RoboCup Regional, Albany NY"
          />{' '}
        </label>
        <div className="pw-row">
          <label>
            Departure
            <input type="datetime-local" value={form.departure} onChange={set('departure')} />
          </label>
          <label>
            Return
            <input type="datetime-local" value={form.returnTime} onChange={set('returnTime')} />
          </label>
          <label>
            Students going
            <input type="number" min="1" value={form.students} onChange={set('students')} />
          </label>
        </div>
        <label>
          Purpose
          <input
            value={form.purpose}
            onChange={set('purpose')}
            placeholder="e.g. Compete in the regional robotics competition"
          />{' '}
        </label>
        <label>
          Hotel (only if overnight)
          <input
            value={form.hotel}
            onChange={set('hotel')}
            placeholder="Leave blank if not overnight"
          />{' '}
        </label>
        <h2>Chaperone</h2><p className="pw-hint">A current Farmingdale employee must come along.</p>
        {!form.exemption && (
          <div className="pw-row">
            <label>
              Name
              <input value={form.chaperoneName} onChange={set('chaperoneName')} />
            </label>{' '}
            <label>
              FSC email
              <input value={form.chaperoneEmail} onChange={set('chaperoneEmail')} />
            </label>{' '}
            <label>
              Cell phone
              <input value={form.chaperonePhone} onChange={set('chaperonePhone')} />
            </label>{' '}
          </div>
        )}
        <label className="checkbox-label">
          <input type="checkbox" checked={form.exemption} onChange={set('exemption')} />
          We don't need a chaperone (I'll submit a Chaperone Exemption Form in RamCentral)
        </label>
        {form.exemption && (overnight || form.mode === 'air') && (
          <p className="form-error">Exemptions aren't considered for overnight stays or airfare.</p>
        )}
        <h2>Transportation</h2>
        <label>
          How are you getting there?
          <select value={form.mode} onChange={set('mode')}>
            {TRANSPORT_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        {mode.needsDriverForm && (
          <div className="pw-note">
            Each driver needs the <strong>Drivers Record Form (LENS)</strong> plus a copy of their license,
            insurance and vehicle registration, emailed to University Police for approval.
            <div className="pw-row">
              <label>
                Number of drivers
                <input type="number" min="1" value={form.drivers} onChange={set('drivers')} />
              </label>
            </div>
            <label className="checkbox-label">
              <input type="checkbox" checked={form.driverFormsSent} onChange={set('driverFormsSent')} />{' '}
              Every driver's form and documents have been sent
            </label>
          </div>
        )}
        <h2>Money</h2>
        <p className="pw-hint">
          The Expense Authorization Form is a request to spend the club's money. Nothing can be bought until
          it is approved, which can take up to 10 business days.
        </p>
        {eaf ? (
          <div className="pw-done">
            <div>
              &#10003; <strong>{eaf.vendor}</strong> &middot; up to {eaf.amount}
            </div>
            <div className="pw-sub">
              {EAF_TRANSACTIONS.find((t) => t.id === eaf.txn)?.label.split(':')[0]} &middot; {eaf.acct}{' '}
            </div>
            <button type="button" className="link-button" onClick={() => setEafOpen(true)}>
              Edit form
            </button>
          </div>
        ) : (
          <div>
            <button type="button" className="secondary" onClick={() => setEafOpen(true)}>
              Fill out the form
            </button>
          </div>
        )}
        {perStudent > TRIP_LIMITS.perStudent && (
          <p className="pw-note">
            That's about ${Math.round(perStudent)} per student, over the ${TRIP_LIMITS.perStudent}{' '}
            per-student limit. Staff may ask you to lower it. {' '}
          </p>
        )}
        {amountNumber > TRIP_LIMITS.needsVpApprovalOver && (
          <p className="pw-note">
            Over ${TRIP_LIMITS.needsVpApprovalOver.toLocaleString()} also needs the Vice President of
            Student Affairs' approval.
          </p>
        )}
        <h2>Liability waiver</h2>
        <p className="pw-hint">
          You don't attach this one. Student Activities adds the waiver when the trip is approved.
        </p>
        {error && <p className="form-error">{error}</p>}
        <div className="pw-modal-actions">
          <button type="submit" disabled={problems.length > 0 || submitting}>
            {submitting ? 'Sending...' : 'Submit trip for approval'}
          </button>{' '}
          <Link to={`/clubs/${clubId}`}>Cancel</Link>
          {problems.length > 0 && <span className="pw-problem">{problems[0]}</span>}
        </div>
      </form>
      {eafOpen && (
        <EafModal
          initial={eaf}
          eventName={form.destination}
          onSave={setEaf}
          onClose={() => setEafOpen(false)}
        />
      )}
    </div>
  );
}
