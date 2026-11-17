// Postgres access.
// - With DATABASE_URL (Neon on Vercel, or any Postgres): uses the `pg` driver.
// - Without it (local development): uses PGlite, a full Postgres that runs inside Node and
//   keeps its data in server/data/pglite. Nothing to install.
// Queries are written with `?` placeholders; they are converted to Postgres' $1, $2… here.
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import { DATABASE_URL, LOCAL_DB_DIR, DATA_DIR, IS_VERCEL, CATEGORIES, STAFF_PASSWORD } from './config.js';

let driver; // { query(text, params) -> { rows }, transaction(fn) }

async function connect() {
  if (DATABASE_URL) {
    const { default: pg } = await import('pg');
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(DATABASE_URL);
    const pool = new pg.Pool({
      connectionString: DATABASE_URL,
      max: 5,
      // Hosted databases (Neon) need an encrypted, certificate-checked connection.
      // If the URL already says sslmode=…, pg follows that instead.
      ...(local ? { ssl: false } : /sslmode=/.test(DATABASE_URL) ? {} : { ssl: true })
    });
    return {
      kind: 'postgres',
      query: (text, params) => pool.query(text, params),
      async transaction(fn) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const out = await fn({ query: (t, p) => client.query(t, p) });
          await client.query('COMMIT');
          return out;
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          throw err;
        } finally {
          client.release();
        }
      },
      end: () => pool.end()
    };
  }
  if (IS_VERCEL) throw new Error('DATABASE_URL is not set. Connect a Neon database in the Vercel Storage tab.');
  const { PGlite } = await import('@electric-sql/pglite');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const pglite = new PGlite(LOCAL_DB_DIR);
  await pglite.waitReady;
  return {
    kind: 'pglite',
    query: (text, params) => pglite.query(text, params),
    transaction: (fn) => pglite.transaction((tx) => fn({ query: (t, p) => tx.query(t, p) })),
    end: () => pglite.close()
  };
}

// `?` -> `$1`, `$2`, … (none of our SQL contains a literal question mark).
function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function makeApi(exec) {
  const api = {
    async all(sql, ...params) {
      const res = await exec(toPg(sql), params);
      return res.rows;
    },
    async get(sql, ...params) {
      return (await api.all(sql, ...params))[0];
    },
    async run(sql, ...params) {
      return exec(toPg(sql), params);
    },
    // INSERT … RETURNING id
    async insert(sql, ...params) {
      const res = await exec(toPg(`${sql} RETURNING id`), params);
      return res.rows[0].id;
    }
  };
  return api;
}

let ready;
// Every request awaits this before touching the database (connects + creates tables once).
export function dbReady() {
  if (!ready) {
    ready = (async () => {
      driver = await connect();
      await init();
    })().catch((err) => {
      ready = undefined; // allow a retry on the next request
      throw err;
    });
  }
  return ready;
}

export const db = makeApi((text, params) => driver.query(text, params));

// Run several statements atomically: await tx(async (t) => { await t.run(...); ... })
export function tx(fn) {
  return driver.transaction((client) => fn(makeApi((text, params) => client.query(text, params))));
}

export async function closeDb() {
  if (driver) await driver.end();
}

export const dbKind = () => driver?.kind;

// Times are stored as 'YYYY-MM-DD HH:MM:SS' text in UTC (see util.js).
const NOW = `to_char(timezone('UTC', now()), 'YYYY-MM-DD HH24:MI:SS')`;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS departments (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'officer')),
  department_id INTEGER REFERENCES departments(id),
  created_at    TEXT NOT NULL DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS students (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  matric        TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL UNIQUE,
  department    TEXT,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS complaints (
  id            SERIAL PRIMARY KEY,
  ticket        TEXT UNIQUE,
  access_code   TEXT NOT NULL,
  kind          TEXT NOT NULL,
  category      TEXT NOT NULL,
  subject       TEXT NOT NULL,
  details       TEXT NOT NULL,
  location      TEXT,
  incident_date TEXT,
  priority      TEXT NOT NULL DEFAULT 'Normal',
  status        TEXT NOT NULL DEFAULT 'New',
  anonymous     INTEGER NOT NULL DEFAULT 0,
  name          TEXT,
  matric        TEXT,
  email         TEXT,
  department_id INTEGER REFERENCES departments(id),
  assigned_to   INTEGER REFERENCES users(id),
  student_id    INTEGER REFERENCES students(id),
  rating        INTEGER CHECK (rating BETWEEN 1 AND 5),
  due_at        TEXT NOT NULL,
  resolved_at   TEXT,
  created_at    TEXT NOT NULL DEFAULT ${NOW},
  updated_at    TEXT NOT NULL DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS messages (
  id            SERIAL PRIMARY KEY,
  complaint_id  INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  author_type   TEXT NOT NULL CHECK (author_type IN ('student', 'staff', 'system')),
  author_id     INTEGER REFERENCES users(id),
  body          TEXT NOT NULL,
  internal      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS attachments (
  id            SERIAL PRIMARY KEY,
  complaint_id  INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  message_id    INTEGER REFERENCES messages(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  stored_name   TEXT NOT NULL,
  storage       TEXT NOT NULL DEFAULT 'local',
  mime          TEXT,
  size          INTEGER,
  created_at    TEXT NOT NULL DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS activity (
  id            SERIAL PRIMARY KEY,
  complaint_id  INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  actor         TEXT NOT NULL,
  text          TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT ${NOW}
);

CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_student ON complaints(student_id);
CREATE INDEX IF NOT EXISTS idx_messages_complaint ON messages(complaint_id);
CREATE INDEX IF NOT EXISTS idx_activity_complaint ON activity(complaint_id);
`;

async function init() {
  await tx(async (t) => {
    // Stops two cold-starting server instances creating tables at the same moment.
    await t.run('SELECT pg_advisory_xact_lock(40712)');
    for (const stmt of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) await t.run(stmt);

    for (const d of new Set(CATEGORIES.map((c) => c.department))) {
      await t.run('INSERT INTO departments (name) VALUES (?) ON CONFLICT (name) DO NOTHING', d);
    }

    const { n } = await t.get('SELECT COUNT(*)::int AS n FROM users');
    if (n > 0) return;

    // First run: default staff accounts. On Vercel they all start with STAFF_PASSWORD.
    const dept = async (name) => (await t.get('SELECT id FROM departments WHERE name = ?', name)).id;
    const adminPw = bcrypt.hashSync(STAFF_PASSWORD || 'Admin@123', 10);
    const officerPw = bcrypt.hashSync(STAFF_PASSWORD || 'Officer@123', 10);
    const staff = [
      ['System Admin', 'admin@resolve.test', adminPw, 'admin', 'Complaints Office'],
      ['Hostel Officer', 'hostel@resolve.test', officerPw, 'officer', 'Hostel Management'],
      ['Academic Officer', 'academics@resolve.test', officerPw, 'officer', 'Academic Affairs'],
      ['Bursary Officer', 'bursary@resolve.test', officerPw, 'officer', 'Bursary'],
      ['ICT Officer', 'ict@resolve.test', officerPw, 'officer', 'ICT Unit']
    ];
    for (const [name, email, hash, role, d] of staff) {
      await t.run('INSERT INTO users (name, email, password_hash, role, department_id) VALUES (?, ?, ?, ?, ?)',
        name, email, hash, role, await dept(d));
    }
    console.log('Created default staff accounts (see README for logins).');
  });
}
