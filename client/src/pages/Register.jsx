import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import AuthShell from '../components/AuthShell.jsx';

export default function Register() {
  const { isStudent, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next')?.startsWith('/') ? params.get('next') : '/my';
  const [form, setForm] = useState({ name: '', matric: '', email: '', department: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (isStudent) return <Navigate to={next} replace />;

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((errs) => ({ ...errs, [k]: undefined }));
  };

  async function submit(e) {
    e.preventDefault();
    const v = {};
    if (form.password.length < 8) v.password = 'Use at least 8 characters.';
    if (form.password !== form.confirm) v.confirm = 'Passwords don’t match.';
    if (Object.keys(v).length) { setErrors(v); return; }
    setBusy(true);
    setError('');
    try {
      const { confirm, ...data } = form;
      await register(data);
      navigate(next);
    } catch (err) {
      setErrors(err.fields || {});
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const field = (id, label, props = {}) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className={`input ${errors[id] ? 'invalid' : ''}`} value={form[id]} onChange={set(id)} aria-invalid={!!errors[id]} {...props} />
      {errors[id] && <span className="error-text">{errors[id]}</span>}
    </div>
  );

  return (
    <AuthShell overline="Student account" title="Create your account."
      text="Use your matric number so your complaints are linked to you. Anonymous complaints stay anonymous to staff.">
      <form onSubmit={submit} noValidate className="card stack gap-16" style={{ width: '100%', maxWidth: 460, padding: 40 }}>
        <h2 style={{ fontSize: 28 }}>Create account</h2>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {field('name', 'Full name', { autoComplete: 'name', required: true })}
        {field('matric', 'Matric number', { placeholder: 'e.g. 23/SCI01/022', required: true })}
        {field('email', 'Email', { type: 'email', autoComplete: 'email', required: true })}
        {field('department', 'Department (optional)', { placeholder: 'e.g. Computer Science' })}
        {field('password', 'Password', { type: 'password', autoComplete: 'new-password', required: true })}
        {field('confirm', 'Confirm password', { type: 'password', autoComplete: 'new-password', required: true })}
        <button className="btn btn-primary" style={{ minHeight: 52 }} disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        <p className="small muted" style={{ textAlign: 'center' }}>Already have an account? <Link to="/login">Sign in</Link></p>
      </form>
    </AuthShell>
  );
}
