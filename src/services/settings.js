// Per-user appearance/layout preferences. Deliberately layered onto the
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const DEFAULT_SETTINGS = {
theme: 'light',
accent: 'forest',
fontSize: 'default',
homeLayout: ['myClubs', 'browseClubs']
};
export function mergeSettings(saved) {
return { ...DEFAULT_SETTINGS, ...(saved || {}) };
}
export async function saveUserSettings(uid, settings) {
await updateDoc(doc(db, 'users', uid), { settings });
}
