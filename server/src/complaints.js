// Shared data access for complaints, used by the public, student and staff routes.
// Functions take an optional `conn` so they can run inside a transaction (tx) as well.
import { db, tx } from './db.js';
import { CATEGORIES } from './config.js';
import { sqlNow, iso, addWorkingDays, ticketFor, accessCode } from './util.js';

export const OPEN_CLAUSE = "status NOT IN ('Resolved', 'Closed')";

export function isOverdue(row) {
  return !['Resolved', 'Closed'].includes(row.status) && new Date(iso(row.due_at)) < new Date();
}

export async function logActivity(complaintId, actor, text, conn = db) {
  await conn.run('INSERT INTO activity (complaint_id, actor, text, created_at) VALUES (?, ?, ?, ?)',
    complaintId, actor, text, sqlNow());
}

export async function addMessage(complaintId, { authorType, authorId = null, body, internal = false }, conn = db) {
  const now = sqlNow();
  const id = await conn.insert(
    'INSERT INTO messages (complaint_id, author_type, author_id, body, internal, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    complaintId, authorType, authorId, body, internal ? 1 : 0, now
  );
  await conn.run('UPDATE complaints SET updated_at = ? WHERE id = ?', now, complaintId);
  return id;
}

// `saved` comes from uploads.saveFiles().
export async function addAttachments(complaintId, saved = [], messageId = null, conn = db) {
  for (const f of saved) {
    await conn.run(
      'INSERT INTO attachments (complaint_id, message_id, original_name, stored_name, storage, mime, size) VALUES (?, ?, ?, ?, ?, ?, ?)',
      complaintId, messageId, f.name, f.key, f.storage, f.mime, f.size
    );
  }
}

export async function createComplaint(input, saved = [], createdAt = new Date()) {
  const category = CATEGORIES.find((c) => c.name === input.category);
  const code = accessCode();
  const now = sqlNow(createdAt);

  return tx(async (t) => {
    const dept = await t.get('SELECT id, name FROM departments WHERE name = ?', category.department);
    const id = await t.insert(
      `INSERT INTO complaints (access_code, kind, category, subject, details, location, incident_date, priority,
        anonymous, name, matric, email, department_id, student_id, due_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      code, input.kind, input.category, input.subject, input.details, input.location || null,
      input.incidentDate || null, input.priority, input.anonymous ? 1 : 0,
      input.anonymous ? null : input.name || null, input.anonymous ? null : input.matric || null,
      input.email || null, dept.id, input.studentId || null, sqlNow(addWorkingDays(createdAt)), now, now
    );
    const ticket = ticketFor(id, createdAt);
    await t.run('UPDATE complaints SET ticket = ? WHERE id = ?', ticket, id);
    await addAttachments(id, saved, null, t);
    await t.run('INSERT INTO messages (complaint_id, author_type, body, created_at) VALUES (?, ?, ?, ?)',
      id, 'system', `Ticket created and sent to ${dept.name}.`, now);
    await t.run('INSERT INTO activity (complaint_id, actor, text, created_at) VALUES (?, ?, ?, ?)',
      id, 'System', 'Ticket created', now);
    return { id, ticket, accessCode: code };
  });
}

export const BASE_SELECT = `
  SELECT c.*, d.name AS department, u.name AS officer_name
  FROM complaints c
  LEFT JOIN departments d ON d.id = c.department_id
  LEFT JOIN users u ON u.id = c.assigned_to`;

export function getComplaintRow(where, ...params) {
  return db.get(`${BASE_SELECT} WHERE ${where}`, ...params);
}

async function attachmentsFor(id) {
  const rows = await db.all('SELECT id, message_id, original_name, mime, size FROM attachments WHERE complaint_id = ? ORDER BY id', id);
  return rows.map((a) => ({ id: a.id, messageId: a.message_id, name: a.original_name, mime: a.mime, size: a.size }));
}

async function messagesFor(id, includeInternal) {
  const rows = await db.all(
    `SELECT m.*, u.name AS staff_name FROM messages m LEFT JOIN users u ON u.id = m.author_id
     WHERE m.complaint_id = ? ${includeInternal ? '' : 'AND m.internal = 0'} ORDER BY m.id`,
    id
  );
  return rows.map((m) => ({
    id: m.id,
    authorType: m.author_type,
    staffName: m.staff_name,
    body: m.body,
    internal: !!m.internal,
    createdAt: iso(m.created_at)
  }));
}

// Shape for list views.
export function summary(row) {
  return {
    id: row.id,
    ticket: row.ticket,
    kind: row.kind,
    category: row.category,
    subject: row.subject,
    priority: row.priority,
    status: row.status,
    overdue: isOverdue(row),
    department: row.department,
    assignedTo: row.assigned_to,
    officerName: row.officer_name,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    dueAt: iso(row.due_at)
  };
}

// What a student sees on the tracking page: no internal notes, no staff email addresses.
export async function publicView(row, includeInternal = false) {
  const [messages, attachments] = await Promise.all([messagesFor(row.id, includeInternal), attachmentsFor(row.id)]);
  return {
    ...summary(row),
    details: row.details,
    location: row.location,
    incidentDate: row.incident_date,
    anonymous: !!row.anonymous,
    rating: row.rating,
    resolvedAt: iso(row.resolved_at),
    messages,
    attachments
  };
}

// What staff see on the detail page.
export async function staffView(row) {
  const [base, activity] = await Promise.all([
    publicView(row, true),
    db.all('SELECT actor, text, created_at FROM activity WHERE complaint_id = ? ORDER BY id DESC', row.id)
  ]);
  return {
    ...base,
    name: row.name,
    matric: row.matric,
    email: row.email,
    departmentId: row.department_id,
    activity: activity.map((a) => ({ actor: a.actor, text: a.text, createdAt: iso(a.created_at) }))
  };
}
