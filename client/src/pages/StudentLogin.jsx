import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import AuthShell from '../components/AuthShell.jsx';

export default function StudentLogin() {
  const { isStudent, studentLogin } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next')?.startsWith('/') ? params.get('next') : '/my';
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (isStudent) return <Navigate to={next} replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await studentLogin(identifier.trim(), password);
      navigate(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell overline="Student account" title="Every complaint you’ve made, in one place."
      text="Sign in to submit faster and follow all your tickets without keeping access codes.">
      <form onSubmit={submit} className="card stack gap-20" style={{ width: '100%', maxWidth: 420, padding: 40 }}>
        <h2 style={{ fontSize: 28 }}>Student sign in</h2>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <div className="field">
          <label htmlFor="id">Matric number or email</label>
          <input id="id" className="input" autoComplete="username" placeholder="e.g. 23/SCI01/022"
            value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="pw">Password</label>
          <input id="pw" type="password" className="input" autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn btn-primary" style={{ minHeight: 52 }} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="small muted" style={{ textAlign: 'center' }}>
          New here? <Link to={`/register${next !== '/my' ? `?next=${encodeURIComponent(next)}` : ''}`}>Create an account</Link>
        </p>
        <p className="small muted" style={{ textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          No account? You can still <Link to="/submit">submit as a guest</Link> or <Link to="/track">track with a ticket ID</Link>.
          <br />Staff? <Link to="/staff/login">Use the staff portal</Link>.
        </p>
      </form>
    </AuthShell>
  );
}
