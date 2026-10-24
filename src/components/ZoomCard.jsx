import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Shared body-scroll lock: opening a zoom card - from anywhere in the app -
// disables the page's own scrolling while it's open (standard modal
// behavior, and it also doubles as the signal the News page's auto-scroll
// checks before nudging itself). A counter, not a boolean, so it still
// works correctly if a second card somehow opens before the first fully
// closes.

let lockCount = 0;
function lockPageScroll() {
lockCount += 1;
document.body.classList.add('zoom-locked');
}
function unlockPageScroll() {
lockCount = Math.max(0, lockCount - 1);
if (lockCount === 0) document.body.classList.remove('zoom-locked');
}
const TRANSITION_MS = 320;

// A "Medium-style" shared-element zoom. Clicking the compact `preview` grows
// it, from its exact spot on the page, into a large panel centered on the
// screen - then shrinks it back down to exactly where it started when
// dismissed, instead of a modal that just appears/disappears out of nowhere.
//
// How the FLIP trick works here: on open, we read the source element's
// on-screen position (getBoundingClientRect) and render the portal panel
// pinned to those exact coordinates first (via inline style, position:
// fixed) - then, one frame later, swap to the centered "open" layout via a
// CSS class. Because the browser actually painted the first position
// before the swap, it has something concrete to transition from. Closing
// does the same thing in reverse: re-read the source's current position
// (it may have scrolled since opening) and animate back to it.
//
// Dismiss by: the close (x) button, clicking the dimmed backdrop, pressing
// Escape, or clicking the opened panel itself a second time (this used to
// close on hover-off instead, but that meant the panel could slam shut
// mid-open if your cursor wasn't already sitting where the panel would end
// up - a plain click toggle doesn't have that problem).

export default function ZoomCard({ className = '', preview, expanded, ariaLabel, onOpenChange }) {
const sourceRef = useRef(null);
const [phase, setPhase] = useState('closed'); // closed -> opening -> open -> closing -> closed
const [rect, setRect] = useState(null);
function open() {
if (!sourceRef.current || phase !== 'closed') return;
setRect(sourceRef.current.getBoundingClientRect());
setPhase('opening');
lockPageScroll();
onOpenChange?.(true);
requestAnimationFrame(() => requestAnimationFrame(() => setPhase('open')));
}
function close() {if (phase !== 'open' && phase !== 'opening') return;
if (sourceRef.current) setRect(sourceRef.current.getBoundingClientRect());
setPhase('closing');
onOpenChange?.(false);
window.setTimeout(() => {
setPhase('closed');
unlockPageScroll();
}, TRANSITION_MS);
}
useEffect(() => {
if (phase === 'closed') return undefined;
function onKeyDown(e) {
if (e.key === 'Escape') close();
}
window.addEventListener('keydown', onKeyDown);
return () => window.removeEventListener('keydown', onKeyDown);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [phase]);
// Safety net so navigating away (or any unmount) while a card happens to
// be open never leaves the page permanently scroll-locked.
useEffect(() => {
return () => {
if (phase === 'open' || phase === 'opening') unlockPageScroll();
};
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
const isMounted = phase !== 'closed';
const isOpen = phase === 'open';
return (
<>
<div
ref={sourceRef}
className={className}
role="button"
tabIndex={0}
aria-label={ariaLabel}
onClick={open}
onKeyDown={(e) => {
if (e.key === 'Enter' || e.key === ' ') {
e.preventDefault();
open();
}
}}
>
{preview}
</div>
{isMounted &&
rect &&
createPortal(
<div className={`zoom-overlay${isOpen ? ' open' : ''}`} onClick={close}>
<div
className={`zoom-panel${isOpen ? ' open' : ''}`}
style={isOpen ? undefined : { top: rect.top, left: rect.left, width: rect.width, height:
rect.height }}
onClick={close}
>
<button type="button" className="zoom-close" onClick={close} aria-label="Close">
&times;
</button>
{expanded}
</div>
</div>,
document.body
)}
</>
);
}