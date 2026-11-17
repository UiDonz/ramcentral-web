// Firebase initialization.
// Fill in .env (copied from .env.example) with your project's config values.
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
 getFirestore,
 initializeFirestore,
 persistentLocalCache,
 persistentMultipleTabManager
} from 'firebase/firestore';
const firebaseConfig = {
 apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
 authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
 projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
 storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
 messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
 appId: import.meta.env.VITE_FIREBASE_APP_ID
};
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Keep a local copy of what was last loaded (IndexedDB, shared across tabs), so
// coming back to a page shows the saved clubs / inbox / counts instantly and
// then updates live, instead of waiting on the network every time. Falls back
// to the normal in-memory setup if the browser can't store it (private mode).
function makeDb() {
 try {
  return initializeFirestore(app, {
   localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
 } catch (err) {
  console.warn('[firebase] offline cache unavailable, using memory only', err);
  return getFirestore(app);
 }
}
export const db = makeDb();
export default app;