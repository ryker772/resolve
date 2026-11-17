import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(here, '..');

// Load server/.env when running locally (Vercel sets env vars itself).
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') process.loadEnvFile(envFile);

export const IS_VERCEL = !!process.env.VERCEL;
export const DATA_DIR = path.join(ROOT, 'data');
export const LOCAL_DB_DIR = path.join(DATA_DIR, 'pglite');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const CLIENT_DIST = path.resolve(ROOT, '..', 'client', 'dist');

export const PORT = Number(process.env.PORT) || 4000;

// Postgres connection string. Neon (via Vercel) sets DATABASE_URL / POSTGRES_URL.
// Without one, a local embedded Postgres (PGlite) in server/data is used.
export const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

// Attachments go to Vercel Blob (private) when a store is connected, otherwise to server/data/uploads.
export const USE_BLOB = !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

// Secrets. Both MUST be set as environment variables on Vercel (see README).
export const JWT_SECRET = process.env.JWT_SECRET || (IS_VERCEL ? '' : 'local-dev-secret-change-me');
export const TOKEN_TTL = '8h';
export const STAFF_PASSWORD = process.env.STAFF_PASSWORD || (IS_VERCEL ? '' : null);

export function configProblems() {
  const p = [];
  if (IS_VERCEL && !DATABASE_URL) p.push('No database connected. In Vercel: Storage → Create Database → Neon, then redeploy.');
  if (IS_VERCEL && (!JWT_SECRET || JWT_SECRET.length < 16)) p.push('Set a JWT_SECRET environment variable (at least 16 random characters), then redeploy.');
  if (IS_VERCEL && !STAFF_PASSWORD) p.push('Set a STAFF_PASSWORD environment variable (the first password for the staff accounts), then redeploy.');
  return p;
}

// Response target: complaints are due this many working days after submission.
export const TARGET_WORKING_DAYS = 5;

// Vercel rejects requests over 4.5 MB, so attachments are capped at 4 MB in total per submission.
export const MAX_FILE_MB = 4;
export const MAX_TOTAL_MB = 4;
export const MAX_FILES = 5;

// Category -> department that handles it.
export const CATEGORIES = [
  { name: 'Academics', department: 'Academic Affairs' },
  { name: 'Hostel & facilities', department: 'Hostel Management' },
  { name: 'Fees & finance', department: 'Bursary' },
  { name: 'Staff conduct', department: 'Registry' },
  { name: 'IT & student portal', department: 'ICT Unit' },
  { name: 'General feedback', department: 'Complaints Office' },
  { name: 'Other', department: 'Complaints Office' }
];

export const KINDS = ['Complaint', 'Feedback', 'Suggestion'];
export const PRIORITIES = ['Low', 'Normal', 'Urgent'];
export const STATUSES = ['New', 'In progress', 'Awaiting student', 'Resolved', 'Closed'];
