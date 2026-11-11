// Per-user background photos (Settings > Background).
// Stored as compressed base64 strings, one doc each in users/{uid}/backgroundImages
// (not Firebase Storage, which this project doesn't use).
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.72;

// Firestore's cap is 1MB per doc; base64 adds about a third on top of the raw bytes.
const MAX_DATA_URL_LENGTH = 900000;
// Resizes and re-encodes the photo in the browser so it fits in a Firestore doc.
export function compressImageForBackground(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read that image file.'));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        if (dataUrl.length > MAX_DATA_URL_LENGTH) {
          reject(new Error('That image is too large even after compressing - try a smaller photo.'));
          return;
        }
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
export function listenToBackgroundImages(uid, callback) {
  const q = query(collection(db, 'users', uid, 'backgroundImages'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}
export async function addBackgroundImage(uid, dataUrl) {
  await addDoc(collection(db, 'users', uid, 'backgroundImages'), {
    dataUrl,
    createdAt: serverTimestamp()
  });
}
export async function removeBackgroundImage(uid, imageId) {
  await deleteDoc(doc(db, 'users', uid, 'backgroundImages', imageId));
}
