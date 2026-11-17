// Plays the sign-in zoom before leaving the Log in / Sign up page. The app
// reads the flag on its first render and zooms itself in (App.jsx).
export const ZOOM_FLAG = 'rc-zoom-in';

export function playAuthZoom(setZooming) {
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  try {
    if (!reduced) sessionStorage.setItem(ZOOM_FLAG, '1');
  } catch {
    // Storage can be blocked (private windows); the zoom-in just won't play.
  }
  if (reduced) return Promise.resolve();
  setZooming(true);
  return new Promise((resolve) => setTimeout(resolve, 650));
}

// True once, right after a sign-in zoom; clears the flag.
export function takeZoomFlag() {
  try {
    const on = sessionStorage.getItem(ZOOM_FLAG) === '1';
    sessionStorage.removeItem(ZOOM_FLAG);
    return on;
  } catch {
    return false;
  }
}
