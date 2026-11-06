import { useEffect, useRef, useState } from 'react';
import { listenToClubMessages, sendClubMessage } from '../services/messaging';

// Scoped per-club instant messaging - rendered only for approved
// members (see ClubDetail.jsx), so a club nobody has messaged in yet
// costs nothing extra for anyone who isn't a member. Mounting this
// component's listener never blocks the rest of ClubDetail: it's a
// plain onSnapshot like every other real-time feature in this app, so
// the chat panel just shows its own "Loading chat..." state while the
// page around it is already fully interactive.
export default function ClubChat({ clubId, uid, name }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

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
  }, [messages]);

  if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;

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

  return (
    <><div className="club-chat">
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
          </div>
        ))}
      </div>
      <form className="club-chat-form" onSubmit={handleSend}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message the club..."
          maxLength={1000}
          aria-label="Message the club" />
      </form>
    </div><button type="submit" disabled={sending || !draft.trim()}>Send</button></>
  );
}