import { createContext, useContext, useEffect, useState } from 'react';
import {
 createUserWithEmailAndPassword,
 signInWithEmailAndPassword,
 signOut,
 onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
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
 // The profile is LIVE (onSnapshot), so when an admin approves a Staff
 // request the Admin tab appears without logging out.
 let stopProfile = null;
 const unsubscribe = onAuthStateChanged(auth, (user) => {
 setCurrentUser(user);
 if (stopProfile) {
   stopProfile();
   stopProfile = null;
 }
 if (user) {
   stopProfile = onSnapshot(
     doc(db, 'users', user.uid),
     (snap) => {
       setProfile(snap.exists() ? snap.data() : null);
       setLoading(false);
     },
     () => {
       setProfile(null);
       setLoading(false);
     }
   );
 } else {
   setProfile(null);
   setLoading(false);
 }
 });
 return () => {
   unsubscribe();
   if (stopProfile) stopProfile();
 };
 }, []);
 // role is 'student' or 'faculty' (Staff). Every account starts as a student;
 // picking "Staff" on Sign up files a request an admin approves (services/staffRequests.js).
 // Officer status lives on the membership doc (clubs/{clubId}/members/{uid}),
 // since a student can be an officer of one club and a plain member of another.
 async function signup({ email, password, name, ramId, role }) {
 const cred = await createUserWithEmailAndPassword(auth, email, password);
 const wantsStaff = role === 'staff';
 const userDoc = {
 uid: cred.user.uid,
 name,
 ramId,
 email,
      role: 'student',
      ...(wantsStaff ? { staffRequest: 'pending' } : {}),
      bio: '',
      // New-account questions (Onboarding.jsx) fill these in; students
      // are sent there until onboardingComplete is true.
      majors: [],
      interests: [],
      onboardingComplete: false,
      createdAt: serverTimestamp()
    };
    await setDoc(doc(db, 'users', cred.user.uid), userDoc);
    if (wantsStaff) {
      await setDoc(doc(db, 'staffRequests', cred.user.uid), {
        uid: cred.user.uid,
        name,
        email,
        ramId: ramId || '',
        status: 'pending',
        createdAt: serverTimestamp()
      });
    }
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