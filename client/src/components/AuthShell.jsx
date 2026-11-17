import { Logo, INSTITUTION } from './ui.jsx';

// Two-panel layout shared by the student sign-in and register pages.
export default function AuthShell({ overline, title, text, children }) {
  return (
    <div className="login-shell">
      <div className="login-side">
        <Logo />
        <div style={{ maxWidth: 460 }}>
          <p className="overline">{overline}</p>
          <h1 style={{ fontSize: 'clamp(32px, 4vw, 42px)', lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: 16 }}>{title}</h1>
          <p style={{ color: 'var(--on-dark-muted)', fontSize: 18 }}>{text}</p>
        </div>
        <span style={{ color: 'var(--on-dark-faint)', fontSize: 14 }}>{INSTITUTION} · Complaints &amp; Feedback</span>
      </div>
      <div className="login-main">{children}</div>
    </div>
  );
}
