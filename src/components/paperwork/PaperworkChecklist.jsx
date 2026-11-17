import { useRef, useState } from 'react';
import { CORE_OFFICERS, MIN_ROSTER, proposalWindowInfo } from '../../data/clubRequirements';
import {
  fileToStoredDoc,
  normalizeRoster,
  validateOfficers,
  validateRoster
} from '../../services/clubPaperwork';
import OfficerSheetModal from './OfficerSheetModal';
import RosterModal from './RosterModal';
import ConstitutionTemplateModal from './ConstitutionTemplateModal';
import AdvisorPickerModal from './AdvisorPickerModal';
const kb = (n) => `${Math.max(1, Math.round(n / 1024))} KB`;
// Returns which of the three required items are still missing, so the Create
// Club page can keep its Submit button off until they're all there.
export function missingPaperwork(value) {
  const missing = [];
  if (!value.officers || validateOfficers(value.officers).length > 0)
    missing.push('Executive Board Data Sheet');
  if (!value.roster || validateRoster(value.roster).length > 0) missing.push('Proposed roster');
  if (!value.constitution) missing.push('Constitution');
  return missing;
}
// The "What's Required" section of the Create Club page: executive
// board, roster, constitution, optional advisor. Holds nothing itself - the
// parent owns `value` and gets every change through `onChange(patch)`.
export default function PaperworkChecklist({ value, onChange, clubName, defaults }) {
  const [open, setOpen] = useState(null); // 'officers' | 'roster' | 'template' | 'advisor'
  const [fileError, setFileError] = useState('');
  const fileInput = useRef(null);
  const windowInfo = proposalWindowInfo();
  const missing = missingPaperwork(value);
  const done = 3 - missing.length;
  const rosterCount = value.roster ? normalizeRoster(value.roster).length : 0;
  async function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setFileError('');
    try {
      onChange({ constitution: await fileToStoredDoc(file) });
    } catch (err) {
      setFileError(err.message);
    }
  }
  return (
    <section className="pw-checklist">
      <h2>What's Required</h2>
      <p className="pw-hint">
        This follows the Office of Student Activities' New Club Proposal. {windowInfo.text}
      </p>
      <div className="pw-progress" aria-label={`${done} of 3 required items done`}>
        <div className="pw-progress-bar">
          <div style={{ width: `${(done / 3) * 100}%` }} />
        </div>
        <span>{done} of 3 required done</span>
      </div>
      <div className="pw-card">
        <div className="pw-card-head">
          <strong>1. Executive Board Data Sheet</strong>
          <span className="pw-tag pw-tag-req">Required</span>
        </div>
        <p className="pw-hint">
          President, Vice President, Treasurer and Secretary, each with name, FSC email and RAM ID.
        </p>{' '}
        {value.officers && validateOfficers(value.officers).length === 0 ? (
          <div className="pw-done">
            {CORE_OFFICERS.map(({ key, label }) => (
              <div key={key}>
                &#10003; {label}: {value.officers[key].name} &middot; {value.officers[key].email}
              </div>
            ))}
            <button type="button" className="link-button" onClick={() => setOpen('officers')}>
              Edit officers
            </button>{' '}
          </div>
        ) : (
          <div>
            <button type="button" className="secondary" onClick={() => setOpen('officers')}>
              Fill in officers
            </button>
          </div>
        )}
      </div>
      <div className="pw-card">
        <div className="pw-card-head">
          <strong>2. Proposed roster</strong>
          <span className="pw-tag pw-tag-req">Required</span>
        </div>{' '}
        <p className="pw-hint">
          At least
          {MIN_ROSTER} current students, each with full name, FSC email and RAM ID.
        </p>{' '}
        {value.roster && validateRoster(value.roster).length === 0 ? (
          <div className="pw-done">
            <div>
              &#10003; <strong>{rosterCount} students</strong> on the roster
            </div>
            <button type="button" className="link-button" onClick={() => setOpen('roster')}>
              Edit roster
            </button>{' '}
          </div>
        ) : (
          <div>
            <button type="button" className="secondary" onClick={() => setOpen('roster')}>
              Build the roster {' '}
            </button>
          </div>
        )}
      </div>
      <div className="pw-card">
        <div className="pw-card-head">
          <strong>3. Constitution</strong>
          <span className="pw-tag pw-tag-req">Required</span>
        </div>{' '}
        <p className="pw-hint">
          Must state your club's purpose and mission. Start from our template, fill it in, then attach your
          finished copy.
        </p>
        <div>
          <button type="button" className="link-button" onClick={() => setOpen('template')}>
            Open the constitution template
          </button>
        </div>{' '}
        {value.constitution ? (
          <div className="pw-done pw-file-row">
            <span>
              &#10003; {value.constitution.fileName} ({kb(value.constitution.size)})
            </span>
            <button type="button" className="link-button" onClick={() => onChange({ constitution: null })}>
              Remove
            </button>{' '}
          </div>
        ) : (
          <div className="pw-file-row">
            <button
              type="button"
              className="secondary"
              onClick={() => fileInput.current && fileInput.current.click()}
            >
              Attach finished constitution
            </button>
            <span className="pw-sub">PDF or photo, up to about 650 KB</span>
          </div>
        )}
        <input ref={fileInput} type="file" accept="application/pdf,image/*" hidden onChange={handleFile} />{' '}
        {fileError && <p className="form-error">{fileError}</p>}
      </div>
      <div className="pw-card">
        <div className="pw-card-head">
          <strong>4. Faculty or staff advisor</strong>
          <span className="pw-tag">Optional</span>
        </div>{' '}
        <p className="pw-hint">
          Any Farmingdale faculty or staff member. Student Activities doesn't require one, and it won't hold
          up your application.
        </p>
        {value.advisor ? (
          <div className="pw-done pw-file-row">
            <span>&#10003; {value.advisor.name}. They'll get a request to accept once you submit.</span>
            <button type="button" className="link-button" onClick={() => onChange({ advisor: null })}>
              Remove
            </button>{' '}
          </div>
        ) : (
          <div>
            <button type="button" className="secondary" onClick={() => setOpen('advisor')}>
              Choose an advisor
            </button>
          </div>
        )}
      </div>
      <p className="pw-hint">
        After approval, your officers finish Farmingdale's trainings (Executive Board Acknowledgment, Event
        Coordinator, Sexual Assault Prevention, Financial Tutorial). Your club's page tracks them.
      </p>
      {open === 'officers' && (
        <OfficerSheetModal
          initial={value.officers}
          defaults={defaults}
          onSave={async (officers) => onChange({ officers })}
          onClose={() => setOpen(null)}
        />
      )}
      {open === 'roster' && (
        <RosterModal
          initial={value.roster}
          onSave={async (roster) => onChange({ roster })}
          onClose={() => setOpen(null)}
        />
      )}
      {open === 'template' && (
        <ConstitutionTemplateModal clubName={clubName} onClose={() => setOpen(null)} />
      )}{' '}
      {open === 'advisor' && (
        <AdvisorPickerModal
          selectedUid={value.advisor?.uid}
          excludeUid={defaults?.uid}
          onPick={async (person) => onChange({ advisor: person })}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}
