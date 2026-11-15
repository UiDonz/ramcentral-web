
import { useEffect, useRef, useState } from 'react';

import {
  listenToClubMessages,
  sendClubMessage,
} from '../services/messaging';

import {
  reportMessage,
  REPORT_REASONS,
} from '../services/reports';

// Scoped per-club instant messaging.
// Only approved club members can access this component.
export default function ClubChat({ clubId, clubName, uid, name }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const listRef = useRef(null);

  // Report state.
  const [reportingId, setReportingId] = useState(null);
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [reportedIds, setReportedIds] = useState(new Set());
  const [reportNotice, setReportNotice] = useState('');

  // Listen for club messages.
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

  // Automatically scroll to the newest message.
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // Send a chat message.
  async function handleSend(e) {
    e.preventDefault();

    if (!draft.trim() || sending) return;

    setSending(true);

    try {
      await sendClubMessage(clubId, {
        uid,
        name,
        text: draft,
      });

      setDraft('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  // Report a chat message.
  async function handleReport(message) {
    setReportNotice('');

    try {
      await reportMessage({
        clubId,
        clubName,
        message,
        reporter: { uid, name },
        reason,
      });

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
      {/* Loading message */}
      {loading && <p>Loading chat...</p>}

      {/* Error message */}
      {error && <p className="club-chat-error">{error}</p>}

      {/* Empty chat message */}
      {!loading && !error && messages.length === 0 && (
        <p>No messages yet - say hello.</p>
      )}

      {/* Chat messages */}
      <div className="club-chat-messages" ref={listRef}>
        {messages.map((m) => (
          <div className="club-chat-message" key={m.id}>
            <strong>{m.authorName}</strong>

            <p>{m.text}</p>

            {/* You cannot report your own message. */}
            {m.authorId !== uid && (
              <>
                {/* Already reported */}
                {reportedIds.has(m.id) ? (
                  <span>Reported</span>
                ) : reportingId === m.id ? (
                  /* Report form */
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

                    <button
                      type="button"
                      onClick={() => handleReport(m)}
                    >
                      Submit report
                    </button>

                    <button
                      type="button"
                      onClick={() => setReportingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  /* Report button */
                  <button
                    type="button"
                    onClick={() => setReportingId(m.id)}
                  >
                    Report
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Report notification */}
      {reportNotice && (
        <p className="club-chat-notice" role="status">
          {reportNotice}
        </p>
      )}

      {/* Send message form */}
      <form className="club-chat-form" onSubmit={handleSend}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message the club..."
          maxLength={1000}
          aria-label="Message the club"
        />

        <button
          type="submit"
          disabled={sending || !draft.trim()}
        >
          {sending ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
