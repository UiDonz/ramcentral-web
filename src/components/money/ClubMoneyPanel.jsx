import { useState } from 'react';
import {
  fileSpendRequest,
  markBought,
  submitReceipts,
  committedAmount,
  allocationOf,
  clubActionNeeded
} from '../../services/clubMoney';
import { canRequestSpending } from '../../services/rbac';
import {
  SPEND_CATEGORIES,
  CATEGORY_GROUPS,
  PAY_METHODS,
  NOT_ALLOWED,
  BUSINESS_DAYS_AHEAD,
  VENDOR_DOCS,
  spendWarnings,
  categoryTotals,
  payMethodOf
} from '../../data/moneyRules';
import { EVENT_TYPES } from '../../data/eventRules';
import useTreasurerTraining from './useTreasurerTraining';
import { money, StatusPill, StepTracker, RequestSummary, ReceiptLinks, Chip, CountChip } from './SpendBits';

const EMPTY = {
  item: '',
  category: 'supplies',
  amount: '',
  vendor: '',
  payMethod: 'card',
  neededBy: '',
  note: '',
  ruleOk: false,
  vendorDocsOk: false,
  eventType: ''
};

// One thing the club has to do next, with its button right beside it.
function WaitingRow({ r, actor, myMembership, onError }) {
  const [boughtBy, setBoughtBy] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);

  async function run(fn) {
    onError(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      onError(err.message);
    }
    setBusy(false);
  }

  const buying = r.status === 'approved';
  return (
    <div className="waiting-row">
      <div className="waiting-text">
        <strong>
          {buying && 'Buy it, then tell us'}
          {r.status === 'purchased' && 'Add your receipts'}
          {r.status === 'returned' && 'Fix and resend your receipts'}
        </strong>
        <div className="spend-meta">
          {r.item} · {money(r.amount)}
        </div>
        {r.status === 'returned' && r.returnReason && (
          <div className="spend-note bad">Staff said: {r.returnReason}</div>
        )}
      </div>
      {buying ? (
        <form
          className="waiting-action"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => markBought(r.id, boughtBy, actor, myMembership));
          }}
        >
          <input
            value={boughtBy}
            onChange={(e) => setBoughtBy(e.target.value)}
            placeholder="Who bought it? (not the person who filed)"
            aria-label="Who bought it"
          />
          <button type="submit" disabled={busy}>
            I bought it
          </button>
        </form>
      ) : (
        <form
          className="waiting-action"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await submitReceipts(r.id, files, actor, myMembership);
              setFiles([]);
            });
          }}
        >
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            aria-label="Receipts (photo or PDF)"
            onChange={(e) => setFiles([...e.target.files])}
          />
          <button type="submit" disabled={busy || files.length === 0}>
            Add receipts
          </button>
        </form>
      )}
    </div>
  );
}

// The Finances tab on a club page, drawn as separate cards: the yearly money
// with category bars, "Waiting for you", the request form, and every request.
export default function ClubMoneyPanel({ club, clubId, spend, myMembership, actor, isStaffUser }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const canAct = canRequestSpending(myMembership?.role);
  const treasurerTraining = useTreasurerTraining(clubId);

  const allocation = allocationOf(club);
  const committed = committedAmount(spend);
  const left = allocation - committed;
  const totals = categoryTotals(spend);
  const waiting = canAct ? spend.filter(clubActionNeeded) : [];
  const cat = SPEND_CATEGORIES.find((c) => c.id === form.category);
  const checks = form.amount
    ? spendWarnings({
        amount: form.amount,
        category: form.category,
        neededBy: form.neededBy,
        allocation,
        committedOthers: committed,
        categoryUsedOthers: totals[form.category] || 0,
        payMethod: form.payMethod,
        eventType: form.eventType
      })
    : [];

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await fileSpendRequest({ club, clubId, form, actor, actingMembership: myMembership });
      setForm(EMPTY);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <>
      {error && <p className="form-error">{error}</p>}

      <section className="detail-section">
        <h2>Club Finances</h2>
        <p className="page-subtitle">
          Your yearly amount from Student Government. Approved spending comes out of it.
        </p>
        <div className="money-big">
          <span className="money-big-num" style={left < 0 ? { color: 'var(--danger)' } : undefined}>
            {money(left)}
          </span>
          <span className="money-big-of">left of {money(allocation)}</span>
        </div>
        <div className="meter">
          <span
            style={{ width: `${Math.min(100, Math.max(0, (committed / (allocation || 1)) * 100))}%` }}
          />
        </div>
        <p className="spend-meta">{money(committed)} asked or spent</p>
        <div className="cat-bars">
          {CATEGORY_GROUPS.map((g) => {
            const used = g.cats.reduce((n, c) => n + (totals[c] || 0), 0);
            const pct = g.limit ? Math.min(100, (used / g.limit) * 100) : 0;
            return (
              <div key={g.id} className="cat-bar">
                <span className="cat-name">{g.label}</span>
                <span className="meter thin">
                  <span style={{ width: `${pct}%` }} />
                </span>
                <span className="cat-of">
                  {money(used)} of {g.limit ? money(g.limit) : 'no limit'}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {waiting.length > 0 && (
        <section className="detail-section">
          <h2>
            Waiting for you <CountChip n={waiting.length} />
          </h2>
          <p className="page-subtitle">What the club needs to do next.</p>
          {waiting.map((r) => (
            <WaitingRow key={r.id} r={r} actor={actor} myMembership={myMembership} onError={setError} />
          ))}
        </section>
      )}

      <section className="detail-section">
        <h2>Request spending</h2>
        {canAct ? (
          <>
            <p className="page-subtitle">
              Fill this in before you buy anything. The club may not spend until Staff approve it.
            </p>
            {treasurerTraining && (
              <div className="chip-row">
                <Chip ok={treasurerTraining.ok}>{treasurerTraining.text}</Chip>
              </div>
            )}
            <form onSubmit={submit} className="inline-form money-form">
              <div className="money-form-row">
                <label>
                  Category
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  >
                    {SPEND_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Amount ($, estimate high)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="e.g. 250"
                    required
                  />
                </label>
              </div>
              {cat?.rules?.length > 0 && (
                <ul className="rule-list">
                  {cat.rules.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
              <label>
                What is it for?
                <input
                  value={form.item}
                  onChange={(e) => setForm((f) => ({ ...f, item: e.target.value }))}
                  placeholder="e.g. Tournament pizza night"
                  required
                />
              </label>
              <div className="money-form-row">
                <label>
                  Store or vendor
                  <input
                    value={form.vendor}
                    onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
                    placeholder="e.g. Costco"
                  />
                </label>
                <label>
                  Needed by (send {BUSINESS_DAYS_AHEAD}+ business days ahead)
                  <input
                    type="date"
                    value={form.neededBy}
                    onChange={(e) => setForm((f) => ({ ...f, neededBy: e.target.value }))}
                  />
                </label>
              </div>
              <label>
                How will it be paid?
                <select
                  value={form.payMethod}
                  onChange={(e) => setForm((f) => ({ ...f, payMethod: e.target.value }))}
                >
                  {PAY_METHODS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} - {p.who}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                What kind of event is it for?
                <select
                  value={form.eventType}
                  onChange={(e) => setForm((f) => ({ ...f, eventType: e.target.value }))}
                >
                  <option value="">Not for an event</option>
                  {EVENT_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Anything Staff should know
                <input
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                />
              </label>
              {form.payMethod === 'check' && (
                <div className="rule-box">
                  <strong>A vendor paid by check has to send:</strong>
                  <ul className="rule-list">
                    {VENDOR_DOCS.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={form.vendorDocsOk}
                      onChange={(e) => setForm((f) => ({ ...f, vendorDocsOk: e.target.checked }))}
                    />
                    The vendor knows and will send all of this.
                  </label>
                </div>
              )}
              <div className="rule-box">
                <strong>Student Government funds cannot be used for:</strong>
                <ul className="rule-list">
                  {NOT_ALLOWED.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.ruleOk}
                    onChange={(e) => setForm((f) => ({ ...f, ruleOk: e.target.checked }))}
                  />
                  This purchase is not one of those.
                </label>
              </div>
              {checks.length > 0 ? (
                <div className="chip-row">
                  {checks.map((c) => (
                    <Chip key={c.text} ok={c.ok}>
                      {c.text}
                    </Chip>
                  ))}
                </div>
              ) : (
                <p className="spend-meta">Type an amount to see the limits.</p>
              )}
              <div className="form-actions">
                <button type="submit" disabled={busy}>
                  Send to Staff
                </button>
              </div>
            </form>
          </>
        ) : (
          <p className="empty-state">
            {isStaffUser
              ? 'You are viewing this club as Staff.'
              : 'Only the President or Treasurer can request spending.'}
          </p>
        )}
      </section>

      <section className="detail-section">
        <h2>Your expenses</h2>
        <p className="page-subtitle">Every request and where it is now.</p>
        {spend.length === 0 && <p className="empty-state">No spending requests yet.</p>}
        {spend.map((r) => (
          <div key={r.id} className="expense-row">
            <div className="spend-row-top">
              <RequestSummary r={r} />
              <StatusPill status={r.status} />
            </div>
            <StepTracker status={r.status} />
            {r.status === 'denied' && r.denyReason && (
              <p className="spend-note bad">Staff said: {r.denyReason}</p>
            )}
            {r.status === 'approved' && r.payMethod !== 'reimburse' && (
              <p className="spend-note">
                Approved. Staff will place the order ({payMethodOf(r.payMethod)?.label}).
              </p>
            )}
            <ReceiptLinks requestId={r.id} count={r.receiptCount} />
          </div>
        ))}
      </section>
    </>
  );
}
