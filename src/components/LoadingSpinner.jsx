
export default function LoadingSpinner({ label = 'Loading...' }) {
  return (
    <div
      className="empty-state"
      role="status"
      aria-live="polite"
    >
      {label}
    </div>
  );
}
