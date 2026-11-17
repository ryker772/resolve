import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Logo } from './ui.jsx';
import { initials } from '../format.js';

export default function StaffLayout({ counts = {}, children }) {
  const { user, logout } = useAuth();
  const { search, pathname } = useLocation();
  const view = new URLSearchParams(search).get('view') || 'all';
  const items = [
    { label: 'All complaints', view: 'all', count: counts.total },
    { label: 'Assigned to me', view: 'mine', count: counts.mine },
    { label: 'Feedback & suggestions', view: 'feedback', count: counts.feedback }
  ];
  return (
    <div className="staff-shell">
      <aside className="sidebar">
        <Logo to="/staff" small />
        <nav aria-label="Staff" className="side-nav">
          {items.map((it) => (
            <Link key={it.view} to={it.view === 'all' ? '/staff' : `/staff?view=${it.view}`}
              className={pathname === '/staff' && view === it.view ? 'active' : ''}>
              <span>{it.label}</span>
              <span className="count">{it.count ?? ''}</span>
            </Link>
          ))}
        </nav>
        <div className="side-user" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div className="row gap-12" style={{ flexWrap: 'nowrap' }}>
            <span className="avatar">{initials(user?.name)}</span>
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{user?.name}</div>
              <div className="tiny" style={{ color: 'var(--on-dark-faint)' }}>
                {user?.role === 'admin' ? 'Administrator' : 'Handling officer'} · {user?.department}
              </div>
            </div>
          </div>
          <button type="button" className="btn btn-ghost-dark btn-sm" onClick={logout}>Sign out</button>
        </div>
      </aside>
      <main className="staff-main">{children}</main>
    </div>
  );
}
