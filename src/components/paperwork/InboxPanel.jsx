import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  listenToMyInvites,
  listenToMyAdvisorRequests,
  respondToInvite,
  respondToAdvisorRequest
} from '../../services/clubPaperwork';

import { CLUB_ROLE_LABELS } from '../../services/rbac';
// Things waiting on YOU, shown at the top of the Clubs page and nowhere else
// (it renders nothing at all when there's nothing waiting):
// - "You were listed as a founding member of <club>" invitations (Join / Decline)
// - "<club> asked you to be their advisor" requests (Accept / Decline)
export default function InboxPanel() {
  const { currentUser, profile } = useAuth();
  const [invites, setInvites] = useState([]);
  const [advisorRequests, setAdvisorRequests] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  // firestore.rules match invitations against the signed-in account's email.
  const email = currentUser?.email || profile?.email || '';
  useEffect(() => {
    if (!email) return undefined;
    return listenToMyInvites(email, setInvites);
  }, [email]);
  useEffect(() => {
    if (!currentUser || profile?.role !== 'faculty') return undefined;
    return listenToMyAdvisorRequests(currentUser.uid, setAdvisorRequests);
  }, [currentUser, profile?.role]);
  async function run(id, fn) {
    setError('');
    setBusyId(id);
    try {
      await fn();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    }
    setBusyId(null);
  }
  if (invites.length === 0 && advisorRequests.length === 0) return null;
  return (
    <section className="pw-inbox" aria-label="Waiting for you">
      <h2>Waiting for you</h2>
      {error && <p className="form-error">{error}</p>}
      {invites.map((inv) => (
        <div key={inv.id} className="pw-inbox-row">
          <span>
            You were listed as{' '}
            {inv.role && inv.role !== 'member'
              ? `the ${CLUB_ROLE_LABELS[inv.role] || inv.role}`
              : 'a founding member'}{' '}
            of <strong>{inv.clubName}</strong>. Join?
          </span>
          <span className="form-actions">
            <button
              type="button"
              disabled={busyId === inv.id}
              onClick={() =>
                run(inv.id, () => respondToInvite(inv, true, currentUser.uid, profile?.majors || []))
              }
            >
              Join
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busyId === inv.id}
              onClick={() => run(inv.id, () => respondToInvite(inv, false, currentUser.uid))}
            >
              Decline
            </button>
          </span>
        </div>
      ))}
      {advisorRequests.map((req) => (
        <div key={req.id} className="pw-inbox-row">
          <span>
            <strong>{req.clubName}</strong> asked you to be their faculty advisor. By accepting you agree to
            the Advisor Agreement: check in with the club at least monthly, share college policies, and
            report any Title IX or crime concerns as the Advisor Guide describes.{' '}
            <Link to={`/clubs/${req.clubId}`}>See the club</Link>
          </span>
          <span className="form-actions">
            <button
              type="button"
              disabled={busyId === req.id}
              onClick={() => run(req.id, () => respondToAdvisorRequest(req.id, true))}
            >
              Accept
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busyId === req.id}
              onClick={() => run(req.id, () => respondToAdvisorRequest(req.id, false))}
            >
              Decline
            </button>
          </span>
        </div>
      ))}
    </section>
  );
}
