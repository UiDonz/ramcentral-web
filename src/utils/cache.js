// Small localStorage cache with an expiry, used to avoid re-reading Firestore data that
// rarely changes (news, academic calendar) on every page visit. Every access is wrapped in
// try/catch because storage can be blocked (private mode, full quota).
const PREFIX = 'rc-cache:';

export function readCache(key, maxAgeMs) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw);
    if (Date.now() - t > maxAgeMs) return null;
    return v;
  } catch {
    return null;
  }
}

// Like readCache, but also returns when it was saved ({ t, v }), or null.
export function readCacheEntry(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeCache(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ t: Date.now(), v: value }));
  } catch {
    // Storage full or blocked: just skip caching.
  }
}
