import { useEffect, useState } from 'react';
import { openStoredFile } from '../../services/clubPaperwork';
import { listenToReceipts } from '../../services/clubMoney';
import { SPEND_STATUS, categoryOf, payMethodOf } from '../../data/moneyRules';

export function money(n) {
  return `$${(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function StatusPill({ status }) {
  const s = SPEND_STATUS[status] || { label: status, tone: 'archived' };
  const cls =
    s.tone === 'active' ? 'status-active' : s.tone === 'danger' ? 'status-danger' : 'status-pending';
  return <span className={`status-pill ${cls}`}>{s.label}</span>;
}

// A small green (ok) or amber (warning) label.
export function Chip({ ok, children }) {
  return (
    <span className={`chip ${ok ? 'chip-ok' : 'chip-warn'}`}>
      {ok ? '✓' : '!'} {children}
    </span>
  );
}

// The number next to a section title: grey at zero, red when something waits.
export function CountChip({ n }) {
  return <span className={`count-chip${n > 0 ? ' hot' : ''}`}>{n}</span>;
}

// Six steps a request moves through, drawn as six bars that fill in.
const STAGES = ['requested', 'approved', 'purchased', 'receipts', 'processing', 'paid'];
const STAGE_NAMES = ['Asked', 'Approved', 'Bought', 'Receipts', 'Payment', 'Paid'];

export function StepTracker({ status }) {
  if (status === 'denied') return null;
  const at = status === 'returned' ? 3 : Math.max(0, STAGES.indexOf(status));
  return (
    <div className="seg-bar" role="img" aria-label={`Step ${at + 1} of 6: ${STAGE_NAMES[at]}`}>
      {STAGE_NAMES.map((n, i) => (
        <span key={n} title={n} className={i <= at ? 'on' : ''} />
      ))}
    </div>
  );
}

export function RequestSummary({ r }) {
  const cat = categoryOf(r.category);
  const pay = payMethodOf(r.payMethod);
  return (
    <div className="spend-summary">
      <strong>{r.item}</strong> &mdash; {money(r.amount)}
      <div className="spend-meta">
        {cat?.label || r.category}
        {pay ? ` · ${pay.label}` : ''}
        {r.vendor ? ` · ${r.vendor}` : ''}
        {r.vendorDocsOk ? ' · vendor paperwork confirmed' : ''}
        {r.neededBy ? ` · needed by ${r.neededBy}` : ''}
        {r.requestedByName ? ` · filed by ${r.requestedByName}` : ''}
      </div>
      {r.note && <div className="spend-meta">{r.note}</div>}
    </div>
  );
}

// Lets someone open the receipts a club sent in (club officers and Staff).
export function ReceiptLinks({ requestId, count }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState([]);
  useEffect(() => {
    if (!open) return undefined;
    return listenToReceipts(requestId, setFiles);
  }, [open, requestId]);
  if (!count) return null;
  return (
    <div className="spend-receipts">
      <button type="button" className="link-button" onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide receipts' : `View receipts (${count})`}
      </button>
      {open &&
        files.map((f) => (
          <button key={f.id} type="button" className="link-button" onClick={() => openStoredFile(f)}>
            {f.fileName}
          </button>
        ))}
    </div>
  );
}
