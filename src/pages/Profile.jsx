import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { saveProfileAnswers } from '../services/profile';
import MajorInterestPicker from '../components/MajorInterestPicker';

export default function Profile() {
  const { currentUser, profile, updateProfileLocal, logout } = useAuth();
  const navigate = useNavigate();
  const [bio, setBio] = useState(profile?.bio || '');
  const [saved, setSaved] = useState(false);
  const [answers, setAnswers] = useState({
    majors: profile?.majors || [],
    interests: profile?.interests || []
  });
  const [answersSaved, setAnswersSaved] = useState(false);
  const [answersError, setAnswersError] = useState('');

  async function handleSave(e) {
    e.preventDefault();
    await updateDoc(doc(db, 'users', currentUser.uid), { bio });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleSaveAnswers(e) {
    e.preventDefault();
      setAnswersError('');
      try {
        const patch = await saveProfileAnswers(currentUser.uid, answers, profile?.majors || []);
        updateProfileLocal(patch);
        setAnswersSaved(true);
        setTimeout(() => setAnswersSaved(false), 2000);
    } catch (err) {
      setAnswersError('Could not save. Please try again.');
    }
  }

  return (
    <div className="page narrow">
      <div className="page-header">
        <h1>{profile?.name}</h1>
        {/* On phones the bottom bar has no room for Log out, so it lives here too. */}
        <button
          type="button"
          className="secondary"
          onClick={async () => {
            await logout();
            navigate('/login');
          }}
        >
          Log out
        </button>
      </div>
      <p className="club-card-category">
        {profile?.role} &middot; {profile?.ramId}
      </p>
      <p>{profile?.email}</p>
      <form onSubmit={handleSave} className="inline-form">
        <label>
          Bio
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell other members a bit about yourself"
          />
        </label>
        <button type="submit">Save</button>
        {saved && <span className="badge">Saved</span>}
      </form>

      {profile?.role === 'student' && (
        <form onSubmit={handleSaveAnswers} className="inline-form">
          <h2>Major &amp; interests</h2>
          <p className="page-subtitle">Used to recommend clubs that students in your major join.</p>
          {answersError && <p className="form-error">{answersError}</p>}
          <MajorInterestPicker {...answers} onChange={setAnswers} />
          <button type="submit">Save major &amp; interests</button>
          {answersSaved && <span className="badge">Saved</span>}
        </form>
      )}
    </div>
  );
}
