import Logo from './Logo';

// Shared frame for the Log in and Sign up pages: an animated green/gold
// backdrop, the RamConnect brand on one side and the form card on the other.
// When `zooming` is true (a successful sign-in or sign-up), the card zooms
// toward the viewer and the backdrop fades, then the app zooms in behind it
// (see .app-zoom-in in app.css).
export default function AuthLayout({ zooming, children }) {
  return (
    <div className={`auth-page${zooming ? ' zooming' : ''}`}>
      <div className="auth-bg" aria-hidden="true">
        <span className="auth-blob auth-blob-1" />
        <span className="auth-blob auth-blob-2" />
        <span className="auth-blob auth-blob-3" />
      </div>

      <div className="auth-inner">
        <section className="auth-brand">
          <Logo size={88} />
          <h1 className="auth-brand-name">
            Ram<span>Connect</span>
          </h1>
        </section>

        <div className="auth-card">{children}</div>
      </div>
    </div>
  );
}
