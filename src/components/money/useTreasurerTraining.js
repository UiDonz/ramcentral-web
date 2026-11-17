import { useEffect, useState } from 'react';
import { listenToMembers } from '../../services/clubs';
import { listenToTrainings } from '../../services/clubPaperwork';

// Is the club's Treasurer done with the SGA Finance Training? The OSA
// orientation says Treasurers are required to take it. Returns null until
// loaded, then { ok, text } for a green or amber label.
export default function useTreasurerTraining(clubId) {
  const [members, setMembers] = useState(null);
  const [records, setRecords] = useState(null);
  useEffect(() => listenToMembers(clubId, setMembers), [clubId]);
  useEffect(() => listenToTrainings(clubId, setRecords), [clubId]);
  if (members === null || records === null) return null;
  const t = members.find((m) => m.status === 'approved' && m.role === 'treasurer');
  if (!t) return { ok: false, text: 'The club has no Treasurer yet' };
  const rec = records[t.uid] || {};
  if (rec.verified && rec.verified.financial)
    return { ok: true, text: 'Treasurer finished the SGA Finance Training (verified)' };
  if (rec.done && rec.done.financial)
    return { ok: true, text: 'Treasurer finished the SGA Finance Training (not yet verified by Staff)' };
  return { ok: false, text: 'The Treasurer has not finished the SGA Finance Training' };
}
