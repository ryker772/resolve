import crypto from 'node:crypto';
import { TARGET_WORKING_DAYS } from './config.js';

// SQLite stores times as 'YYYY-MM-DD HH:MM:SS' in UTC.
export function sqlNow(date = new Date()) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

// Convert a stored UTC time to ISO so the browser can format it in local time.
export function iso(sqlTime) {
  return sqlTime ? sqlTime.replace(' ', 'T') + 'Z' : null;
}

export function addWorkingDays(start, days = TARGET_WORKING_DAYS) {
  const d = new Date(start);
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

export function ticketFor(id, date = new Date()) {
  return `RSV-${date.getUTCFullYear()}-${String(id).padStart(4, '0')}`;
}

// 6-character code, no look-alike characters (0/O, 1/I/L).
export function accessCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export function clean(value, max = 5000) {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, max);
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Wrap route handlers so thrown errors reach the error middleware.
export const wrap = (fn) => (req, res, next) => {
  try {
    const out = fn(req, res, next);
    if (out && typeof out.catch === 'function') out.catch(next);
  } catch (err) {
    next(err);
  }
};
