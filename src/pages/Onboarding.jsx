import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { saveProfileAnswers } from '../services/profile';
import MajorInterestPicker from '../components/MajorInterestPicker';

// Shown once, right after signup (and once to students whose account
// pre-dates this feature) - see the onboarding gate in App.jsx. Skipping
// still marks onboarding complete, so nobody is nagged again; they can
// fill it in any time from Profile.
export default function Onboarding() {
  const { currentUser, profile, updateProfileLocal } = useAuth();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState({
    majors: profile?.majors || [],
    interests: profile?.interests || []
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function finish(payload) {
    setError('');
    setSaving(true);
    try {
      const saved = await saveProfileAnswers(currentUser.uid, payload);
      updateProfileLocal(saved);
      navigate('/', { replace: true });
    } catch (err) {
      setError('Could not save your answers. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div className="page narrow">
      <h1>Welcome{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}!</h1>
      <p className="page-subtitle">
        Two quick questions so we can suggest clubs that students in your major actually join. You can
        change these any time from your profile.
      </p>
      {error && <p className="form-error">{error}</p>}
      <MajorInterestPicker {...answers} onChange={setAnswers} />
      <div className="form-actions">
        <button type="button" disabled={saving} onClick={() => finish(answers)}>
          {saving ? 'Saving...' : 'Save and continue'}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={saving}
          onClick={() => finish({ majors: [], interests: [] })}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
