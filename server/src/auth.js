import jwt from 'jsonwebtoken';
import { db } from './db.js';
import { JWT_SECRET, TOKEN_TTL } from './config.js';
import { HttpError } from './util.js';

// Tokens carry `kind` so a student token can never be used as a staff token (or the reverse).
export function signToken(user, kind = 'staff') {
  return jwt.sign({ sub: user.id, kind, role: kind === 'student' ? 'student' : user.role }, JWT_SECRET, {
    expiresIn: TOKEN_TTL
  });
}

export function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, departmentId: u.department_id, department: u.department };
}

export function publicStudent(s) {
  return { id: s.id, name: s.name, email: s.email, matric: s.matric, department: s.department, role: 'student' };
}

export function findUser(id) {
  return db.get(
    'SELECT u.*, d.name AS department FROM users u LEFT JOIN departments d ON d.id = u.department_id WHERE u.id = ?',
    Number(id)
  );
}

export function findStudent(id) {
  return db.get('SELECT * FROM students WHERE id = ?', Number(id));
}

function readToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(header.slice(7), JWT_SECRET);
  } catch {
    return 'expired';
  }
}

const asyncMw = (fn) => (req, res, next) => fn(req).then(() => next(), next);

// Requires a signed-in staff member; puts them on req.user.
export const requireStaff = asyncMw(async (req) => {
  const payload = readToken(req);
  if (!payload) throw new HttpError(401, 'Please sign in.');
  if (payload === 'expired') throw new HttpError(401, 'Your session has expired. Please sign in again.');
  if (payload.kind === 'student') throw new HttpError(403, 'This area is for staff only.');
  const user = await findUser(payload.sub);
  if (!user) throw new HttpError(401, 'Account no longer exists.');
  req.user = user;
});

// Requires a signed-in student; puts them on req.student.
export const requireStudent = asyncMw(async (req) => {
  const payload = readToken(req);
  if (!payload) throw new HttpError(401, 'Please sign in.');
  if (payload === 'expired') throw new HttpError(401, 'Your session has expired. Please sign in again.');
  if (payload.kind !== 'student') throw new HttpError(403, 'This area is for students only.');
  const student = await findStudent(payload.sub);
  if (!student) throw new HttpError(401, 'Account no longer exists.');
  req.student = student;
});

// Optional: sets req.user (staff) or req.student when a valid token is present.
export const optionalAuth = asyncMw(async (req) => {
  const payload = readToken(req);
  if (!payload || payload === 'expired') return;
  if (payload.kind === 'student') req.student = (await findStudent(payload.sub)) || undefined;
  else req.user = (await findUser(payload.sub)) || undefined;
});

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') return next(new HttpError(403, 'Only administrators can do that.'));
  next();
}
