import { useState } from 'react';
import Modal from './Modal';
import { EAF_ACCOUNTS, EAF_TRANSACTIONS, TRIP_LIMITS } from '../../data/clubRequirements';
const REQUIRED = [
  ['acctNo', 'the club account number'],
  ['amount', 'the highest amount you might spend'],
  ['vendor', 'the vendor'],
  ['vaddr', 'the vendor address or website (or TBD)'],
  ['desc', 'what you are buying']
];
export function eafProblems(eaf) {
  const e = eaf || {};
  const missing = REQUIRED.find(([k]) => !(e[k] || '').trim());
  return missing ? [`Add ${missing[1]}`] : [];
}
// Our in-app copy of the Expense Authorization Form that SGA uses (the
// fields come from the SGA finance guide). `eventName` is the trip it is
// for. Only a President or Treasurer may prepare one - the trip page checks
// that before it ever shows this.
export default function EafModal({ initial, eventName, onSave, onClose }) {
  const [eaf, setEaf] = useState({
    acct: EAF_ACCOUNTS[0],
    acctNo: '',
    txn: 'check',

    amount: '',
    vendor: '',
    vaddr: '',
    inv: '',
    desc: '',
    ...(initial || {})
  });
  const problems = eafProblems(eaf);
  const set = (k) => (e) => setEaf((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Modal title="Expense Authorization Form" onClose={onClose} wide>
      <p className="pw-hint">
        Event: <strong>{eventName || 'this trip'}</strong>. Off-campus trips can cover transportation, hotel
        and registration only, up to ${TRIP_LIMITS.perStudent} per student and $
        {TRIP_LIMITS.perYear.toLocaleString()} per year. Meals aren't covered.
      </p>
      <div className="pw-field-label">Which account?</div>
      <div className="pw-choice-row">
        {EAF_ACCOUNTS.map((a) => (
          <button
            key={a}
            type="button"
            className={eaf.acct === a ? '' : 'secondary'}
            onClick={() => setEaf((f) => ({ ...f, acct: a }))}
          >
            {a}
          </button>
        ))}
      </div>
      <label>
        Club account number (shown in RamCentral)
        <input value={eaf.acctNo} onChange={set('acctNo')} placeholder="e.g. 4821" />
      </label>
      <div className="pw-field-label">What kind of payment?</div>
      <div className="pw-choice-col">
        {EAF_TRANSACTIONS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={eaf.txn === t.id ? '' : 'secondary'}
            onClick={() => setEaf((f) => ({ ...f, txn: t.id }))}
          >
            {t.label}
          </button>
        ))}
      </div>
      {' '}
      {eaf.txn === 'reimb' && (
        <p className="pw-note">
          The member being reimbursed can't be the person who submits this form, and must buy only after it
          is approved.{' '}
        </p>
      )}
      <div className="pw-row">
        <label>
          Highest amount you might spend
          <input value={eaf.amount} onChange={set('amount')} placeholder="$410" />
        </label>
        <label>
          Vendor (who is being paid)
          <input value={eaf.vendor} onChange={set('vendor')} placeholder="e.g. Empire Coach Lines" />
        </label>
      </div>
      <p className="pw-sub">
        Include tax, shipping and possible price changes. It's better to overestimate than underestimate.
      </p>{' '}
      <div className="pw-row">
        <label>
          Vendor address or website (or TBD)
          <input value={eaf.vaddr} onChange={set('vaddr')} placeholder="website, address, or TBD" />
        </label>
        <label>
          Invoice number (or N/A)
          <input value={eaf.inv} onChange={set('inv')} placeholder="N/A" />
        </label>
      </div>
      <label>
        What are you buying? Be specific. A link is not enough.
        <input
          value={eaf.desc}
          onChange={set('desc')}
          placeholder="e.g. Round-trip charter bus, Farmingdale to Albany, 8 students"
        />{' '}
      </label>
      <p className="pw-sub">
        Vendors that aren't incorporated (an LLC or an individual) will need a W-9 later. Anything over $
        {TRIP_LIMITS.needsVpApprovalOver.toLocaleString()} also needs the Vice President of Student Affairs'
        approval.{' '}
      </p>
      <div className="pw-modal-actions">
        <button
          type="button"
          disabled={problems.length > 0}
          onClick={() => {
            onSave(eaf);
            onClose();
          }}
        >
          Save form
        </button>{' '}
        <button type="button" className="secondary" onClick={onClose}>
          Cancel
        </button>
        {problems.length > 0 && <span className="pw-problem">{problems[0]}</span>}
      </div>
    </Modal>
  );
}
