// Routes for signed-in staff: login, dashboard, complaint handling.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { STATUSES, PRIORITIES } from '../config.js';
import { requireStaff, signToken, publicUser, findUser } from '../auth.js';
import { clean, HttpError, wrap, sqlNow, iso } from '../util.js';
import {
  getComplaintRow, summary, staffView, addMessage, logActivity, OPEN_CLAUSE, BASE_SELECT
} from '../complaints.js';

const router = Router();

router.post('/auth/login', wrap(async (req, res) => {
  const email = clean(req.body.email, 160).toLowerCase();
  const password = String(req.body.password || '');
  const user = await db.get('SELECT * FROM users WHERE email = ?', email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    throw new HttpError(401, 'Incorrect email or password.');
  }
  res.json({ token: signToken(user), user: publicUser(await findUser(user.id)) });
}));

router.use('/staff', requireStaff);

router.get('/staff/me', (req, res) => res.json(publicUser(req.user)));

router.get('/staff/officers', wrap(async (_req, res) => {
  res.json(await db.all(
    'SELECT u.id, u.name, u.role, d.name AS department FROM users u LEFT JOIN departments d ON d.id = u.department_id ORDER BY u.name'
  ));
}));

router.get('/staff/departments', wrap(async (_req, res) => {
  res.json(await db.all('SELECT id, name FROM departments ORDER BY name'));
}));

// Builds the WHERE clause for the complaints list from query-string filters.
function filters(req) {
  const where = [];
  const params = [];
  const { status, q, view, kind } = req.query;
  if (status === 'Overdue') {
    where.push(`c.${OPEN_CLAUSE} AND c.due_at < ?`);
    params.push(sqlNow());
  } else if (status && STATUSES.includes(status)) {
    where.push('c.status = ?');
    params.push(status);
  }
  if (view === 'mine') {
    where.push('c.assigned_to = ?');
    params.push(req.user.id);
  }
  if (view === 'feedback') where.push("c.kind != 'Complaint'");
  if (kind) {
    where.push('c.kind = ?');
    params.push(String(kind));
  }
  if (q) {
    where.push('(c.ticket ILIKE ? OR c.subject ILIKE ? OR c.name ILIKE ? OR c.matric ILIKE ?)');
    const like = `%${clean(q, 100)}%`;
    params.push(like, like, like, like);
  }
  return { sql: where.length ? 'WHERE ' + where.join(' AND ') : '', params };
}

router.get('/staff/complaints', wrap(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(req.query.pageSize) || 10));
  const { sql, params } = filters(req);
  const { n: total } = await db.get(`SELECT COUNT(*)::int AS n FROM complaints c ${sql}`, ...params);
  const rows = await db.all(`${BASE_SELECT} ${sql} ORDER BY c.id DESC LIMIT ? OFFSET ?`, ...params, pageSize, (page - 1) * pageSize);
  res.json({ items: rows.map(summary), total, page, pageSize });
}));

router.get('/staff/stats', wrap(async (req, res) => {
  const now = sqlNow();
  const today = now.slice(0, 10);
  const count = async (sql, ...p) => (await db.get(sql, ...p)).n;
  const [open, newToday, overdue, total, mine, feedback, avgRow, ratingRow, byStatus, byCat] = await Promise.all([
    count(`SELECT COUNT(*)::int AS n FROM complaints WHERE ${OPEN_CLAUSE}`),
    count('SELECT COUNT(*)::int AS n FROM complaints WHERE substr(created_at, 1, 10) = ?', today),
    count(`SELECT COUNT(*)::int AS n FROM complaints WHERE ${OPEN_CLAUSE} AND due_at < ?`, now),
    count('SELECT COUNT(*)::int AS n FROM complaints'),
    count(`SELECT COUNT(*)::int AS n FROM complaints WHERE ${OPEN_CLAUSE} AND assigned_to = ?`, req.user.id),
    count("SELECT COUNT(*)::int AS n FROM complaints WHERE kind != 'Complaint'"),
    db.get(`SELECT AVG(EXTRACT(EPOCH FROM (resolved_at::timestamp - created_at::timestamp)) / 86400)::float AS d
            FROM complaints WHERE resolved_at IS NOT NULL`),
    db.get('SELECT AVG(rating)::float AS r, COUNT(rating)::int AS n FROM complaints WHERE rating IS NOT NULL'),
    db.all('SELECT status, COUNT(*)::int AS n FROM complaints GROUP BY status'),
    db.all(`SELECT category, COUNT(*)::int AS n FROM complaints WHERE ${OPEN_CLAUSE} GROUP BY category ORDER BY n DESC`)
  ]);
  res.json({
    open, newToday, overdue, total, mine, feedback,
    avgResolutionDays: avgRow.d == null ? null : Math.round(avgRow.d * 100) / 100,
    avgRating: ratingRow.r == null ? null : Math.round(ratingRow.r * 10) / 10,
    ratingCount: ratingRow.n,
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.n])),
    openByCategory: byCat.map((r) => ({ category: r.category, count: r.n }))
  });
}));

// CSV export of the current filter.
router.get('/staff/export.csv', wrap(async (req, res) => {
  const { sql, params } = filters(req);
  const rows = await db.all(`${BASE_SELECT} ${sql} ORDER BY c.id DESC`, ...params);
  const head = ['Ticket', 'Type', 'Category', 'Subject', 'Priority', 'Status', 'Overdue', 'Department', 'Officer', 'Submitted', 'Due', 'Resolved', 'Rating'];
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) => {
    const s = summary(r);
    return [s.ticket, s.kind, s.category, s.subject, s.priority, s.status, s.overdue ? 'Yes' : 'No', s.department,
      s.officerName || 'Unassigned', s.createdAt, s.dueAt, iso(r.resolved_at) || '', r.rating || ''].map(esc).join(',');
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="complaints-${sqlNow().slice(0, 10)}.csv"`);
  res.send([head.join(','), ...lines].join('\n'));
}));

async function loadOr404(id) {
  const n = Number(id);
  const row = Number.isInteger(n) ? await getComplaintRow('c.id = ?', n) : null;
  if (!row) throw new HttpError(404, 'Complaint not found.');
  return row;
}

router.get('/staff/complaints/:id', wrap(async (req, res) => {
  res.json(await staffView(await loadOr404(req.params.id)));
}));

router.patch('/staff/complaints/:id', wrap(async (req, res) => {
  const row = await loadOr404(req.params.id);
  const actor = req.user.name;
  const sets = [];
  const params = [];
  const logs = [];
  const now = sqlNow();
  const { status, priority, assignedTo, departmentId } = req.body;
  let resolvedMessage = false;

  if (status !== undefined && status !== row.status) {
    if (!STATUSES.includes(status)) throw new HttpError(400, 'Unknown status.');
    sets.push('status = ?');
    params.push(status);
    if (status === 'Resolved') {
      sets.push('resolved_at = ?');
      params.push(now);
      resolvedMessage = true;
    } else if (status !== 'Closed') {
      sets.push('resolved_at = NULL');
    }
    logs.push([actor, `Status → ${status}`]);
  }
  if (priority !== undefined && priority !== row.priority) {
    if (!PRIORITIES.includes(priority)) throw new HttpError(400, 'Unknown priority.');
    sets.push('priority = ?');
    params.push(priority);
    logs.push([actor, `Priority → ${priority}`]);
  }
  if (assignedTo !== undefined && (assignedTo || null) !== row.assigned_to) {
    const officer = assignedTo ? await findUser(Number(assignedTo)) : null;
    if (assignedTo && !officer) throw new HttpError(400, 'Unknown officer.');
    sets.push('assigned_to = ?');
    params.push(officer ? officer.id : null);
    logs.push([actor, officer ? `Assigned to ${officer.name}` : 'Unassigned']);
    if (officer && row.status === 'New' && status === undefined) {
      sets.push("status = 'In progress'");
      logs.push(['System', 'Status → In progress']);
    }
  }
  if (departmentId !== undefined && Number(departmentId) !== row.department_id) {
    const dept = await db.get('SELECT id, name FROM departments WHERE id = ?', Number(departmentId));
    if (!dept) throw new HttpError(400, 'Unknown department.');
    sets.push('department_id = ?');
    params.push(dept.id);
    logs.push([actor, `Escalated / moved to ${dept.name}`]);
  }

  if (sets.length) {
    sets.push('updated_at = ?');
    params.push(now);
    await db.run(`UPDATE complaints SET ${sets.join(', ')} WHERE id = ?`, ...params, row.id);
    for (const [who, text] of logs) await logActivity(row.id, who, text);
    if (resolvedMessage) {
      await addMessage(row.id, { authorType: 'system', body: 'Marked as resolved. Please rate the resolution, or reopen it if the problem is not fixed.' });
    }
  }
  res.json(await staffView(await loadOr404(row.id)));
}));

router.post('/staff/complaints/:id/messages', wrap(async (req, res) => {
  const row = await loadOr404(req.params.id);
  const body = clean(req.body.body, 5000);
  const internal = !!req.body.internal;
  if (!body) throw new HttpError(400, 'Write a message first.');
  await addMessage(row.id, { authorType: 'staff', authorId: req.user.id, body, internal });
  await logActivity(row.id, req.user.name, internal ? 'Internal note added' : 'Replied to student');
  if (!internal && req.body.awaitStudent) {
    await db.run("UPDATE complaints SET status = 'Awaiting student' WHERE id = ?", row.id);
    await logActivity(row.id, req.user.name, 'Status → Awaiting student');
  } else if (!internal && row.status === 'New') {
    await db.run("UPDATE complaints SET status = 'In progress' WHERE id = ?", row.id);
    await logActivity(row.id, 'System', 'Status → In progress');
  }
  res.status(201).json(await staffView(await loadOr404(row.id)));
}));

export default router;
