import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

// Tells someone who signed up as Staff where their request stands: waiting
// for an admin, or denied (shown once, until they dismiss it).
export default function StaffStatusNote() {
  const { currentUser, profile } = useAuth();
  if (!profile || !currentUser) return null;
  if (profile.staffRequest === 'pending') {
    return (
      <div className="staff-note" role="status">
        Your Staff access is waiting for an admin to approve it. You can use the app as usual in the meantime;
        the Admin tab appears once you're approved.
      </div>
    );
  }
  if (profile.staffRequest === 'denied' && !profile.staffDeniedSeen) {
    return (
      <div className="staff-note staff-note-denied" role="status">
        <span>Your Staff request was not approved, so this is a Student account.</span>
        <button
          type="button"
          className="link-button"
          onClick={() => updateDoc(doc(db, 'users', currentUser.uid), { staffDeniedSeen: true }).catch(() => {})}
        >
          OK
        </button>
      </div>
    );
  }
  return null;
}
