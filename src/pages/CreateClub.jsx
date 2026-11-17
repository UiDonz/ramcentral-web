import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createClub } from '../services/clubs';
import { submitApplication } from '../services/clubPaperwork';
import PaperworkChecklist, { missingPaperwork } from '../components/paperwork/PaperworkChecklist';
export default function CreateClub() {
  const { currentUser, profile } = useAuth();
  const navigate = useNavigate();
  // The "Add to NewRamCentral" link in the All Farmingdale clubs tab opens
  // this page with ?name=...&category=... so those two fields start filled in.
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    name: searchParams.get('name') || '',
    description: '',
    category: searchParams.get('category') || '',
    meetingTimes: '',
    contactInfo: '',
    requiresApproval: false
  });
  const [submitting, setSubmitting] = useState(false);
  // Farmingdale's new-club paperwork (see components/paperwork). Kept apart
  // from `form` so the original club fields work exactly as before.

  const [paperwork, setPaperwork] = useState({
    officers: null,
    roster: null,
    constitution: null,
    advisor: null
  });
  const missing = missingPaperwork(paperwork);
  function update(field) {
    return (e) => {
      const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      setForm((f) => ({ ...f, [field]: value }));
    };
  }
  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    const clubId = await createClub({ ...form, creatorUid: currentUser.uid });
    try {
      await submitApplication(
        clubId,
        form.name,
        {
          uid: currentUser.uid,
          name: profile?.name,
          email: currentUser.email || profile?.email,
          role: profile?.role
        },
        paperwork
      );
    } catch (err) {
      // The club itself exists; if the paperwork didn't save, the officer
      // can finish it from the club page's "Club paperwork" section.
      console.error('Could not save club paperwork', err);
    }
    navigate(`/clubs/${clubId}`);
  }
  return (
    <div className="page narrow">
      <h1>Start a new club</h1>
      <p className="page-subtitle">
        You'll be the club's first officer (President) once it's approved. Your application goes to Staff's
        approval queue first and won't appear in the public directory until a Staff member approves it - you
        can still view and manage it from its own page while it waits.
      </p>
      <form onSubmit={handleSubmit} className="inline-form">
        <label>
          Club name
          <input value={form.name} onChange={update('name')} required />
        </label>
        <label>
          Category
          <input
            value={form.category}
            onChange={update('category')}
            placeholder="e.g. Academic, Cultural, Sports"
          />{' '}
        </label>
        <label>
          Description
          <textarea value={form.description} onChange={update('description')} required />
        </label>
        <label>
          Meeting times
          <input
            value={form.meetingTimes}
            onChange={update('meetingTimes')}
            placeholder="e.g. Thursdays 5pm, Room 201"
          />{' '}
        </label>
        <label>
          Contact info
          <input value={form.contactInfo} onChange={update('contactInfo')} />
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={form.requiresApproval} onChange={update('requiresApproval')} />
          Require officer approval for new members
        </label>
        <PaperworkChecklist
          value={paperwork}
          onChange={(patch) => setPaperwork((p) => ({ ...p, ...patch }))}
          clubName={form.name}
          defaults={{
            uid: currentUser.uid,
            name: profile?.name,
            email: currentUser.email || profile?.email,
            ram: profile?.ramId
          }}
        />
        <button type="submit" disabled={submitting || missing.length > 0}>
          {submitting ? 'Submitting...' : 'Submit for approval'}
        </button>{' '}
        {missing.length > 0 && <p className="pw-hint">Still needed: {missing.join(', ')}.</p>}
      </form>
    </div>
  );
}
