import { useState } from 'react';
import Modal from './Modal';
import { acceptTerms } from '../../services/reregistration';
import { CORE_OFFICERS, OFFICER_TERMS, OFFICER_TERMS_COMMON } from '../../data/clubRequirements';

// "Read and accept": one Core 4 officer accepts their position's Terms and
// Conditions for a club's re-registration. Used on the Paperwork tab and in
// the "Waiting for you" inbox.
export default function TermsModal({ rr, officerKey, actor, onClose, onError, onDone }) {
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const label = CORE_OFFICERS.find((o) => o.key === officerKey)?.label || 'Officer';

  async function accept() {
    setBusy(true);
    try {
      await acceptTerms(rr, officerKey, actor);
      if (onDone) onDone();
      onClose();
    } catch (err) {
      if (onError) onError(err.message || 'Could not save.');
      setBusy(false);
    }
  }

  return (
    <Modal title={`${label} Terms and Conditions`} onClose={onClose}>
      <p className="pw-sub">
        {rr.clubName} · re-registration for {rr.termLabel}
      </p>
      <p>{OFFICER_TERMS[officerKey]}</p>
      <p>{OFFICER_TERMS_COMMON}</p>
      <label className="checkbox-label">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />I have read
        and accept these terms
      </label>
      <div className="form-actions">
        <button type="button" disabled={!agree || busy} onClick={accept}>
          Accept
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          Not now
        </button>
      </div>
    </Modal>
  );
}
