import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Shared body-scroll lock while any zoom card is open (News auto-scroll also checks it). A counter, so overlapping cards work.

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

// Medium-style shared-element zoom: the preview grows from its exact spot into a centered panel and shrinks back on close.
// FLIP trick: render at the source's coordinates first, then swap to the centered class a frame later,
// so the browser has a painted position to animate from (closing does the reverse).
// Close with the x button, the backdrop, Escape, or a second click on the panel.

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
// Safety net: never leave the page scroll-locked if the card unmounts while open.
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