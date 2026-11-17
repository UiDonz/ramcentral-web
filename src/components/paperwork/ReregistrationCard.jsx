import { useEffect, useRef, useState } from 'react';
import {
  listenToClubRereg,
  startRereg,
  saveReregDetails,
  saveReregConstitution,
  getReregConstitution,
  submitRereg,
  reregProblems,
  missingOfficerRoles,
  currentCoreOfficers
} from '../../services/reregistration';
import { listenToTrainings, fileToStoredDoc, openStoredFile } from '../../services/clubPaperwork';
import { canManageRoles } from '../../services/rbac';
import {
  CORE_OFFICERS,
  TRAININGS,
  activeReregTerm,
  nextReregistration,
  needsReregistration,
  lastClosedRereg
} from '../../data/clubRequirements';
import TermsModal from './TermsModal';

const STATUS = {
  draft: { label: 'In progress', cls: 'pending' },
  submitted: { label: 'Waiting for Staff', cls: 'pending' },
  approved: { label: 'Approved', cls: 'active' },
  returned: { label: 'Sent back', cls: 'archived' }
};

// The Re-registration part of the Paperwork tab. Officers renew the club for
// the coming semester right here; Staff approve it in the Command Center.
export default function ReregistrationCard({
  clubId,
  club,
  members,
  memberNames,
  myMembership,
  currentUser,
  isStaffUser,
  actor,
  hasConstitutionOnFile,
  constitutionName,
  advisorName
}) {
  const term = activeReregTerm();
  const [rr, setRr] = useState(undefined); // undefined = loading, null = not started
  const [trainings, setTrainings] = useState({});
  const [form, setForm] = useState(null);
  const [termsKey, setTermsKey] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);
  const canLead = canManageRoles(myMembership) || isStaffUser;

  useEffect(() => {
    if (!term) return undefined;
    return listenToClubRereg(clubId, term.id, setRr);
  }, [clubId, term?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => listenToTrainings(clubId, setTrainings), [clubId]);
  // Keep the editable fields in step with the saved doc (when it first loads or Staff send it back).
  useEffect(() => {
    if (!rr) return;
    setForm({
      constitutionChoice: rr.constitutionChoice || 'keep',
      advisorChanged: !!rr.advisorChanged,
      newAdvisor: rr.newAdvisor || { name: '', email: '' },
      mission: rr.mission || ''
    });
  }, [rr?.id, rr?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(fn) {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    }
    setBusy(false);
  }

  const win = nextReregistration();
  const lapsed = needsReregistration(club);
  const lastClosed = lastClosedRereg();

  const header = (
    <>
      <h3>Re-registration</h3>
      {lapsed && (
        <p className="form-error">
          Needs re-registration: this club didn't renew for {lastClosed?.term.label}. Talk to Student Activities.
        </p>
      )}
    </>
  );

  // No window open or coming up soon: just explain how it works.
  if (!term) {
    return (
      <>
        {header}
        <div className="pw-card">
          <strong>{win.label}</strong>
          <p className="pw-hint">
            Every semester the club renews here. The President starts it, the Core 4 officers accept their
            position's Terms and Conditions, and you confirm the constitution, advisor and mission statement.
            Staff then approve it.
          </p>
        </div>
      </>
    );
  }

  const windowLine = term.open
    ? `${term.termLabel} re-registration is open until ${term.end.toLocaleDateString([], { month: 'long', day: 'numeric' })}.`
    : `${term.termLabel} re-registration opens ${term.start.toLocaleDateString([], { month: 'long', day: 'numeric' })}. You can start early.`;

  if (rr === undefined) return header;

  if (rr === null) {
    const officers = currentCoreOfficers(members, memberNames);
    const missing = missingOfficerRoles(officers);
    return (
      <>
        {header}
        <div className="pw-card">
          <strong>{windowLine}</strong>
          <p className="pw-hint">
            Renew the club for {term.termLabel}. Each Core 4 officer will get a request to accept their terms.
          </p>
          {missing.length > 0 && (
            <p className="pw-needed">Missing on the Members tab: {missing.join(', ')}.</p>
          )}
          {error && <p className="form-error">{error}</p>}
          {canLead ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => startRereg({ club, clubId, term, members, memberNames, actor }))}
            >
              Start re-registration
            </button>
          ) : (
            <p className="pw-sub">The President or Co-President starts it.</p>
          )}
        </div>
      </>
    );
  }

  const status = STATUS[rr.status] || STATUS.draft;
  const editable = canLead && rr.status !== 'submitted' && rr.status !== 'approved';
  const ctx = { hasConstitutionOnFile };
  const problems = form ? reregProblems({ ...rr, ...form }, ctx) : [];
  const myKey = CORE_OFFICERS.find(({ key }) => rr.officers?.[key]?.uid === currentUser?.uid)?.key;

  function trainingText(uid) {
    if (!uid) return '';
    const done = trainings[uid]?.done || {};
    const left = TRAININGS.filter((t) => !done[t.key]).length;
    return left === 0 ? 'Done' : `${left} left`;
  }

  return (
    <>
      {header}
      <div className="pw-card rr-card">
        <div className="rr-head">
          <strong>Re-registration · {rr.termLabel}</strong>
          <span className={`status-pill status-${status.cls}`}>{status.label}</span>
        </div>
        <p className="pw-hint">{windowLine}</p>
        {rr.status === 'returned' && rr.returnReason && (
          <p className="form-error">Staff sent it back: {rr.returnReason}</p>
        )}
        {error && <p className="form-error">{error}</p>}

        <div className="pw-board-scroll">
          <table className="pw-board-table">
            <thead>
              <tr>
                <th>Officer</th>
                <th>Trainings</th>
                <th>Terms</th>
              </tr>
            </thead>
            <tbody>
              {CORE_OFFICERS.map(({ key, label }) => {
                const o = rr.officers?.[key];
                const accepted = rr.accepted?.[key];
                const left = trainingText(o?.uid);
                return (
                  <tr key={key}>
                    <td>
                      {o ? o.name : <span className="pw-needed">No {label}</span>}
                      <span className="pw-sub"> · {label}</span>
                    </td>
                    <td className={left === 'Done' ? 'pw-ok' : 'pw-needed'}>{o ? left : ''}</td>
                    <td>
                      {accepted ? (
                        <span className="pw-ok">Accepted</span>
                      ) : key === myKey && rr.status !== 'approved' ? (
                        <button type="button" className="link-button" onClick={() => setTermsKey(key)}>
                          Read and accept
                        </button>
                      ) : (
                        <span className="pw-needed">Waiting</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {editable && (
          <div className="form-actions">
            <button
              type="button"
              className="link-button"
              disabled={busy}
              onClick={() => run(() => startRereg({ club, clubId, term, members, memberNames, actor }))}
            >
              Refresh officer list
            </button>
          </div>
        )}

        {form && (
          <div className="rr-fields">
            <div className="rr-field">
              <span className="rr-label">Constitution</span>
              <label className="checkbox-label">
                <input
                  type="radio"
                  name="rr-con"
                  disabled={!editable || !hasConstitutionOnFile}
                  checked={form.constitutionChoice === 'keep'}
                  onChange={() => setForm((f) => ({ ...f, constitutionChoice: 'keep' }))}
                />
                {hasConstitutionOnFile ? `No changes, keep the one on file (${constitutionName})` : 'No constitution on file'}
              </label>
              <label className="checkbox-label">
                <input
                  type="radio"
                  name="rr-con"
                  disabled={!editable}
                  checked={form.constitutionChoice === 'new'}
                  onChange={() => setForm((f) => ({ ...f, constitutionChoice: 'new' }))}
                />
                Upload a new one
              </label>
              {form.constitutionChoice === 'new' && (
                <div className="form-actions">
                  {rr.constitutionFile && (
                    <button
                      type="button"
                      className="link-button"
                      onClick={() =>
                        run(async () => {
                          const stored = await getReregConstitution(rr.id);
                          if (stored) openStoredFile(stored);
                        })
                      }
                    >
                      Open {rr.constitutionFile.fileName}
                    </button>
                  )}
                  {editable && (
                    <>
                      <button type="button" className="secondary" onClick={() => fileInput.current?.click()}>
                        {rr.constitutionFile ? 'Replace file' : 'Choose file'}
                      </button>
                      <input
                        ref={fileInput}
                        type="file"
                        accept="application/pdf,image/*"
                        hidden
                        onChange={(e) => {
                          const file = e.target.files && e.target.files[0];
                          e.target.value = '';
                          if (file) run(async () => saveReregConstitution(rr.id, await fileToStoredDoc(file)));
                        }}
                      />
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="rr-field">
              <span className="rr-label">Advisor</span>
              <label className="checkbox-label">
                <input
                  type="radio"
                  name="rr-adv"
                  disabled={!editable}
                  checked={!form.advisorChanged}
                  onChange={() => setForm((f) => ({ ...f, advisorChanged: false }))}
                />
                Same advisor{advisorName ? ` (${advisorName})` : ' (none)'}
              </label>
              <label className="checkbox-label">
                <input
                  type="radio"
                  name="rr-adv"
                  disabled={!editable}
                  checked={form.advisorChanged}
                  onChange={() => setForm((f) => ({ ...f, advisorChanged: true }))}
                />
                Our advisor changed
              </label>
              {form.advisorChanged && (
                <div className="rr-two">
                  <input
                    placeholder="New advisor's name"
                    disabled={!editable}
                    value={form.newAdvisor.name}
                    onChange={(e) => setForm((f) => ({ ...f, newAdvisor: { ...f.newAdvisor, name: e.target.value } }))}
                  />
                  <input
                    placeholder="New advisor's FSC email"
                    type="email"
                    disabled={!editable}
                    value={form.newAdvisor.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, newAdvisor: { ...f.newAdvisor, email: e.target.value } }))
                    }
                  />
                </div>
              )}
            </div>

            <div className="rr-field">
              <span className="rr-label">Mission statement</span>
              <textarea
                rows={3}
                disabled={!editable}
                value={form.mission}
                placeholder="What the club is for and what it does"
                onChange={(e) => setForm((f) => ({ ...f, mission: e.target.value }))}
              />
            </div>

            {editable && (
              <>
                {problems.length > 0 && (
                  <ul className="rr-problems">
                    {problems.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}
                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => run(() => saveReregDetails(rr.id, form))}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    disabled={busy || problems.length > 0}
                    onClick={() =>
                      run(async () => {
                        await saveReregDetails(rr.id, form);
                        await submitRereg({ ...rr, ...form }, actor, ctx);
                      })
                    }
                  >
                    Submit re-registration
                  </button>
                </div>
              </>
            )}
            {rr.status === 'submitted' && (
              <p className="pw-sub">Submitted. Staff will review it in the Command Center.</p>
            )}
            {rr.status === 'approved' && <p className="pw-ok">Approved for {rr.termLabel}.</p>}
          </div>
        )}
      </div>
      {termsKey && (
        <TermsModal
          rr={rr}
          officerKey={termsKey}
          actor={actor}
          onClose={() => setTermsKey(null)}
          onError={setError}
        />
      )}
    </>
  );
}
