import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { SiteHeader, SiteFooter, StatusPill, Spinner } from '../components/ui.jsx';
import { fmtDate } from '../format.js';

const FILTERS = ['All', 'Open', 'Resolved'];

export default function MyComplaints() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    api('/students/complaints').then(setData).catch((e) => setError(e.message));
  }, []);

  const done = (s) => ['Resolved', 'Closed'].includes(s);
  const items = (data?.items || []).filter((i) =>
    filter === 'All' ? true : filter === 'Open' ? !done(i.status) : done(i.status)
  );
  const waiting = (data?.items || []).filter((i) => i.status === 'Awaiting student');

  return (
    <>
      <SiteHeader />
      <main className="container stack gap-24" style={{ padding: '40px 24px 80px' }}>
        <div className="row between gap-16">
          <div>
            <h1 style={{ fontSize: 'clamp(28px, 4vw, 36px)', marginBottom: 4 }}>My complaints</h1>
            <p className="muted">{user.name} · <span className="mono">{user.matric}</span>{user.department ? ` · ${user.department}` : ''}</p>
          </div>
          <Link to="/submit" className="btn btn-primary">New complaint or feedback</Link>
        </div>

        {error && <div className="alert alert-error" role="alert">{error}</div>}

        {waiting.length > 0 && (
          <div className="alert" style={{ background: 'var(--wait-bg)', color: 'var(--wait-fg)', border: '1px solid #ddd6fe' }}>
            <strong>{waiting.length === 1 ? 'An officer is' : `${waiting.length} officers are`} waiting for your reply</strong> on{' '}
            {waiting.map((w, i) => (
              <span key={w.id}>{i > 0 && ', '}<Link to={`/track/${w.ticket}?code=${w.accessCode}`} style={{ color: 'inherit' }}>{w.ticket}</Link></span>
            ))}.
          </div>
        )}

        <div className="stat-grid">
          {[['Total', data?.counts.total], ['Open', data?.counts.open], ['Resolved', data?.counts.resolved]].map(([l, v]) => (
            <div key={l} className="card card-tight">
              <div className="small muted">{l}</div>
              <div className="stat-value">{v ?? '…'}</div>
            </div>
          ))}
        </div>

        <section className="table-card" aria-label="Your complaints">
          <div role="tablist" aria-label="Filter" className="status-tabs">
            {FILTERS.map((f) => (
              <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
          {!data ? (
            <div style={{ padding: 24 }}><Spinner /></div>
          ) : items.length === 0 ? (
            <div className="empty">
              {data.items.length === 0 ? (
                <>You haven’t submitted anything yet. <Link to="/submit">Submit your first complaint</Link>.</>
              ) : 'Nothing in this view.'}
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {items.map((c) => (
                <li key={c.id} style={{ borderTop: '1px solid var(--tint)' }}>
                  <Link to={`/track/${c.ticket}?code=${c.accessCode}`} className="row between gap-16"
                    style={{ padding: '18px 20px', textDecoration: 'none', color: 'var(--ink)' }}>
                    <div className="grow" style={{ flex: '1 1 320px' }}>
                      <div className="row gap-8 small" style={{ marginBottom: 4 }}>
                        <span className="mono muted">{c.ticket}</span>
                        <span className="muted">· {c.kind} · {c.category}</span>
                        {c.anonymous && <span className="pill pill-neutral">Anonymous</span>}
                      </div>
                      <div style={{ fontWeight: 600 }}>{c.subject}</div>
                      <div className="small muted">
                        Submitted {fmtDate(c.createdAt)} · {c.officerName ? `Handled by ${c.department}` : `Sent to ${c.department}`}
                        {c.staffReplies > 0 && ` · ${c.staffReplies} repl${c.staffReplies === 1 ? 'y' : 'ies'} from staff`}
                      </div>
                    </div>
                    <StatusPill status={c.status} overdue={c.overdue} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <p className="small muted">Anonymous complaints show here for you, but staff can’t see who sent them.</p>
      </main>
      <SiteFooter />
    </>
  );
}
