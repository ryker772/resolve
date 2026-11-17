import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { SiteHeader, SiteFooter, Icon, ICONS } from '../components/ui.jsx';
import { fileSize } from '../format.js';
import { useAuth } from '../auth.jsx';

const KINDS = ['Complaint', 'Feedback', 'Suggestion'];
const CATEGORIES = ['Academics', 'Hostel & facilities', 'Fees & finance', 'Staff conduct', 'IT & student portal', 'General feedback', 'Other'];
const PRIORITIES = ['Low', 'Normal', 'Urgent'];
const MAX_FILES = 5;
const MAX_MB = 4; // total for all attachments (hosting limit)

function Choice({ options, value, onChange, variant = '' }) {
  return options.map((o) => (
    <button key={o} type="button" className={`chip ${variant}`} aria-pressed={value === o} onClick={() => onChange(o)}>
      {o}
    </button>
  ));
}

export default function Submit() {
  const [params] = useSearchParams();
  const { user, isStudent } = useAuth();
  const blank = {
    kind: KINDS.includes(params.get('kind')) ? params.get('kind') : 'Complaint',
    category: CATEGORIES.includes(params.get('category')) ? params.get('category') : '',
    subject: '', details: '', location: '', incidentDate: '', priority: 'Normal',
    anonymous: params.get('anonymous') === '1',
    name: isStudent ? user.name : '', matric: isStudent ? user.matric : '',
    email: isStudent && params.get('anonymous') !== '1' ? user.email : ''
  };
  const [form, setForm] = useState(blank);
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [done, setDone] = useState(null);
  const [copied, setCopied] = useState(false);
  const fileInput = useRef(null);
  const topRef = useRef(null);

  useEffect(() => { if (done) window.scrollTo({ top: 0, behavior: 'smooth' }); }, [done]);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }));
    // Clear a field's error as soon as the user edits it.
    setErrors((errs) => {
      if (!errs[key]) return errs;
      const next = { ...errs };
      delete next[key];
      if (!Object.values(next).some(Boolean)) setMessage('');
      return next;
    });
  };

  function addFiles(list) {
    const incoming = Array.from(list);
    const limit = MAX_MB * 1024 * 1024;
    let next = [...files];
    const skipped = [];
    for (const f of incoming) {
      const used = next.reduce((n, x) => n + x.size, 0);
      if (next.length >= MAX_FILES || used + f.size > limit) skipped.push(f.name);
      else next.push(f);
    }
    setFiles(next);
    setErrors((e) => ({ ...e, files: skipped.length ? `Not added: ${skipped.join(', ')} (max ${MAX_FILES} files, ${MAX_MB} MB in total).` : undefined }));
  }

  function validate() {
    const e = {};
    if (!form.category) e.category = 'Choose a category.';
    if (form.subject.trim().length < 5) e.subject = 'Give a short subject (at least 5 characters).';
    if (form.details.trim().length < 20) e.details = 'Describe what happened (at least 20 characters).';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email address.';
    return e;
  }

  async function submit(e) {
    e.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length) {
      setMessage('Please fix the highlighted fields.');
      topRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    setBusy(true);
    setMessage('');
    const fd = new FormData();
    Object.entries(form).forEach(([k, val]) => fd.append(k, String(val)));
    files.forEach((f) => fd.append('files', f));
    try {
      setDone(await api('/complaints', { method: 'POST', form: fd }));
    } catch (err) {
      setErrors(err.fields || {});
      setMessage(err.message);
      topRef.current?.scrollIntoView({ behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setForm(blank);
    setFiles([]);
    setErrors({});
    setMessage('');
    setDone(null);
    setCopied(false);
  }

  const trackPath = done ? `/track/${done.ticket}?code=${done.accessCode}` : '';

  async function copy() {
    try {
      await navigator.clipboard.writeText(`Ticket: ${done.ticket}  Access code: ${done.accessCode}  Link: ${window.location.origin}${trackPath}`);
      setCopied(true);
    } catch { /* clipboard blocked */ }
  }

  return (
    <>
      <SiteHeader />
      <main className="container" style={{ padding: '48px 24px 80px' }}>
        <Link to="/" style={{ fontSize: 15, textDecoration: 'none' }}>← Back to home</Link>

        {done ? (
          <div className="card" style={{ margin: '32px auto 0', maxWidth: 640, padding: 48, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--ink)', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon d={ICONS.check} color="#fff" size={30} width={2.5} />
            </div>
            <h1 style={{ fontSize: 32, marginBottom: 8 }}>{form.kind} submitted</h1>
            <p className="muted" style={{ marginBottom: 24 }}>
              Save your ticket ID and access code. You need both to track progress and reply to the officer.
            </p>
            <div className="row gap-12" style={{ justifyContent: 'center', marginBottom: 12 }}>
              <div style={{ padding: '14px 22px', borderRadius: 10, background: 'var(--bg)', border: '1px dashed var(--border-strong)' }}>
                <div className="tiny muted">Ticket ID</div>
                <div className="mono" style={{ fontSize: 22 }}>{done.ticket}</div>
              </div>
              <div style={{ padding: '14px 22px', borderRadius: 10, background: 'var(--bg)', border: '1px dashed var(--border-strong)' }}>
                <div className="tiny muted">Access code</div>
                <div className="mono" style={{ fontSize: 22 }}>{done.accessCode}</div>
              </div>
            </div>
            <button type="button" className="btn-link small" onClick={copy}>{copied ? 'Copied ✓' : 'Copy ticket details'}</button>
            {form.email && <p className="small muted" style={{ marginTop: 8 }}>We’ll also use {form.email} for updates about this ticket.</p>}
            <div className="row gap-12" style={{ justifyContent: 'center', marginTop: 24 }}>
              <Link to={trackPath} className="btn btn-primary">Track this {form.kind.toLowerCase()}</Link>
              {isStudent && <Link to="/my" className="btn btn-secondary">My complaints</Link>}
              <button type="button" className="btn btn-secondary" onClick={reset}>Submit another</button>
            </div>
          </div>
        ) : (
          <div className="row gap-32" style={{ marginTop: 20, alignItems: 'flex-start' }} ref={topRef}>
            <form onSubmit={submit} noValidate className="card stack gap-32" style={{ flex: '999 1 600px', minWidth: 0, padding: 40 }}>
              <div>
                <h1 style={{ fontSize: 36, marginBottom: 8 }}>Submit a complaint or feedback</h1>
                <p className="muted">Fields marked * are required. It takes about 3 minutes.</p>
              </div>
              {isStudent ? (
                <div className="alert" style={{ background: 'var(--tint)' }}>
                  Signed in as <strong>{user.name}</strong> (<span className="mono">{user.matric}</span>). This will appear in <Link to="/my">My complaints</Link>.
                </div>
              ) : (
                <div className="alert" style={{ background: 'var(--tint)' }}>
                  Have a student account? <Link to="/login?next=/submit">Sign in</Link> to keep this in My complaints — or just continue as a guest.
                </div>
              )}
              {message && <div className="alert alert-error" role="alert">{message}</div>}

              <fieldset>
                <legend>What kind of submission is this? *</legend>
                <div className="row gap-8"><Choice options={KINDS} value={form.kind} onChange={set('kind')} /></div>
              </fieldset>

              <fieldset>
                <legend>Category *</legend>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                  <Choice options={CATEGORIES} value={form.category} onChange={set('category')} variant="tile" />
                </div>
                {errors.category && <p className="error-text" style={{ marginTop: 8 }}>{errors.category}</p>}
              </fieldset>

              <div className="field">
                <label htmlFor="subject">Subject *</label>
                <input id="subject" className={`input ${errors.subject ? 'invalid' : ''}`} maxLength={160} value={form.subject} onChange={set('subject')}
                  placeholder="A short summary, e.g. No water in Block C since Monday" aria-invalid={!!errors.subject} />
                {errors.subject && <span className="error-text">{errors.subject}</span>}
              </div>

              <div className="field">
                <label htmlFor="details">Describe what happened *</label>
                <textarea id="details" rows={6} className={`textarea ${errors.details ? 'invalid' : ''}`} maxLength={5000} value={form.details} onChange={set('details')}
                  placeholder="Include when and where it happened, who was involved, and what you’ve already tried." aria-invalid={!!errors.details} />
                {errors.details ? <span className="error-text">{errors.details}</span> : <span className="hint">Be specific — it helps the officer act faster.</span>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
                <div className="field">
                  <label htmlFor="location">Location</label>
                  <input id="location" className="input" value={form.location} onChange={set('location')} placeholder="e.g. Block C, Room 214" />
                </div>
                <div className="field">
                  <label htmlFor="date">Date of incident</label>
                  <input id="date" type="date" className="input" value={form.incidentDate} max={new Date().toISOString().slice(0, 10)} onChange={set('incidentDate')} />
                </div>
              </div>

              <fieldset>
                <legend>How urgent is it?</legend>
                <div className="row gap-8"><Choice options={PRIORITIES} value={form.priority} onChange={set('priority')} variant="square" /></div>
              </fieldset>

              <div className="field">
                <span className="label">Attachments</span>
                <label htmlFor="files" className={`dropzone ${drag ? 'drag' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}>
                  <Icon d={ICONS.upload} color="#4B5A70" size={28} />
                  <span style={{ fontWeight: 600 }}>Drop files here or browse</span>
                  <span className="small muted">Photos, PDFs or documents · up to {MAX_FILES} files, {MAX_MB} MB in total</span>
                </label>
                <input id="files" ref={fileInput} type="file" multiple className="sr-only"
                  accept="image/*,.pdf,.doc,.docx,.txt" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
                {errors.files && <span className="error-text">{errors.files}</span>}
                {files.length > 0 && (
                  <ul className="file-list">
                    {files.map((f, i) => (
                      <li key={i}>
                        <span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name} <span className="muted">· {fileSize(f.size)}</span></span>
                        <button type="button" className="btn-link" aria-label={`Remove ${f.name}`} onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}>Remove</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="stack gap-16" style={{ borderTop: '1px solid var(--border)', paddingTop: 28 }}>
                <button type="button" className="toggle" aria-pressed={form.anonymous} onClick={() => setForm((f) => {
                  const anonymous = !f.anonymous;
                  // Don't quietly send a signed-in student's account email with an anonymous complaint.
                  let email = f.email;
                  if (isStudent && anonymous && email === user.email) email = '';
                  if (isStudent && !anonymous && !email) email = user.email;
                  return { ...f, anonymous, email };
                })}>
                  <span className="toggle-track"><span className="toggle-knob" /></span>
                  <span>
                    <span style={{ display: 'block', fontWeight: 600 }}>Submit anonymously</span>
                    <span className="small muted" style={{ display: 'block' }}>{isStudent ? 'Staff won’t see who sent it. It still shows in your My complaints.' : 'Your name and matric number won’t be stored or shown to staff.'}</span>
                  </span>
                </button>

                {!form.anonymous && isStudent && (
                  <p className="small muted">Your name and matric number from your account will be attached.</p>
                )}
                {!form.anonymous && !isStudent && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
                    <div className="field">
                      <label htmlFor="name">Full name</label>
                      <input id="name" className="input" autoComplete="name" value={form.name} onChange={set('name')} />
                    </div>
                    <div className="field">
                      <label htmlFor="matric">Matric / staff number</label>
                      <input id="matric" className="input" value={form.matric} onChange={set('matric')} />
                    </div>
                  </div>
                )}

                <div className="field">
                  <label htmlFor="email">Email for updates</label>
                  <input id="email" type="email" autoComplete="email" className={`input ${errors.email ? 'invalid' : ''}`} value={form.email} onChange={set('email')} placeholder="you@example.com" />
                  {errors.email ? <span className="error-text">{errors.email}</span> : <span className="hint">{form.anonymous
                    ? 'Optional. If you add one, staff can see it — leave it blank to stay fully anonymous.'
                    : 'Optional. Only used for updates about this ticket.'}</span>}
                </div>
              </div>

              <div className="row gap-12">
                <button type="submit" className="btn btn-primary" disabled={busy} style={{ minHeight: 52, padding: '0 28px' }}>
                  {busy ? 'Submitting…' : `Submit ${form.kind.toLowerCase()}`}
                </button>
                <button type="button" className="btn btn-secondary" style={{ minHeight: 52 }} onClick={reset}>Clear form</button>
              </div>
            </form>

            <aside className="stack gap-16" style={{ flex: '1 1 300px', minWidth: 0 }}>
              <div className="card" style={{ background: 'var(--ink)', color: '#fff', border: 0 }}>
                <h2 style={{ fontSize: 19, marginBottom: 16 }}>What happens next</h2>
                <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10, color: 'var(--on-dark)' }}>
                  <li>You get a ticket ID and access code straight away.</li>
                  <li>The right office is notified and assigns an officer.</li>
                  <li>You follow updates and reply on the tracking page.</li>
                </ol>
              </div>
              <div className="card">
                <h2 style={{ fontSize: 19, marginBottom: 8 }}>Is it an emergency?</h2>
                <p className="muted">For threats to safety, don’t wait for a ticket — call ABUAD campus security on [PHONE NUMBER].</p>
              </div>
            </aside>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
