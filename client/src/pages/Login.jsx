import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Logo, INSTITUTION } from '../components/ui.jsx';

export default function Login() {
  const { isStaff, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (isStaff) return <Navigate to="/staff" replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      navigate('/staff');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-side">
        <Logo />
        <div style={{ maxWidth: 460 }}>
          <p className="overline">Staff portal</p>
          <h1 style={{ fontSize: 'clamp(32px, 4vw, 42px)', lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: 16 }}>
            Handle complaints, keep students informed.
          </h1>
          <p style={{ color: 'var(--on-dark-muted)', fontSize: 18 }}>For handling officers, department heads and system administrators.</p>
        </div>
        <span style={{ color: 'var(--on-dark-faint)', fontSize: 14 }}>{INSTITUTION} · Complaints Office</span>
      </div>

      <div className="login-main">
        <form onSubmit={submit} className="card stack gap-20" style={{ width: '100%', maxWidth: 420, padding: 40 }}>
          <h2 style={{ fontSize: 28 }}>Sign in</h2>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <div className="field">
            <label htmlFor="em">Staff email</label>
            <input id="em" type="email" className="input" autoComplete="username" placeholder="name@resolve.test"
              value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="pw">Password</label>
            <input id="pw" type="password" className="input" autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-primary" style={{ minHeight: 52 }} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <p className="small muted" style={{ textAlign: 'center' }}>Student? <Link to="/login">Sign in here</Link> · <Link to="/">Public site</Link></p>
        </form>
      </div>
    </div>
  );
}
