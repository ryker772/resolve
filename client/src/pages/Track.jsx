import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { SiteHeader, SiteFooter, StatusPill, Timeline, Icon, ICONS, Spinner } from '../components/ui.jsx';
import { fmtDate, fmtDateTime, fileSize, initials } from '../format.js';

function Lookup({ initialTicket = '', initialCode = '', error }) {
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(initialTicket);
  const [code, setCode] = useState(initialCode);
  return (
    <div className="card" style={{ maxWidth: 520, margin: '40px auto 0' }}>
      <h1 style={{ fontSize: 30, marginBottom: 8 }}>Track a complaint</h1>
      <p className="muted" style={{ marginBottom: 24 }}>Enter the ticket ID and access code you got when you submitted.</p>
      {error && <div className="alert alert-error" role="alert" style={{ marginBottom: 16 }}>{error}</div>}
      <form className="stack gap-16" onSubmit={(e) => {
        e.preventDefault();
        navigate(`/track/${encodeURIComponent(ticket.trim().toUpperCase())}?code=${encodeURIComponent(code.trim().toUpperCase())}`);
      }}>
        <div className="field">
          <label htmlFor="t">Ticket ID</label>
          <input id="t" className="input mono" placeholder="RSV-2026-0001" value={ticket} onChange={(e) => setTicket(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="c">Access code</label>
          <input id="c" className="input mono" placeholder="6 characters" value={code} onChange={(e) => setCode(e.target.value)} required />
        </div>
        <button className="btn btn-primary" type="submit">Track</button>
      </form>
    </div>
  );
}

function Stars({ value, onPick, disabled }) {
  return (
    <div className="stars" role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" className="star" disabled={disabled} aria-label={`${n} star${n > 1 ? 's' : ''}`}
          aria-pressed={value === n} onClick={() => onPick(n)}>
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path d={ICONS.star} fill={n <= (value || 0) ? '#C2410C' : 'none'} stroke="#C2410C" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
    </div>
  );
}

export default function Track() {
  const { ticket } = useParams();
  const { isStudent } = useAuth();
  const [params] = useSearchParams();
  const code = (params.get('code') || '').toUpperCase();
  const [c, setC] = useState(null);
  const [loading, setLoading] = useState(!!ticket);
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [reopening, setReopening] = useState(false);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    if (!ticket) return;
    setLoading(true);
    setError('');
    try {
      setC(await api(`/track/${encodeURIComponent(ticket)}?code=${encodeURIComponent(code)}`));
    } catch (err) {
      setC(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [ticket, code]);

  useEffect(() => { load(); }, [load]);

  async function act(fn) {
    setBusy(true);
    setActionError('');
    try { setC(await fn()); return true; } catch (err) { setActionError(err.message); return false; } finally { setBusy(false); }
  }

  const base = `/track/${encodeURIComponent(ticket || '')}`;
  const sendReply = (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    const fd = new FormData();
    fd.append('code', code);
    fd.append('body', reply);
    files.forEach((f) => fd.append('files', f));
    act(() => api(`${base}/messages`, { method: 'POST', form: fd })).then((ok) => { if (ok) { setReply(''); setFiles([]); } });
  };
  const rate = (n) => act(() => api(`${base}/rating`, { method: 'POST', body: { code, rating: n } }));
  const close = () => act(() => api(`${base}/close`, { method: 'POST', body: { code } }));
  const reopen = (e) => {
    e.preventDefault();
    act(() => api(`${base}/reopen`, { method: 'POST', body: { code, reason } })).then((ok) => { if (ok) { setReopening(false); setReason(''); } });
  };

  const fileHref = (a) => `/api/attachments/${a.id}?ticket=${encodeURIComponent(ticket)}&code=${encodeURIComponent(code)}`;
  const resolved = c && ['Resolved', 'Closed'].includes(c.status);

  return (
    <>
      <SiteHeader />
      <main className="container" style={{ padding: '40px 24px 80px' }}>
        {!ticket && <Lookup />}
        {ticket && loading && !c && <Spinner />}
        {ticket && !loading && error && <Lookup initialTicket={ticket} initialCode={code} error={error} />}

        {c && (
          <>
            <div className="row between gap-16" style={{ alignItems: 'flex-end', marginBottom: 28 }}>
              <div>
                <div className="row gap-8" style={{ marginBottom: 8 }}>
                  <span className="mono muted">{c.ticket}</span>
                  <StatusPill status={c.status} overdue={c.overdue} />
                  <span className="pill pill-neutral">{c.category}</span>
                </div>
                <h1 style={{ fontSize: 'clamp(26px, 3.5vw, 34px)' }}>{c.subject}</h1>
              </div>
              <span className="muted" style={{ fontSize: 15 }}>
                {c.kind} submitted {fmtDate(c.createdAt)}{!resolved && ` · Target response by ${fmtDate(c.dueAt)}`}
              </span>
            </div>

            {actionError && <div className="alert alert-error" role="alert" style={{ marginBottom: 20 }}>{actionError}</div>}

            <div className="row gap-24" style={{ alignItems: 'flex-start' }}>
              <section aria-label="Progress" className="card" style={{ flex: '1 1 320px', minWidth: 0 }}>
                <h2 style={{ fontSize: 19, marginBottom: 24 }}>Progress</h2>
                <Timeline complaint={c} />
                <div className="row gap-12" style={{ borderTop: '1px solid var(--border)', paddingTop: 18 }}>
                  <span className="avatar light">{initials(c.department)}</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{c.department}</div>
                    <div className="small muted">{c.officerName ? `Handling officer: ${c.officerName}` : 'Waiting for an officer to be assigned'}</div>
                  </div>
                </div>
              </section>

              <section aria-label="Updates" className="card stack gap-16" style={{ flex: '999 1 560px', minWidth: 0 }}>
                <h2 style={{ fontSize: 19 }}>Updates &amp; messages</h2>
                <article className="msg msg-student">
                  <div className="msg-head"><strong>Your {c.kind.toLowerCase()}</strong><span className="muted">{fmtDateTime(c.createdAt)}</span></div>
                  <p className="msg-body">{c.details}</p>
                  {(c.location || c.incidentDate) && (
                    <p className="small muted">{[c.location, c.incidentDate && `Incident on ${fmtDate(c.incidentDate)}`].filter(Boolean).join(' · ')}</p>
                  )}
                  <Attachments list={c.attachments.filter((a) => !a.messageId)} href={fileHref} />
                </article>
                {c.messages.map((m) => (
                  <article key={m.id} className={`msg msg-${m.authorType}`}>
                    <div className="msg-head">
                      <strong>{m.authorType === 'staff' ? 'Handling officer' : m.authorType === 'student' ? 'You' : 'System'}</strong>
                      <span className="muted">{fmtDateTime(m.createdAt)}</span>
                    </div>
                    <p className="msg-body">{m.body}</p>
                    <Attachments list={c.attachments.filter((a) => a.messageId === m.id)} href={fileHref} />
                  </article>
                ))}

                {c.status !== 'Closed' && !resolved && (
                  <form className="stack gap-12" style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }} onSubmit={sendReply}>
                    <label htmlFor="reply" className="label">
                      {c.status === 'Awaiting student' ? 'The officer is waiting for your reply' : 'Reply to the officer'}
                    </label>
                    <textarea id="reply" rows={3} className="textarea" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Add information or answer a question…" />
                    {files.length > 0 && <p className="small muted">{files.map((f) => f.name).join(', ')}</p>}
                    <div className="row between gap-12">
                      <label className="btn-link" style={{ display: 'inline-flex', alignItems: 'center' }}>
                        Attach a file
                        <input type="file" multiple className="sr-only" accept="image/*,.pdf,.doc,.docx,.txt" onChange={(e) => {
                          const picked = Array.from(e.target.files).slice(0, 5);
                          if (picked.reduce((n, f) => n + f.size, 0) > 4 * 1024 * 1024) { setActionError('Attachments can be at most 4 MB in total.'); return; }
                          setActionError('');
                          setFiles(picked);
                        }} />
                      </label>
                      <button className="btn btn-primary" disabled={busy || !reply.trim()}>Send reply</button>
                    </div>
                  </form>
                )}
              </section>
            </div>

            <section className="card row between gap-24" style={{ marginTop: 24 }}>
              <div style={{ flex: '1 1 360px', minWidth: 0 }}>
                <h2 style={{ fontSize: 19, marginBottom: 6 }}>{c.rating ? 'Thanks for your rating' : 'Rate the resolution'}</h2>
                <p className="muted">
                  {resolved
                    ? c.status === 'Closed' ? 'This ticket is closed. You can still reopen it if the problem comes back.' : 'Is it fixed? Rate it, confirm to close the ticket, or reopen it.'
                    : 'Available once your complaint is marked resolved.'}
                </p>
              </div>
              <div className="stack gap-12" style={{ alignItems: 'flex-end' }}>
                <Stars value={c.rating} onPick={rate} disabled={!resolved || busy} />
                {resolved && (
                  <div className="row gap-8">
                    {c.status === 'Resolved' && <button className="btn btn-dark btn-sm" disabled={busy} onClick={close}>Confirm &amp; close</button>}
                    <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setReopening((v) => !v)}>Reopen</button>
                  </div>
                )}
              </div>
              {reopening && (
                <form className="stack gap-12" style={{ width: '100%' }} onSubmit={reopen}>
                  <label htmlFor="reason" className="label">Why are you reopening it?</label>
                  <textarea id="reason" rows={3} className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <div><button className="btn btn-primary btn-sm" disabled={busy || reason.trim().length < 5}>Reopen complaint</button></div>
                </form>
              )}
            </section>
            <p className="small muted" style={{ marginTop: 16 }}>
              Keep this page’s link private — anyone with your ticket ID and access code can see this conversation. {isStudent ? <Link to="/my">Back to My complaints</Link> : <Link to="/track">Track a different ticket</Link>}
            </p>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

function Attachments({ list, href }) {
  if (!list.length) return null;
  return (
    <div className="row gap-8" style={{ marginTop: 6 }}>
      {list.map((a) => (
        <a key={a.id} className="attach" href={href(a)} target="_blank" rel="noreferrer">
          <Icon d={ICONS.file} size={16} /> {a.name} <span className="muted">· {fileSize(a.size)}</span>
        </a>
      ))}
    </div>
  );
}
