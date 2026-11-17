import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  decideSpend,
  markOrdered,
  decideReceipts,
  markPaid,
  setClubAllocation,
  committedAmount,
  allocationOf
} from '../../services/clubMoney';
import {
  spendWarnings,
  categoryTotals,
  RETURNING_ALLOCATION,
  NEW_CLUB_ALLOCATION
} from '../../data/moneyRules';
import useTreasurerTraining from './useTreasurerTraining';
import { money, StatusPill, RequestSummary, ReceiptLinks, Chip, CountChip } from './SpendBits';

function useGuard(onError) {
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
  return [busy, run];
}

// A new spending request in the Approvals tab. Shows the rule warnings so
// Staff can see at a glance what needs a second look.
export function SpendApprovalCard({ r, club, allSpend, actor, onError }) {
  const [busy, run] = useGuard(onError);
  const [denying, setDenying] = useState(false);
  const [reason, setReason] = useState('');
  const mine = allSpend.filter((x) => x.clubId === r.clubId);
  const allocation = allocationOf(club);
  const warnings = spendWarnings({
    amount: r.amount,
    category: r.category,
    neededBy: r.neededBy,
    allocation,
    committedOthers: committedAmount(mine, r.id),
    categoryUsedOthers: categoryTotals(mine, r.id)[r.category] || 0,
    payMethod: r.payMethod,
    eventType: r.eventType
  });
  const treasurerTraining = useTreasurerTraining(r.clubId);
  return (
    <div className="report-card">
      <div className="report-card-meta">
        <span className="badge">Spending request</span>
        <Link to={`/clubs/${r.clubId}`}>{r.clubName}</Link>
        <span>
          Yearly amount {money(allocation)}, left {money(allocation - committedAmount(mine))}
        </span>
      </div>
      <RequestSummary r={r} />
      <div className="chip-row">
        {warnings.map((w) => (
          <Chip key={w.text} ok={w.ok}>
            {w.text}
          </Chip>
        ))}
        {treasurerTraining && <Chip ok={treasurerTraining.ok}>{treasurerTraining.text}</Chip>}
      </div>
      {denying ? (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => decideSpend(r.id, false, { reason }, actor));
          }}
        >
          <label>
            Reason (the club will see this)
            <input value={reason} onChange={(e) => setReason(e.target.value)} required />
          </label>
          <div className="form-actions">
            <button type="submit" disabled={busy}>
              Deny request
            </button>
            <button type="button" className="secondary" onClick={() => setDenying(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="form-actions">
          <button disabled={busy} onClick={() => run(() => decideSpend(r.id, true, {}, actor))}>
            Approve
          </button>
          <button className="secondary" onClick={() => setDenying(true)}>
            Deny
          </button>
        </div>
      )}
    </div>
  );
}

function ReceiptCheckCard({ r, actor, onError }) {
  const [busy, run] = useGuard(onError);
  const [sending, setSending] = useState(false);
  const [reason, setReason] = useState('');
  return (
    <div className="report-card">
      <div className="report-card-meta">
        <Link to={`/clubs/${r.clubId}`}>{r.clubName}</Link>
        {r.boughtBy && <span>Bought by {r.boughtBy}</span>}
      </div>
      <RequestSummary r={r} />
      <ReceiptLinks requestId={r.id} count={r.receiptCount} />
      {sending ? (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => decideReceipts(r.id, false, { reason }, actor));
          }}
        >
          <label>
            What is wrong? (the club will see this and send new receipts)
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. The receipt is cut off, please retake it"
              required
            />
          </label>
          <div className="form-actions">
            <button type="submit" disabled={busy}>
              Send back
            </button>
            <button type="button" className="secondary" onClick={() => setSending(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="form-actions">
          <button disabled={busy} onClick={() => run(() => decideReceipts(r.id, true, {}, actor))}>
            Receipts look good
          </button>
          <button className="secondary" onClick={() => setSending(true)}>
            Send back
          </button>
        </div>
      )}
    </div>
  );
}

function SimpleActionRow({ r, actionLabel, action, actor, onError }) {
  const [busy, run] = useGuard(onError);
  return (
    <div className="report-card">
      <div className="report-card-meta">
        <Link to={`/clubs/${r.clubId}`}>{r.clubName}</Link>
      </div>
      <RequestSummary r={r} />
      <div className="form-actions">
        <button disabled={busy} onClick={() => run(() => action(r.id, actor))}>
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

function AllocationRow({ club, spend, actor, onError }) {
  const [value, setValue] = useState('');
  const [busy, run] = useGuard(onError);
  const allocation = allocationOf(club);
  const committed = committedAmount(spend.filter((r) => r.clubId === club.id));
  const save = (n) => run(() => setClubAllocation(club.id, club.name, n, actor)).then(() => setValue(''));
  return (
    <tr>
      <td>
        <Link to={`/clubs/${club.id}`}>{club.name}</Link>
      </td>
      <td>{money(allocation)}</td>
      <td>{money(committed)}</td>
      <td style={allocation - committed < 0 ? { color: 'var(--danger)' } : undefined}>
        {money(allocation - committed)}
      </td>
      <td>
        <div className="alloc-edit">
          <button
            type="button"
            className="link-button"
            disabled={busy}
            onClick={() => save(RETURNING_ALLOCATION)}
          >
            Returning {money(RETURNING_ALLOCATION)}
          </button>
          <button
            type="button"
            className="link-button"
            disabled={busy}
            onClick={() => save(NEW_CLUB_ALLOCATION)}
          >
            New {money(NEW_CLUB_ALLOCATION)}
          </button>
          <input
            type="number"
            min="0"
            aria-label={`Custom yearly amount for ${club.name}`}
            placeholder="Custom"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button
            type="button"
            className="link-button"
            disabled={busy || value === ''}
            onClick={() => save(value)}
          >
            Set
          </button>
        </div>
      </td>
    </tr>
  );
}

// Staff -> Finance tab: the money pipeline, in the order the work happens.
export function StaffFinanceTab({ spend, clubs, actor, onError }) {
  const orders = spend.filter((r) => r.status === 'approved' && r.payMethod !== 'reimburse');
  const toCheck = spend.filter((r) => r.status === 'receipts');
  const toPay = spend.filter((r) => r.status === 'processing');
  const recent = spend.filter((r) => r.status !== 'requested').slice(0, 15);
  const sortedClubs = [...clubs]
    .filter((c) => c.status === 'active')
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  // Yearly amounts search: matches the club name or category.
  const [clubSearch, setClubSearch] = useState('');
  const q = clubSearch.trim().toLowerCase();
  const shownClubs = q
    ? sortedClubs.filter((c) => `${c.name || ''} ${c.category || ''}`.toLowerCase().includes(q))
    : sortedClubs;

  return (
    <>
      <section className="detail-section">
        <h2>
          Orders to place <CountChip n={orders.length} />
        </h2>
        <p className="page-subtitle">
          Approved and paid by SGA card or check. Place the order, then mark it.
        </p>
        {orders.length === 0 && <p className="empty-state">No orders waiting.</p>}
        {orders.map((r) => (
          <SimpleActionRow
            key={r.id}
            r={r}
            actionLabel="Order placed"
            action={markOrdered}
            actor={actor}
            onError={onError}
          />
        ))}
      </section>

      <section className="detail-section">
        <h2>
          Receipts to check <CountChip n={toCheck.length} />
        </h2>
        <p className="page-subtitle">
          Open the receipts. If they are fine the payment moves on; if not, send them back with a reason.
        </p>
        {toCheck.length === 0 && <p className="empty-state">No receipts waiting.</p>}
        {toCheck.map((r) => (
          <ReceiptCheckCard key={r.id} r={r} actor={actor} onError={onError} />
        ))}
      </section>

      <section className="detail-section">
        <h2>
          Payments to send <CountChip n={toPay.length} />
        </h2>
        <p className="page-subtitle">Receipts are accepted. Send the payment, then mark it paid.</p>
        {toPay.length === 0 && <p className="empty-state">No payments waiting.</p>}
        {toPay.map((r) => (
          <SimpleActionRow
            key={r.id}
            r={r}
            actionLabel="Mark paid"
            action={markPaid}
            actor={actor}
            onError={onError}
          />
        ))}
      </section>

      <section className="detail-section">
        <h2>Yearly amounts</h2>
        <p className="page-subtitle">
          Returning clubs start at {money(RETURNING_ALLOCATION)}, new clubs at {money(NEW_CLUB_ALLOCATION)}.
          Asked-or-spent counts every request that was not denied.
        </p>
        <div className="allocation-search">
          <input
            type="search"
            className="search-input"
            placeholder="Search clubs by name or category"
            aria-label="Search clubs in the yearly amounts table"
            value={clubSearch}
            onChange={(e) => setClubSearch(e.target.value)}
          />
          <span className="allocation-search-count">
            {q ? `${shownClubs.length} of ${sortedClubs.length} clubs` : `${sortedClubs.length} clubs`}
          </span>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Club</th>
                <th>Yearly amount</th>
                <th>Asked or spent</th>
                <th>Left</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {shownClubs.map((c) => (
                <AllocationRow key={c.id} club={c} spend={spend} actor={actor} onError={onError} />
              ))}
              {shownClubs.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-state">
                    {q ? `No clubs match "${clubSearch.trim()}".` : 'No active clubs yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="detail-section">
        <h2>Recent spending</h2>
        {recent.length === 0 && <p className="empty-state">Nothing yet.</p>}
        {recent.map((r) => (
          <div key={r.id} className="spend-row">
            <div className="spend-row-top">
              <div className="spend-summary">
                <strong>{r.clubName}</strong> &mdash; {r.item} ({money(r.amount)})
              </div>
              <StatusPill status={r.status} />
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
