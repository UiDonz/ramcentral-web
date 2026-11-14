// Saves a user's answers to the new-account questions (majors +
// interests). Written onto the existing users/{uid} doc, so the existing
// "only the owner can update their own doc" rule already covers it - no
// firestore.rules change needed.
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { syncMajorStatsForUser } from './clubs';

// Returns the fields it saved so the caller can mirror them into the
// in-memory profile (AuthContext.updateProfileLocal) without a re-fetch.
//
// previousMajors is what the user had saved BEFORE this edit - it's used
// to adjust the major stats on every club they've already joined
// (see syncMajorStatsForUser in clubs.js). A stats failure is logged but
// doesn't fail the save: the profile edit itself already succeeded and
// Staff can rebuild any drifted counters with "Recompute major stats".
export async function saveProfileAnswers(uid, { majors, interests }, previousMajors = []) {
   const patch = {
      majors: Array.isArray(majors) ? majors : [],
      interests: Array.isArray(interests) ? interests : [],
      onboardingComplete: true
   };
   await updateDoc(doc(db, 'users', uid), patch);
   try {
      await syncMajorStatsForUser(uid, previousMajors, patch.majors);
   } catch (err) {
      console.error('[profile] syncMajorStatsForUser failed:', err);
   }
   return patch;
}
