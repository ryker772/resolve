import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

// Change these in one place to rebrand the site.
export const INSTITUTION = 'Afe Babalola University';
export const INSTITUTION_SHORT = 'ABUAD';

export function LogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#C2410C" />
      <path d="M9 17l5 5 9-11" stroke="#FFFFFF" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ to = '/', small, children }) {
  return (
    <Link to={to} className="logo">
      <LogoMark size={small ? 30 : 32} />
      <span className="logo-word" style={small ? { fontSize: 20 } : undefined}>Resolve</span>
      {children}
    </Link>
  );
}

export function StatusPill({ status, overdue }) {
  return (
    <span className="row gap-4">
      <span className={`pill pill-${status.replace(/\s+/g, '-')}`}>{status}</span>
      {overdue && <span className="pill pill-Overdue">Overdue</span>}
    </span>
  );
}

export function Icon({ d, size = 22, color = 'currentColor', width = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export const ICONS = {
  'Academics': 'M4 6l8-3 8 3-8 3-8-3zM6 8v6c0 2 3 3 6 3s6-1 6-3V8',
  'Hostel & facilities': 'M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6',
  'Fees & finance': 'M3 7h18v10H3zM7 12h.01M17 12h.01M12 14a2 2 0 100-4 2 2 0 000 4z',
  'Staff conduct': 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6',
  'IT & student portal': 'M3 5h18v11H3zM8 20h8M12 16v4',
  'General feedback': 'M4 5h16v11H8l-4 4z',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  check: 'M5 12l5 5L19 7',
  file: 'M14 3H6v18h12V7zM14 3v4h4',
  x: 'M6 6l12 12M18 6L6 18',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'
};

export function SiteHeader() {
  const { user, isStudent, isStaff, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="site-header">
      <div className="container">
        <Logo />
        <nav aria-label="Main" className="nav">
          <Link to="/#how" className="navlink">How it works</Link>
          <Link to="/track" className="navlink">Track a complaint</Link>
          {isStudent && <Link to="/my" className="navlink">My complaints</Link>}
          {isStaff && <Link to="/staff" className="navlink">Staff dashboard</Link>}
          {!user && <Link to="/staff/login" className="navlink">Staff portal</Link>}
          {user ? (
            <button type="button" className="btn btn-ghost-dark btn-sm" onClick={() => { logout(); navigate('/'); }}>
              Sign out{isStudent ? ` (${user.name.split(' ')[0]})` : ''}
            </button>
          ) : (
            <Link to="/login" className="btn btn-ghost-dark btn-sm">Student sign in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <span>© {new Date().getFullYear()} {INSTITUTION} · Resolve complaint &amp; feedback system</span>
        <span className="row gap-20">
          <Link to="/track">Track a complaint</Link>
          <Link to="/login">Student sign in</Link>
          <Link to="/staff/login">Staff portal</Link>
        </span>
      </div>
    </footer>
  );
}

// Progress timeline used on the tracking page.
const STAGES = ['Received', 'Assigned', 'Under investigation', 'Resolved', 'Closed'];
export function stageIndex(c) {
  if (c.status === 'Closed') return 5;
  if (c.status === 'Resolved') return 4;
  if (c.status === 'In progress' || c.status === 'Awaiting student') return c.officerName ? 2 : 1;
  return c.officerName ? 1 : 0;
}

export function Timeline({ complaint }) {
  const at = stageIndex(complaint);
  const meta = [
    complaint.createdAt && new Date(complaint.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }),
    complaint.department,
    complaint.status === 'Awaiting student' ? 'Waiting for your reply' : 'Officer is working on it',
    complaint.resolvedAt ? new Date(complaint.resolvedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Pending',
    'After you confirm the fix'
  ];
  return (
    <ol className="timeline">
      {STAGES.map((s, i) => {
        const state = i < at ? 'done' : i === at ? 'now' : '';
        return (
          <li key={s}>
            <div className="tl-rail">
              <span className={`tl-dot ${state}`} />
              <span className={`tl-line ${i < at ? 'done' : ''}`} />
            </div>
            <div className="tl-body">
              <div style={{ fontWeight: 600 }}>{s}{state === 'now' && <span className="sr-only"> (current stage)</span>}</div>
              <div className="small muted">{i > at && i < 3 ? 'Pending' : meta[i]}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="row gap-12 muted" role="status">
      <span className="spinner" /> {label}
    </div>
  );
}
