import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, download } from '../api.js';
import StaffLayout from '../components/StaffLayout.jsx';
import { StatusPill, Spinner } from '../components/ui.jsx';
import { age } from '../format.js';

const TABS = ['All', 'New', 'In progress', 'Awaiting student', 'Overdue', 'Resolved', 'Closed'];
const PAGE_SIZE = 10;

export default function Dashboard() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') || 'all';
  const tab = params.get('status') || 'All';
  const page = Number(params.get('page')) || 1;
  const q = params.get('q') || '';
  const [search, setSearch] = useState(q);
  const [stats, setStats] = useState(null);
  const [list, setList] = useState(null);
  const [error, setError] = useState('');

  const query = () => {
    const p = new URLSearchParams();
    if (tab !== 'All') p.set('status', tab);
    if (view !== 'all') p.set('view', view);
    if (q) p.set('q', q);
    return p;
  };

  useEffect(() => { api('/staff/stats').then(setStats).catch((e) => setError(e.message)); }, []);

  useEffect(() => {
    const p = query();
    p.set('page', page);
    p.set('pageSize', PAGE_SIZE);
    setList(null);
    api(`/staff/complaints?${p}`).then(setList).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, tab, page, q]);

  function update(changes) {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  }

  const title = { all: 'Complaints overview', mine: 'Assigned to me', feedback: 'Feedback & suggestions' }[view];
  const maxCat = Math.max(1, ...(stats?.openByCategory || []).map((c) => c.count));
  const pages = list ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1;

  return (
    <StaffLayout counts={stats ? { total: stats.total, mine: stats.mine, feedback: stats.feedback } : {}}>
      <div className="row between gap-16">
        <div>
          <h1 style={{ fontSize: 28 }}>{title}</h1>
          <p className="muted">{stats ? `${stats.total} total submissions` : ' '}</p>
        </div>
        <div className="row gap-8">
          <form onSubmit={(e) => { e.preventDefault(); update({ q: search.trim() }); }} className="row gap-8">
            <label htmlFor="q" className="sr-only">Search complaints</label>
            <input id="q" className="input" style={{ width: 260, maxWidth: '100%', height: 44 }} placeholder="Search ID, subject, name…"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </form>
          <button type="button" className="btn btn-dark btn-sm" style={{ minHeight: 44 }}
            onClick={() => download(`/staff/export.csv?${query()}`, 'complaints.csv').catch((e) => setError(e.message))}>
            Export CSV
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {view === 'all' && (
        <div className="stat-grid">
          {[
            ['Open complaints', stats?.open, 'Not yet resolved'],
            ['New today', stats?.newToday, 'Submitted today'],
            ['Overdue', stats?.overdue, 'Past 5-working-day target'],
            ['Avg. resolution time', stats?.avgResolutionDays == null ? '—'
              : stats.avgResolutionDays < 1 ? `${Math.max(1, Math.round(stats.avgResolutionDays * 24))} h` : `${stats.avgResolutionDays} d`,
              stats?.avgRating != null ? `Avg. rating ${stats.avgRating}/5 (${stats.ratingCount})` : 'No ratings yet']
          ].map(([l, v, n]) => (
            <div key={l} className="card card-tight">
              <div className="small muted">{l}</div>
              <div className="stat-value">{v ?? '…'}</div>
              <div className="tiny muted">{n}</div>
            </div>
          ))}
        </div>
      )}

      <div className="row gap-24" style={{ alignItems: 'flex-start' }}>
        <section aria-label="Complaints" className="table-card" style={{ flex: '999 1 560px', minWidth: 0 }}>
          <div role="tablist" aria-label="Filter by status" className="status-tabs">
            {TABS.map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => update({ status: t === 'All' ? '' : t })}>{t}</button>
            ))}
          </div>
          {q && (
            <div className="row gap-8 small" style={{ padding: '10px 16px', background: 'var(--surface-subtle)' }}>
              Results for “{q}” <button className="btn-link" onClick={() => { setSearch(''); update({ q: '' }); }}>Clear</button>
            </div>
          )}
          <div className="table-scroll">
            {!list ? (
              <div style={{ padding: 24 }}><Spinner /></div>
            ) : list.items.length === 0 ? (
              <div className="empty">Nothing here yet.</div>
            ) : (
              <table className="data">
                <thead>
                  <tr><th>Ticket</th><th>Subject</th><th>Category</th><th>Priority</th><th>Status</th><th>Assigned</th><th>Age</th></tr>
                </thead>
                <tbody>
                  {list.items.map((r) => (
                    <tr key={r.id}>
                      <td className="mono" style={{ whiteSpace: 'nowrap' }}><Link to={`/staff/complaints/${r.id}`}>{r.ticket}</Link></td>
                      <td style={{ fontWeight: 500 }}><Link to={`/staff/complaints/${r.id}`} style={{ textDecoration: 'none' }}>{r.subject}</Link>
                        {r.kind !== 'Complaint' && <span className="tiny muted"> · {r.kind}</span>}</td>
                      <td className="muted">{r.category}</td>
                      <td><span className="row gap-8 nowrap"><span className={`dot dot-${r.priority}`} />{r.priority}</span></td>
                      <td><StatusPill status={r.status} overdue={r.overdue} /></td>
                      <td className="muted">{r.officerName || 'Unassigned'}</td>
                      <td className="muted" style={{ whiteSpace: 'nowrap' }}>{age(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {list && list.total > 0 && (
            <div className="table-foot">
              <span>Showing {list.items.length} of {list.total}</span>
              {pages > 1 && (
                <span className="row gap-8">
                  <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>Previous</button>
                  <span>Page {page} of {pages}</span>
                  <button className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => update({ page: String(page + 1) })}>Next</button>
                </span>
              )}
            </div>
          )}
        </section>

        <section aria-label="By category" className="card card-tight stack gap-12" style={{ flex: '1 1 280px', minWidth: 0 }}>
          <h2 style={{ fontSize: 17 }}>Open by category</h2>
          {stats?.openByCategory.length === 0 && <p className="small muted">No open complaints.</p>}
          {stats?.openByCategory.map((b) => (
            <div key={b.category} className="stack gap-4">
              <div className="row between small"><span>{b.category}</span><span className="mono">{b.count}</span></div>
              <div className="bar"><div style={{ width: `${Math.round((b.count / maxCat) * 100)}%` }} /></div>
            </div>
          ))}
          <p className="tiny muted" style={{ marginTop: 6 }}>Overdue = past the 5-working-day response target.</p>
        </section>
      </div>
    </StaffLayout>
  );
}
