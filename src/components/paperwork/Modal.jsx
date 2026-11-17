import { useEffect } from 'react';
import { createPortal } from 'react-dom';
// A simple pop-up window. It renders into document.body (a "portal") on
// purpose: several forms in this app open it from INSIDE another <form>
// (Create Club), and an input that lives inside a form in the page would
// submit that form when you press Enter. Escape or a click on the dim
// background closes it.
export default function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);
  return createPortal(
    <div
      className="pw-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`pw-modal${wide ? ' pw-modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {' '}
        <div className="pw-modal-head">
          <h2>{title}</h2>
          <button type="button" className="pw-close" aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
