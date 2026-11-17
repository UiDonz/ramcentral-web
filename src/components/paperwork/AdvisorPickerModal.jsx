import { useEffect, useState } from 'react';
import Modal from './Modal';
import { listenToFaculty } from '../../services/clubPaperwork';
// Pick a faculty or staff advisor from the people who have a Faculty account
// in the app. Nothing is sent from here: the parent decides what to do with
// the choice (the Create Club page holds it until the club is submitted; a
// club's own page sends the request straight away).
export default function AdvisorPickerModal({ selectedUid, excludeUid, onPick, onClose }) {
  const [faculty, setFaculty] = useState(null);
  const [search, setSearch] = useState('');
  const [chosen, setChosen] = useState(selectedUid || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => listenToFaculty(setFaculty), []);
  const q = search.trim().toLowerCase();
  const rows = (faculty || [])
    .filter((f) => f.uid !== excludeUid)
    .filter((f) => !q || `${f.name} ${f.email}`.toLowerCase().includes(q));
  const chosenPerson = (faculty || []).find((f) => f.uid === chosen);
  async function handleConfirm() {
    if (!chosenPerson) return;
    setSaving(true);
    setError('');
    try {
      await onPick(chosenPerson);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not send that request.');
      setSaving(false);
    }
  }
  return (
    <Modal title="Choose an advisor" onClose={onClose}>
      <p className="pw-hint">
        Any Farmingdale faculty or staff member can advise a club, and Student Activities doesn't require
        one. Ask them first: they'll see a request the next time they sign in and can accept the Advisor
        Agreement there.
      </p>
      <input
        aria-label="Search faculty and staff"
        placeholder="Search by name or email"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="pw-advisor-list">
        {faculty === null && <p className="empty-state">Loading...</p>}
        {faculty !== null && rows.length === 0 && (
          <p className="empty-state">
            {faculty.length === 0
              ? 'No faculty accounts yet. A faculty member needs to sign up as Faculty first.'
              : 'No one matches that search.'}
          </p>
        )}
        {rows.map((f) => (
          <div key={f.uid} className={`pw-advisor${chosen === f.uid ? ' selected' : ''}`}>
            <div>
              <strong>{f.name}</strong>
              <div className="pw-sub">{f.email}</div>
            </div>
            <button
              type="button"
              className={chosen === f.uid ? '' : 'secondary'}
              onClick={() => setChosen(f.uid)}
            >
              {' '}
              {chosen === f.uid ? 'Selected' : 'Select'}
            </button>
          </div>
        ))}
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="pw-modal-actions">
        <button type="button" onClick={handleConfirm} disabled={!chosenPerson || saving}>
          {saving ? 'Sending...' : 'Choose this advisor'}
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
