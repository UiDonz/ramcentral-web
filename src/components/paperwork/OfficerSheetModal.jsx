import { useState } from 'react';
import Modal from './Modal';
import { CORE_OFFICERS } from '../../data/clubRequirements';
import { validateOfficers } from '../../services/clubPaperwork';
// The Executive Board Data Sheet: name, FSC email and RAM ID for the Core 4
// officers. `initial` is the saved sheet (or null); `defaults` pre-fills the
// President with whoever is filling this in.
export default function OfficerSheetModal({ initial, defaults, onSave, onClose }) {
  const [officers, setOfficers] = useState(() => {
    const start = {};
    CORE_OFFICERS.forEach(({ key }) => {
      start[key] = { name: '', email: '', ram: '', ...((initial && initial[key]) || {}) };
    });
    if (!initial && defaults)
      start.pres = { name: defaults.name || '', email: defaults.email || '', ram: defaults.ram || '' };
    return start;
  });
  const [error, setError] = useState('');

  const [saving, setSaving] = useState(false);
  const problems = validateOfficers(officers);
  function setField(key, field, value) {
    setOfficers((o) => ({ ...o, [key]: { ...o[key], [field]: value } }));
  }
  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      await onSave(officers);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save the officers.');
      setSaving(false);
    }
  }
  return (
    <Modal title="Executive Board Data Sheet" onClose={onClose}>
      <p className="pw-hint">
        Each officer must be registered for classes this semester and in good academic and disciplinary
        standing. Use their FSC email.
      </p>
      {CORE_OFFICERS.map(({ key, label }) => (
        <div key={key} className="pw-officer-block">
          <strong>{label}</strong>
          <div className="pw-row">
            <input
              aria-label={`${label} full name`}
              placeholder="Full name"
              value={officers[key].name}
              onChange={(e) => setField(key, 'name', e.target.value)}
            />
            <input
              aria-label={`${label} FSC email`}
              placeholder="name@farmingdale.edu"
              value={officers[key].email}
              onChange={(e) => setField(key, 'email', e.target.value)}
            />
            <input
              aria-label={`${label} RAM ID`}
              placeholder="RAM ID"
              value={officers[key].ram}
              onChange={(e) => setField(key, 'ram', e.target.value)}
            />
          </div>
        </div>
      ))}
      {error && <p className="form-error">{error}</p>}
      <div className="pw-modal-actions">
        <button type="button" onClick={handleSave} disabled={problems.length > 0 || saving}>
          {saving ? 'Saving...' : 'Save officers'}
        </button>{' '}
        <button type="button" className="secondary" onClick={onClose}>
          Cancel
        </button>
        {problems.length > 0 && <span className="pw-problem">{problems[0]}</span>}
      </div>
    </Modal>
  );
}
