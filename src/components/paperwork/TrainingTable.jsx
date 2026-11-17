import { useEffect, useState } from 'react';
import { TRAININGS } from '../../data/clubRequirements';
import { listenToTrainings, setTrainingDone, setTrainingVerified } from '../../services/clubPaperwork';
import { CLUB_ROLE_LABELS, isClubOfficerRole, rankOf } from '../../services/rbac';
// Who has finished which of Farmingdale's required officer trainings.
// The trainings themselves happen in Farmingdale's systems (the "Go to
// training" links); this table only tracks them. An officer can mark ONLY
// their own column done; Staff can verify any cell against Farmingdale's
// records. Columns are the club's current approved officers.
export default function TrainingTable({ clubId, members, memberNames, currentUser, isStaffUser, actor }) {
  const [records, setRecords] = useState({});
  const [error, setError] = useState('');
  useEffect(() => listenToTrainings(clubId, setRecords), [clubId]);
  const officers = members
    .filter((m) => m.status === 'approved' && isClubOfficerRole(m.role))
    .sort((a, b) => rankOf(a.role) - rankOf(b.role));
  async function run(fn, ...args) {
    setError('');
    try {
      await fn(...args);
    } catch (err) {
      setError(err.message || 'Could not save that.');
    }
  }
  if (officers.length === 0) {
    return <p className="empty-state">Officers will show up here once they've joined the club.</p>;
  }

  return (
    <div className="pw-training">
      {error && <p className="form-error">{error}</p>}
      <div className="admin-table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Training</th>
              {officers.map((o) => (
                <th key={o.uid}>
                  {memberNames[o.uid] || '...'}
                  <div className="pw-sub">{CLUB_ROLE_LABELS[o.role] || o.role}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TRAININGS.map((t) => (
              <tr key={t.key}>
                <td>
                  {t.label}
                  <div className="pw-sub">
                    {t.note}{' '}
                    <a href={t.url} target="_blank" rel="noreferrer">
                      Go to training
                    </a>
                  </div>
                </td>
                {officers.map((o) => {
                  const rec = records[o.uid] || {};
                  const verified = rec.verified && rec.verified[t.key];
                  const done = rec.done && rec.done[t.key];
                  const mine = o.uid === currentUser.uid;
                  return (
                    <td key={o.uid}>
                      {verified ? (
                        <span className="pw-ok">&#10003; Verified</span>
                      ) : done ? (
                        <span className="pw-ok">&#10003; Done</span>
                      ) : (
                        <span className="pw-needed">Needed</span>
                      )}
                      {mine && !verified && (
                        <div>
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => run(setTrainingDone, clubId, o.uid, t.key, !done)}
                          >
                            {' '}
                            {done ? 'Undo' : 'Mark done'}
                          </button>
                        </div>
                      )}
                      {isStaffUser && (done || verified) && (
                        <div>
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => run(setTrainingVerified, clubId, o.uid, t.key, !verified, actor)}
                          >
                            {verified ? 'Remove check' : 'Verify'}
                          </button>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
