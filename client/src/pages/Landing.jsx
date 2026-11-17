import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SiteHeader, SiteFooter, Icon, ICONS, INSTITUTION } from '../components/ui.jsx';
import { useAuth } from '../auth.jsx';

const HOW = [
  ['01', 'Submit', 'Pick a category, describe the issue and attach photos or documents if you have them.'],
  ['02', 'Routed', 'Your ticket goes to the office responsible and is assigned a handling officer.'],
  ['03', 'Investigated', 'The officer looks into it, may ask you questions, and posts updates on your ticket.'],
  ['04', 'Resolved', 'You get the outcome, and can rate the resolution or reopen it if it isn’t fixed.']
];

const CATS = [
  ['Academics', 'Results, lecturers, course registration'],
  ['Hostel & facilities', 'Water, power, repairs, cleanliness'],
  ['Fees & finance', 'Payments, refunds, bursary issues'],
  ['Staff conduct', 'Behaviour of staff or officials'],
  ['IT & student portal', 'Login, Wi-Fi, portal errors'],
  ['General feedback', 'Suggestions and compliments']
];

export default function Landing() {
  const navigate = useNavigate();
  const { isStudent } = useAuth();
  const { hash } = useLocation();
  const [ticket, setTicket] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' });
  }, [hash]);

  function track(e) {
    e.preventDefault();
    const t = ticket.trim().toUpperCase();
    if (t) navigate(`/track/${encodeURIComponent(t)}?code=${encodeURIComponent(code.trim().toUpperCase())}`);
  }

  return (
    <>
      <SiteHeader />
      <section className="hero">
        <div className="container">
          <div style={{ flex: '1 1 480px', minWidth: 0 }}>
            <p className="overline">{INSTITUTION} · Complaints &amp; Feedback</p>
            <h1>Every complaint gets a ticket, an owner and an answer.</h1>
            <p className="hero-sub">
              Report an issue or share feedback in a few minutes. It’s routed to the right office, and you can follow it
              until it’s resolved.
            </p>
            <div className="row gap-12">
              <Link to="/submit" className="btn btn-primary">Submit a complaint</Link>
              <Link to="/submit?kind=Feedback" className="btn btn-ghost-dark">Give feedback</Link>
            </div>
            <form className="lookup" onSubmit={track}>
              <label htmlFor="ticket">Already submitted? Enter your ticket ID and access code</label>
              <input id="ticket" className="input" placeholder="RSV-2026-0001" value={ticket} onChange={(e) => setTicket(e.target.value)} />
              <label htmlFor="code" className="sr-only">Access code</label>
              <input id="code" className="input" style={{ flex: '0 1 130px' }} placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
              <button className="btn btn-secondary" type="submit">Track</button>
            </form>
          </div>

          <div style={{ flex: '1 1 400px', minWidth: 0, display: 'flex', justifyContent: 'center' }}>
            <div className="preview-card" aria-label="Example of a tracked complaint">
              <div className="row between gap-12" style={{ marginBottom: 6 }}>
                <span className="mono small muted">RSV-2026-0412</span>
                <span className="pill pill-In-progress">In progress</span>
              </div>
              <h2 style={{ fontSize: 21, marginBottom: 20 }}>Hostel water supply out since Monday</h2>
              <ol className="timeline">
                {[
                  ['Received', 'Mon 09:14 · Ticket created', 'done'],
                  ['Assigned to Hostel Management', 'Mon 11:02 · Officer assigned', 'done'],
                  ['Under investigation', 'Tue 08:40 · Plumber dispatched', 'now'],
                  ['Resolved', 'Pending', '']
                ].map(([t, m, s]) => (
                  <li key={t}>
                    <div className="tl-rail"><span className={`tl-dot ${s}`} /><span className={`tl-line ${s === 'done' ? 'done' : ''}`} /></div>
                    <div className="tl-body"><div style={{ fontWeight: 600 }}>{t}</div><div className="small muted">{m}</div></div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="section">
        <div className="container">
          <h2 style={{ marginBottom: 12 }}>How it works</h2>
          <p className="muted" style={{ fontSize: 18, marginBottom: 40 }}>Four stages, visible to you the whole way through.</p>
          <div className="grid-auto">
            {HOW.map(([n, t, b]) => (
              <div key={n} className="card" style={{ borderRadius: 14 }}>
                <div className="step-num">{n}</div>
                <h3 style={{ fontSize: 21, marginBottom: 8 }}>{t}</h3>
                <p className="muted">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '24px 0 88px' }}>
        <div className="container">
          <h2 style={{ fontSize: 'clamp(30px, 4vw, 40px)', marginBottom: 32 }}>What can I report?</h2>
          <div className="grid-auto" style={{ gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            {CATS.map(([t, b]) => (
              <Link key={t} to={`/submit?category=${encodeURIComponent(t)}`} className="cat-link">
                <span className="icon-box"><Icon d={ICONS[t]} color="#12213A" /></span>
                <span>
                  <span style={{ display: 'block', fontWeight: 600 }}>{t}</span>
                  <span className="small muted" style={{ display: 'block' }}>{b}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section style={{ paddingBottom: 24 }}>
        <div className="container">
          <div className="card row gap-32" style={{ padding: 48, borderRadius: 20, background: 'var(--ink)', color: '#fff', border: 0 }}>
            <div style={{ flex: '1 1 420px', minWidth: 0 }}>
              <h2 style={{ fontSize: 30, marginBottom: 12 }}>{isStudent ? 'Welcome back' : 'Keep all your complaints in one place'}</h2>
              <p style={{ fontSize: 17, color: 'var(--on-dark-muted)' }}>
                {isStudent
                  ? 'See every complaint you’ve submitted, its status and any replies from staff.'
                  : 'Create a free student account with your matric number to see every complaint you’ve made, without keeping ticket IDs and access codes. You can still submit as a guest.'}
              </p>
            </div>
            {isStudent ? (
              <Link to="/my" className="btn btn-primary">Go to My complaints</Link>
            ) : (
              <div className="row gap-12">
                <Link to="/register" className="btn btn-primary">Create account</Link>
                <Link to="/login" className="btn btn-ghost-dark">Sign in</Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <section style={{ paddingBottom: 96, paddingTop: 16 }}>
        <div className="container">
          <div className="card row gap-32" style={{ padding: 48, borderRadius: 20 }}>
            <div style={{ flex: '1 1 420px', minWidth: 0 }}>
              <h2 style={{ fontSize: 30, marginBottom: 12 }}>Prefer to stay anonymous?</h2>
              <p className="muted" style={{ fontSize: 17 }}>
                You can submit without your name. You’ll still get a ticket ID and a private access code to follow
                updates and reply to the handling officer.
              </p>
            </div>
            <Link to="/submit?anonymous=1" className="btn btn-dark">Submit anonymously</Link>
          </div>
        </div>
      </section>
      <SiteFooter />
    </>
  );
}
