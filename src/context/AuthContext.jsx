import { createContext, useContext, useEffect, useState } from 'react';
import {
 createUserWithEmailAndPassword,
 signInWithEmailAndPassword,
 signOut,
 onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
const AuthContext = createContext(null);
export function useAuth() {
 return useContext(AuthContext);
}
export function AuthProvider({ children }) {
 const [currentUser, setCurrentUser] = useState(null);
 const [profile, setProfile] = useState(null);
 const [loading, setLoading] = useState(true);
 useEffect(() => {
 const unsubscribe = onAuthStateChanged(auth, async (user) => {
 setCurrentUser(user);
 if (user) {
 const snap = await getDoc(doc(db, 'users', user.uid));
 setProfile(snap.exists() ? snap.data() : null);
 } else {
 setProfile(null);
 }
 setLoading(false);
 });
 return unsubscribe;
 }, []);
 // role is 'student' or 'faculty'. Officer status lives on the membership doc (clubs/{clubId}/members/{uid}),
 // since a student can be an officer of one club and a plain member of another.
 async function signup({ email, password, name, ramId, role }) {
 const cred = await createUserWithEmailAndPassword(auth, email, password);
 const userDoc = {
 uid: cred.user.uid,
 name,
 ramId,
 email,
      role: role || 'student',
      bio: '',
      // New-account questions (Onboarding.jsx) fill these in; students
      // are sent there until onboardingComplete is true.
      majors: [],
      interests: [],
      onboardingComplete: false,
      createdAt: serverTimestamp()
    };
    await setDoc(doc(db, 'users', cred.user.uid), userDoc);
 setProfile(userDoc);
 return cred.user;
 }
 function login({ email, password }) {
 return signInWithEmailAndPassword(auth, email, password);
 }
 function logout() {
 return signOut(auth);
  }

  // Merge fields into the in-memory profile after a successful write to
  // users/{uid} (e.g. saving the onboarding answers), so the UI updates
  // without waiting for a re-fetch.
  function updateProfileLocal(patch) {
    setProfile((p) => ({ ...(p || {}), ...patch }));
  }

  const value = { currentUser, profile, loading, signup, login, logout, updateProfileLocal };

  return (
    <AuthContext.Provider value={value}>
 {!loading && children}
 </AuthContext.Provider>
 );
}