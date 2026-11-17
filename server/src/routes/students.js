// Student accounts: register, sign in, and see all of your own complaints.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { requireStudent, signToken, publicStudent, findStudent, optionalAuth, publicUser } from '../auth.js';
import { clean, HttpError, wrap } from '../util.js';
import { summary } from '../complaints.js';

const router = Router();

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/students/register', wrap(async (req, res) => {
  const name = clean(req.body.name, 120);
  const matric = clean(req.body.matric, 40).toUpperCase();
  const email = clean(req.body.email, 160).toLowerCase();
  const department = clean(req.body.department, 120);
  const password = String(req.body.password || '');

  const fields = {};
  if (name.length < 3) fields.name = 'Enter your full name.';
  if (matric.length < 4) fields.matric = 'Enter your matric number.';
  if (!EMAIL.test(email)) fields.email = 'Enter a valid email address.';
  if (password.length < 8) fields.password = 'Use at least 8 characters.';
  if (!fields.matric && (await db.get('SELECT 1 AS x FROM students WHERE matric = ?', matric))) {
    fields.matric = 'An account with this matric number already exists. Sign in instead.';
  }
  if (!fields.email && (await db.get('SELECT 1 AS x FROM students WHERE email = ?', email))) {
    fields.email = 'An account with this email already exists. Sign in instead.';
  }
  if (Object.keys(fields).length) return res.status(400).json({ error: 'Please fix the highlighted fields.', fields });

  const id = await db.insert(
    'INSERT INTO students (name, matric, email, department, password_hash) VALUES (?, ?, ?, ?, ?)',
    name, matric, email, department || null, bcrypt.hashSync(password, 10)
  );
  const student = await findStudent(id);
  res.status(201).json({ token: signToken(student, 'student'), user: publicStudent(student) });
}));

// Sign in with email OR matric number.
router.post('/students/login', wrap(async (req, res) => {
  const id = clean(req.body.identifier, 160);
  const password = String(req.body.password || '');
  const student = await db.get('SELECT * FROM students WHERE email = ? OR matric = ?', id.toLowerCase(), id.toUpperCase());
  if (!student || !bcrypt.compareSync(password, student.password_hash)) {
    throw new HttpError(401, 'Incorrect matric number/email or password.');
  }
  res.json({ token: signToken(student, 'student'), user: publicStudent(student) });
}));

// Who is signed in (student or staff).
router.get('/me', optionalAuth, (req, res) => {
  if (req.student) return res.json(publicStudent(req.student));
  if (req.user) return res.json(publicUser(req.user));
  res.status(401).json({ error: 'Not signed in.' });
});

// The signed-in student's own complaints. Access codes are included so they can open each ticket.
router.get('/students/complaints', requireStudent, wrap(async (req, res) => {
  const rows = await db.all(
    `SELECT c.*, d.name AS department, u.name AS officer_name,
       (SELECT COUNT(*)::int FROM messages m WHERE m.complaint_id = c.id AND m.author_type = 'staff' AND m.internal = 0) AS staff_replies
     FROM complaints c
     LEFT JOIN departments d ON d.id = c.department_id
     LEFT JOIN users u ON u.id = c.assigned_to
     WHERE c.student_id = ? ORDER BY c.id DESC`,
    req.student.id
  );
  const items = rows.map((r) => ({ ...summary(r), accessCode: r.access_code, anonymous: !!r.anonymous, staffReplies: r.staff_replies }));
  const open = items.filter((i) => !['Resolved', 'Closed'].includes(i.status)).length;
  res.json({ items, counts: { total: items.length, open, resolved: items.length - open } });
}));

export default router;
