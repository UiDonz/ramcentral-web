import { useState } from 'react';
import Modal from './Modal';
import { MIN_ROSTER, isValidEmail } from '../../data/clubRequirements';
import { validateRoster } from '../../services/clubPaperwork';
const blank = () => ({ name: '', email: '', ram: '' });
function startingRows(initial) {
  const rows = (initial || []).map((r) => ({ ...blank(), ...r }));
  while (rows.length < MIN_ROSTER) rows.push(blank());
  return rows;
}
// Turns pasted text (one student per line: "Name, email, RAM ID", comma or
// tab separated) into roster rows.

function parsePaste(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(/[\t,]/).map((p) => p.trim()))
    .filter((parts) => parts.some(Boolean))
    .map(([name = '', email = '', ram = '']) => ({ name, email, ram }));
}
const isComplete = (r) => r.name.trim() && r.ram.trim() && isValidEmail(r.email);
const isPartial = (r) => (r.name.trim() || r.email.trim() || r.ram.trim()) && !isComplete(r);
// The Proposed Roster: at least 10 current students, each with full name, FSC
// email and RAM ID. Rows can be typed in, or a whole list can be pasted.
export default function RosterModal({ initial, onSave, onClose }) {
  const [rows, setRows] = useState(() => startingRows(initial));
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const completeCount = rows.filter(isComplete).length;
  const problems = validateRoster(rows);
  function setField(i, field, value) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  }
  function addPasted() {
    const parsed = parsePaste(pasteText);
    if (parsed.length === 0) return;
    setRows((r) => {
      const keep = r.filter((row) => row.name.trim() || row.email.trim() || row.ram.trim());
      const next = [...keep, ...parsed];
      while (next.length < MIN_ROSTER) next.push(blank());
      return next;
    });
    setPasteText('');
    setPasting(false);
  }
  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      await onSave(rows);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save the roster.');
      setSaving(false);
    }
  }
  return (
    <Modal title="Proposed roster" onClose={onClose} wide>
      <p className="pw-hint">
        At least {MIN_ROSTER} current students. Full name, FSC email and RAM ID for each.{' '}
        <strong>
          {completeCount} of {MIN_ROSTER}
        </strong>{' '}
        done. Nobody is added to your club just for being listed: once Student Activities approves it, each
        student gets an invitation to accept.
      </p>
      <div className="pw-roster-scroll">
        {rows.map((r, i) => (
          <div key={i} className="pw-row">
            <span className="pw-row-n">{i + 1}</span>
            <input
              aria-label={`Student ${i + 1} full name`}
              placeholder="Full name"
              value={r.name}
              onChange={(e) => setField(i, 'name', e.target.value)}
              className={isPartial(r) ? 'pw-bad' : ''}
            />
            <input
              aria-label={`Student ${i + 1} FSC email`}
              placeholder="name@farmingdale.edu"
              value={r.email}
              onChange={(e) => setField(i, 'email', e.target.value)}
              className={isPartial(r) ? 'pw-bad' : ''}
            />
            <input
              aria-label={`Student ${i + 1} RAM ID`}
              placeholder="RAM ID"
              value={r.ram}
              onChange={(e) => setField(i, 'ram', e.target.value)}
              className={isPartial(r) ? 'pw-bad' : ''}
            />
          </div>
        ))}
      </div>
      <div className="pw-inline-actions">
        <button type="button" className="link-button" onClick={() => setRows((r) => [...r, blank()])}>
          + Add another student
        </button>{' '}
        <button type="button" className="link-button" onClick={() => setPasting((p) => !p)}>
          Paste a list
        </button>{' '}
      </div>
      {pasting && (
        <div className="pw-paste">
          <label>
            One student per line: name, email, RAM ID
            <textarea
              rows={5}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={'Maya Torres, mtorres@farmingdale.edu, 90210001'}
            />
          </label>
          <button type="button" onClick={addPasted}>
            Add these students
          </button>
        </div>
      )}
      {error && <p className="form-error">{error}</p>}
      <div className="pw-modal-actions">
        <button type="button" onClick={handleSave} disabled={problems.length > 0 || saving}>
          {saving ? 'Saving...' : 'Save roster'}
        </button>{' '}
        <button type="button" className="secondary" onClick={onClose}>
          Cancel
        </button>
        {problems.length > 0 && <span className="pw-problem">{problems[0]}</span>}
      </div>
    </Modal>
  );
}
