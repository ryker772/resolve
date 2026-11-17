// Routes students and visitors use: submit, track, reply, rate, reopen.
import { Router } from 'express';
import { db } from '../db.js';
import { CATEGORIES, KINDS, PRIORITIES, MAX_FILE_MB, MAX_FILES, MAX_TOTAL_MB } from '../config.js';
import { uploadFiles, saveFiles } from '../uploads.js';
import { optionalAuth } from '../auth.js';
import { clean, HttpError, wrap, sqlNow } from '../util.js';
import {
  createComplaint, getComplaintRow, publicView, addMessage, addAttachments, logActivity
} from '../complaints.js';

const router = Router();

// Very small brute-force guard for ticket + code lookups (per server instance).
const failures = new Map();
function guard(req) {
  const entry = failures.get(req.ip);
  if (entry && entry.count >= 10 && Date.now() - entry.first < 15 * 60 * 1000) {
    throw new HttpError(429, 'Too many failed attempts. Please wait 15 minutes and try again.');
  }
}
function recordFailure(req) {
  const entry = failures.get(req.ip);
  if (!entry || Date.now() - entry.first > 15 * 60 * 1000) failures.set(req.ip, { count: 1, first: Date.now() });
  else entry.count++;
}

// Look up a complaint by ticket + access code, or 404.
async function findTracked(req) {
  guard(req);
  const ticket = clean(req.params.ticket, 40).toUpperCase();
  const code = clean(req.query.code ?? req.body?.code, 20).toUpperCase();
  const row = ticket && code ? await getComplaintRow('c.ticket = ? AND c.access_code = ?', ticket, code) : null;
  if (!row) {
    recordFailure(req);
    throw new HttpError(404, 'No complaint matches that ticket ID and access code.');
  }
  return row;
}

const reload = async (id) => publicView(await getComplaintRow('c.id = ?', id));

router.get('/meta', (_req, res) => {
  res.json({
    categories: CATEGORIES.map((c) => c.name),
    kinds: KINDS,
    priorities: PRIORITIES,
    maxFileMb: MAX_FILE_MB,
    maxTotalMb: MAX_TOTAL_MB,
    maxFiles: MAX_FILES
  });
});

router.post(
  '/complaints',
  optionalAuth,
  uploadFiles('files'),
  wrap(async (req, res) => {
    const b = req.body;
    const input = {
      kind: clean(b.kind, 20),
      category: clean(b.category, 60),
      subject: clean(b.subject, 160),
      details: clean(b.details, 5000),
      location: clean(b.location, 160),
      incidentDate: clean(b.incidentDate, 10),
      priority: clean(b.priority, 10) || 'Normal',
      anonymous: b.anonymous === 'true' || b.anonymous === true,
      name: clean(b.name, 120),
      matric: clean(b.matric, 40),
      email: clean(b.email, 160)
    };

    const errors = {};
    if (!KINDS.includes(input.kind)) errors.kind = 'Choose a submission type.';
    if (!CATEGORIES.some((c) => c.name === input.category)) errors.category = 'Choose a category.';
    if (input.subject.length < 5) errors.subject = 'Give a short subject (at least 5 characters).';
    if (input.details.length < 20) errors.details = 'Describe what happened (at least 20 characters).';
    if (!PRIORITIES.includes(input.priority)) errors.priority = 'Choose an urgency level.';
    if (input.incidentDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.incidentDate)) errors.incidentDate = 'Use a valid date.';
    if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) errors.email = 'Enter a valid email address.';
    if (Object.keys(errors).length) {
      return res.status(400).json({ error: 'Please fix the highlighted fields.', fields: errors });
    }

    // Signed-in students: link the complaint to their account and fill in any missing details.
    // (Anonymous complaints are still linked so they appear in "My complaints", but staff never see who sent them.)
    if (req.student) {
      input.studentId = req.student.id;
      if (!input.anonymous) {
        input.name = input.name || req.student.name;
        input.matric = input.matric || req.student.matric;
        input.email = input.email || req.student.email;
      }
      // Anonymous: only an email the student typed in is kept; the account email is never added.
    }
    const saved = await saveFiles(req.files);
    const created = await createComplaint(input, saved);
    res.status(201).json({ ticket: created.ticket, accessCode: created.accessCode });
  })
);

router.get('/track/:ticket', wrap(async (req, res) => {
  res.json(await publicView(await findTracked(req)));
}));

router.post(
  '/track/:ticket/messages',
  uploadFiles('files'),
  wrap(async (req, res) => {
    const row = await findTracked(req);
    if (row.status === 'Closed') throw new HttpError(400, 'This complaint is closed. Reopen it to send a message.');
    const body = clean(req.body.body, 5000);
    if (!body) throw new HttpError(400, 'Write a message first.');
    const saved = await saveFiles(req.files);
    const messageId = await addMessage(row.id, { authorType: 'student', body });
    await addAttachments(row.id, saved, messageId);
    await logActivity(row.id, 'Student', 'Student replied');
    if (row.status === 'Awaiting student') {
      await db.run("UPDATE complaints SET status = 'In progress' WHERE id = ?", row.id);
      await logActivity(row.id, 'System', 'Status → In progress (student replied)');
    }
    res.status(201).json(await reload(row.id));
  })
);

router.post('/track/:ticket/rating', wrap(async (req, res) => {
  const row = await findTracked(req);
  if (!['Resolved', 'Closed'].includes(row.status)) {
    throw new HttpError(400, 'You can rate the resolution once your complaint is marked resolved.');
  }
  const rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, 'Rating must be 1 to 5.');
  await db.run('UPDATE complaints SET rating = ?, updated_at = ? WHERE id = ?', rating, sqlNow(), row.id);
  await logActivity(row.id, 'Student', `Rated the resolution ${rating}/5`);
  res.json(await reload(row.id));
}));

router.post('/track/:ticket/close', wrap(async (req, res) => {
  const row = await findTracked(req);
  if (row.status !== 'Resolved') throw new HttpError(400, 'Only a resolved complaint can be closed.');
  await db.run("UPDATE complaints SET status = 'Closed', updated_at = ? WHERE id = ?", sqlNow(), row.id);
  await addMessage(row.id, { authorType: 'system', body: 'Student confirmed the resolution. Ticket closed.' });
  await logActivity(row.id, 'Student', 'Status → Closed (confirmed by student)');
  res.json(await reload(row.id));
}));

router.post('/track/:ticket/reopen', wrap(async (req, res) => {
  const row = await findTracked(req);
  if (!['Resolved', 'Closed'].includes(row.status)) throw new HttpError(400, 'This complaint is still open.');
  const reason = clean(req.body.reason, 2000);
  if (reason.length < 5) throw new HttpError(400, 'Tell the officer why you are reopening it.');
  await db.run("UPDATE complaints SET status = 'In progress', resolved_at = NULL, rating = NULL WHERE id = ?", row.id);
  await addMessage(row.id, { authorType: 'student', body: `Reopened: ${reason}` });
  await logActivity(row.id, 'Student', 'Reopened the complaint');
  res.json(await reload(row.id));
}));

export default router;
