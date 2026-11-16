import { useEffect, useRef, useState } from 'react';
import { listenToClubMessages, sendClubMessage } from '../services/messaging';
import { reportMessage, REPORT_REASONS } from '../services/reports';

// Scoped per-club instant messaging - rendered only for approved
// members (see ClubDetail.jsx), so a club nobody has messaged in yet
// costs nothing extra for anyone who isn't a member. Mounting this
// component's listener never blocks the rest of ClubDetail: it's a
// plain onSnapshot like every other real-time feature in this app, so
// the chat panel just shows its own "Loading chat..." state while the
// page around it is already fully interactive.
// clubName is only used to label reports for Staff (Issue #60).
export default function ClubChat({ clubId, clubName, uid, name }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  // Report UI: which message's form is open, the chosen reason, and which
  // messages this session has already reported (shown as "Reported").
  const [reportingId, setReportingId] = useState(null);
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [reportedIds, setReportedIds] = useState(new Set());
  const [reportNotice, setReportNotice] = useState('');

  useEffect(() => {
    const unsub = listenToClubMessages(
      clubId,
      (items) => {
        setMessages(items);
        setLoading(false);
      },
      () => {
        setError('Chat is unavailable right now.');
        setLoading(false);
      }
    );
    return unsub;
  }, [clubId]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await sendClubMessage(clubId, { uid, name, text: draft });
      setDraft('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleReport(message) {
    setReportNotice('');
    try {
      await reportMessage({ clubId, clubName, message, reporter: { uid, name }, reason });
      setReportedIds((prev) => new Set(prev).add(message.id));
      setReportNotice('Thanks - Staff will review this message.');
    } catch (err) {
      setReportNotice(err.message);
    } finally {
      setReportingId(null);
      setReason(REPORT_REASONS[0]);
    }
  }

  return (
    <div className="club-chat">
      <div className="club-chat-messages" ref={listRef}>
        {loading && <p className="empty-state">Loading chat...</p>}
        {error && <p className="form-error">{error}</p>}
        {!loading && !error && messages.length === 0 && (
          <p className="empty-state">No messages yet - say hello.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`club-chat-message${m.authorId === uid ? ' mine' : ''}`}>
            <span className="club-chat-author">{m.authorName}</span>
            <p className="club-chat-text">{m.text}</p>

            {/* You can't report your own message. */}
            {m.authorId !== uid &&
              (reportedIds.has(m.id) ? (
                <span className="club-chat-reported">Reported</span>
              ) : reportingId === m.id ? (
                <div className="club-chat-report-form">
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    aria-label="Reason for report"
                  >
                    {REPORT_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => handleReport(m)}>
                    Submit report
                  </button>
                  <button type="button" className="secondary" onClick={() => setReportingId(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="link-button club-chat-report-btn"
                  onClick={() => setReportingId(m.id)}
                >
                  Report
                </button>
              ))}
          </div>
        ))}
      </div>
      {reportNotice && (
        <p className="club-chat-notice" role="status">
          {reportNotice}
        </p>
      )}
      <form className="club-chat-form" onSubmit={handleSend}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message the club..."
          maxLength={1000}
          aria-label="Message the club"
        />
        <button type="submit" disabled={sending || !draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}