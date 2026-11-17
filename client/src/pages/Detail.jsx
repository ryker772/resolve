import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, download } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Logo, StatusPill, Icon, ICONS, Spinner } from '../components/ui.jsx';
import { fmtDate, fmtDateTime, dueText, fileSize } from '../format.js';

const STATUSES = ['New', 'In progress', 'Awaiting student', 'Resolved', 'Closed'];
const PRIORITIES = ['Low', 'Normal', 'Urgent'];

export default function Detail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [c, setC] = useState(null);
  const [officers, setOfficers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('reply');
  const [text, setText] = useState('');
  const [awaitStudent, setAwaitStudent] = useState(false);

  useEffect(() => {
    api(`/staff/complaints/${id}`).then(setC).catch((e) => setError(e.message));
    api('/staff/officers').then(setOfficers).catch(() => {});
    api('/staff/departments').then(setDepartments).catch(() => {});
  }, [id]);

  async function patch(body, okText) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setC(await api(`/staff/complaints/${id}`, { method: 'PATCH', body }));
      if (okText) setNotice(okText);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError('');
    try {
      setC(await api(`/staff/complaints/${id}/messages`, {
        method: 'POST',
        body: { body: text, internal: mode === 'note', awaitStudent: mode === 'reply' && awaitStudent }
      }));
      setText('');
      setAwaitStudent(false);
      setNotice(mode === 'note' ? 'Internal note added.' : 'Reply sent to the student.');
    } catch (e2) {
      setError(e2.message);
    } finally {
      setBusy(false);
    }
  }

  const internal = mode === 'note';
  const resolved = c && ['Resolved', 'Closed'].includes(c.status);
  const due = c && dueText(c.dueAt, c.status);

  return (
    <div style={{ minHeight: '100vh' }}>
      <header className="staff-top">
        <div className="inner">
          <Logo to="/staff" small><span className="small" style={{ color: 'var(--on-dark-faint)' }}>Staff</span></Logo>
          <Link to="/staff" className="back">← All complaints</Link>
        </div>
      </header>

      <main className="stack gap-24" style={{ padding: '28px 32px 64px', maxWidth: 1400, margin: '0 auto' }}>
        {!c && !error && <Spinner />}
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {notice && <div className="alert alert-ok" role="status">{notice}</div>}

        {c && (
          <>
            <div className="row between gap-20" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 480px', minWidth: 0 }}>
                <div className="row gap-8" style={{ marginBottom: 6 }}>
                  <span className="mono muted">{c.ticket}</span>
                  <StatusPill status={c.status} overdue={c.overdue} />
                  {c.priority === 'Urgent' && <span className="pill pill-Urgent">Urgent</span>}
                  {c.kind !== 'Complaint' && <span className="pill pill-neutral">{c.kind}</span>}
                </div>
                <h1 style={{ fontSize: 28 }}>{c.subject}</h1>
              </div>
              <div className="row gap-8">
                {!c.assignedTo && (
                  <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => patch({ assignedTo: user.id }, 'Assigned to you.')}>Assign to me</button>
                )}
                <button className="btn btn-dark btn-sm" disabled={busy}
                  onClick={() => patch({ status: resolved ? 'In progress' : 'Resolved' }, resolved ? 'Reopened.' : 'Marked as resolved. The student can now rate it.')}>
                  {resolved ? 'Reopen' : 'Mark resolved'}
                </button>
              </div>
            </div>

            <div className="row gap-24" style={{ alignItems: 'flex-start' }}>
              <div className="stack gap-24" style={{ flex: '999 1 600px', minWidth: 0 }}>
                <section className="card card-tight" style={{ padding: 24 }}>
                  <h2 style={{ fontSize: 17, marginBottom: 12 }}>Original {c.kind.toLowerCase()}</h2>
                  <p className="msg-body" style={{ marginBottom: 16 }}>{c.details}</p>
                  <dl className="facts" style={{ marginBottom: 16 }}>
                    <div><dt>Category</dt><dd>{c.category}</dd></div>
                    <div><dt>Location</dt><dd>{c.location || '—'}</dd></div>
                    <div><dt>Incident date</dt><dd>{c.incidentDate ? fmtDate(c.incidentDate) : '—'}</dd></div>
                    <div><dt>Submitted</dt><dd>{fmtDateTime(c.createdAt)}</dd></div>
                  </dl>
                  <FileChips list={c.attachments.filter((a) => !a.messageId)} />
                </section>

                <section className="card card-tight stack gap-16" style={{ padding: 24 }}>
                  <h2 style={{ fontSize: 17 }}>Conversation</h2>
                  {c.messages.map((m) => (
                    <article key={m.id} className={`msg ${m.internal ? 'msg-note' : m.authorType === 'student' ? 'msg-student-staffview' : m.authorType === 'system' ? 'msg-system' : 'msg-staff'}`}>
                      <div className="msg-head">
                        <strong>
                          {m.internal ? `Internal note · ${m.staffName}` : m.authorType === 'staff' ? (m.staffName === user.name ? `${m.staffName} (you)` : m.staffName) : m.authorType === 'student' ? 'Student' : 'System'}
                        </strong>
                        <span className="muted">{fmtDateTime(m.createdAt)}</span>
                      </div>
                      <p className="msg-body">{m.body}</p>
                      <FileChips list={c.attachments.filter((a) => a.messageId === m.id)} />
                    </article>
                  ))}

                  <form className={`composer ${internal ? 'internal' : ''}`} onSubmit={send}>
                    <div role="tablist" aria-label="Reply type" className="tabs">
                      <button type="button" role="tab" className="tab" aria-selected={!internal} onClick={() => setMode('reply')}>Reply to student</button>
                      <button type="button" role="tab" className="tab" aria-selected={internal} onClick={() => setMode('note')}>Internal note</button>
                    </div>
                    <label htmlFor="msg" className="sr-only">Message</label>
                    <textarea id="msg" rows={4} value={text} onChange={(e) => setText(e.target.value)}
                      placeholder={internal ? 'Only staff can see this note…' : 'Write a reply the student will see…'} />
                    <div className="composer-foot">
                      {internal ? <span className="tiny muted">Visible to staff only</span> : (
                        <label className="row gap-8 small" style={{ cursor: 'pointer', minHeight: 44 }}>
                          <input type="checkbox" checked={awaitStudent} onChange={(e) => setAwaitStudent(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--ink)' }} />
                          Ask the student a question (sets status to “Awaiting student”)
                        </label>
                      )}
                      <button className="btn btn-primary btn-sm" disabled={busy || !text.trim()}>{internal ? 'Add note' : 'Send reply'}</button>
                    </div>
                  </form>
                </section>
              </div>

              <aside className="stack gap-16" style={{ flex: '1 1 300px', minWidth: 0 }}>
                <section className="card card-tight stack gap-12">
                  <h2 style={{ fontSize: 15 }}>Handling</h2>
                  <Select id="st" label="Status" value={c.status} options={STATUSES.map((s) => [s, s])} disabled={busy}
                    onChange={(v) => patch({ status: v }, `Status changed to ${v}.`)} />
                  <Select id="as" label="Assigned officer" value={c.assignedTo || ''} disabled={busy}
                    options={[['', 'Unassigned'], ...officers.map((o) => [o.id, `${o.name} — ${o.department}`])]}
                    onChange={(v) => patch({ assignedTo: v ? Number(v) : null }, 'Assignment updated.')} />
                  <Select id="pr" label="Priority" value={c.priority} options={PRIORITIES.map((p) => [p, p])} disabled={busy}
                    onChange={(v) => patch({ priority: v }, `Priority set to ${v}.`)} />
                  <Select id="dp" label="Department (escalate / move)" value={c.departmentId} disabled={busy}
                    options={departments.map((d) => [d.id, d.name])}
                    onChange={(v) => patch({ departmentId: Number(v) }, 'Moved to another department.')} />
                  {due && (
                    <div className={`due-box ${c.overdue ? 'late' : ''}`}>
                      <div className="tiny" style={{ fontWeight: 600, color: c.overdue ? 'var(--danger)' : 'var(--warn-fg)' }}>Response target</div>
                      <div style={{ fontWeight: 600 }}>{due}</div>
                    </div>
                  )}
                  {c.rating && <div className="small">Student rating: <strong>{c.rating}/5</strong></div>}
                </section>

                <section className="card card-tight">
                  <h2 style={{ fontSize: 15, marginBottom: 12 }}>Submitted by</h2>
                  {c.anonymous ? <div style={{ fontWeight: 600 }}>Anonymous</div> : (
                    <>
                      <div style={{ fontWeight: 600 }}>{c.name || 'Name not given'}</div>
                      {c.matric && <div className="small muted">{c.matric}</div>}
                    </>
                  )}
                  <div className="small muted">{c.email ? `Email: ${c.email}` : 'No email given — student checks the tracking page'}</div>
                </section>

                <section className="card card-tight">
                  <h2 style={{ fontSize: 15, marginBottom: 12 }}>Activity log</h2>
                  <ul className="log">
                    {c.activity.map((a, i) => (
                      <li key={i}><time dateTime={a.createdAt}>{fmtDateTime(a.createdAt)}</time><span>{a.text} <span className="muted">· {a.actor}</span></span></li>
                    ))}
                  </ul>
                </section>
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Select({ id, label, value, options, onChange, disabled }) {
  return (
    <div className="field" style={{ gap: 6 }}>
      <label htmlFor={id} className="tiny muted" style={{ fontWeight: 400 }}>{label}</label>
      <select id={id} className="select" style={{ height: 44 }} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function FileChips({ list }) {
  if (!list.length) return null;
  return (
    <div className="row gap-8">
      {list.map((a) => (
        <button key={a.id} type="button" className="attach" onClick={() => download(`/attachments/${a.id}`)}>
          <Icon d={ICONS.file} size={16} /> {a.name} <span className="muted">· {fileSize(a.size)}</span>
        </button>
      ))}
    </div>
  );
}
