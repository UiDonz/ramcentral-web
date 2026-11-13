// Saves a user's answers to the new-account questions (majors +
// interests). Written onto the existing users/{uid} doc, so the existing
// "only the owner can update their own doc" rule already covers it - no
// firestore.rules change needed.
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Returns the fields it saved so the caller can mirror them into the
// in-memory profile (AuthContext.updateProfileLocal) without a re-fetch.
export async function saveProfileAnswers(uid, { majors, interests }) {
  const patch = {
    majors: Array.isArray(majors) ? majors : [],
    interests: Array.isArray(interests) ? interests : [],
    onboardingComplete: true
  };
  await updateDoc(doc(db, 'users', uid), patch);
  return patch;
}
