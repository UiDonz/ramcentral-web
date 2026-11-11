// Per-user appearance/layout preferences, saved as one `settings` field on users/{uid}.
// DEFAULT_SETTINGS covers anyone who never opened Settings.
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
export const DEFAULT_SETTINGS = {
  theme: 'light',
  accent: 'forest',
  fontSize: 'default',
  // Order of Home page sections; falls back to this order if none is saved.
  homeLayout: ['myClubs', 'browseClubs'],
  // Background photos live in users/{uid}/backgroundImages (see services/background.js);
  // these fields only say how to use them.
  // backgroundMode: 'off' (default), 'static' (one photo) or 'fade' (rotates a chosen set).
  backgroundMode: 'off',
  backgroundStaticImageId: null,
  backgroundFadeImageIds: []
};
export function mergeSettings(saved) {
  const merged = { ...DEFAULT_SETTINGS, ...(saved || {}) };
  // Migrates the old backgroundEnabled toggle so existing users keep their background.
  if (saved && saved.backgroundEnabled && !saved.backgroundMode) {
    merged.backgroundMode = 'fade';
  }
  return merged;
}
export async function saveUserSettings(uid, settings) {
  await updateDoc(doc(db, 'users', uid), { settings });
}
