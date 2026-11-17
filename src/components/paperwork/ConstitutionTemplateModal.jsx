import Modal from './Modal';
import { CONSTITUTION_SECTIONS } from '../../data/clubRequirements';
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
// Builds a Word-openable file (HTML in a .doc wrapper) so the club can fill
// the template in without any extra library.
function downloadTemplate(clubName) {
  const name = clubName || '[Club Name]';
  const body = CONSTITUTION_SECTIONS.map(
    (s) => `<h3>${escapeHtml(s.title)}</h3><p>${escapeHtml(s.body.replace(/\[Club Name\]/g, name))}</p>`
  ).join('');
  const html =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">` +
    `<head><meta
  charset="utf-8"><title>Constitution</title></head><body>` +
    `<h1 style="text-align:center">Constitution of ${escapeHtml(name)}</h1>` +
    `<p style="text-align:center">Farmingdale State College</p>${body}</body></html>`;
  const url = URL.createObjectURL(new Blob(['■', html], { type: 'application/msword' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(clubName || 'Club').replace(/[^a-z0-9]+/gi, '-')}-constitution-template.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
// A starting-point constitution. Farmingdale only requires that it states
// the club's purpose and mission; the other articles are common ones.

export default function ConstitutionTemplateModal({ clubName, onClose }) {
  const name = clubName || '[Club Name]';
  return (
    <Modal title="Constitution template" onClose={onClose} wide>
      <p className="pw-hint">
        Farmingdale only requires that your constitution states your club's purpose and mission. The other
        articles are common ones to start from; delete what you don't need. Download it, fill it in, save it
        as a PDF, then attach your finished copy.
      </p>
      <div className="pw-template">
        <div className="pw-template-title">Constitution of {name}</div>
        <div className="pw-template-sub">Farmingdale State College</div>
        {CONSTITUTION_SECTIONS.map((s) => (
          <div key={s.title}>
            <strong>{s.title}.</strong>{' '}
            <span className={s.required ? 'pw-required-text' : ''}>
              {s.required ? '(Required) ' : ''}
              {s.body.replace(/\[Club Name\]/g, name)}
            </span>
          </div>
        ))}
      </div>
      <div className="pw-modal-actions">
        <button type="button" onClick={() => downloadTemplate(clubName)}>
          Download as Word file
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
