// The Express app. Used by src/index.js (local server) and api/index.js (Vercel).
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { PORT, CLIENT_DIST, IS_VERCEL, configProblems, MAX_FILE_MB, MAX_FILES } from './config.js';
import { dbReady } from './db.js';
import publicRoutes from './routes/public.js';
import staffRoutes from './routes/staff.js';
import attachmentRoutes from './routes/attachments.js';
import studentRoutes from './routes/students.js';

const app = express();
app.set('trust proxy', true);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  const problems = configProblems();
  res.status(problems.length ? 500 : 200).json({ ok: !problems.length, problems });
});

// Check settings, then make sure the database is connected and tables exist.
app.use('/api', (_req, res, next) => {
  const problems = configProblems();
  if (problems.length) return res.status(500).json({ error: `Server not configured: ${problems.join(' ')}` });
  dbReady().then(() => next(), next);
});

app.use('/api', publicRoutes);
app.use('/api', staffRoutes);
app.use('/api', attachmentRoutes);
app.use('/api', studentRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

// Local production mode (`npm run build` + `npm start`): serve the React app from this server.
// On Vercel the React app is served by Vercel's CDN instead.
if (!IS_VERCEL) {
  if (fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
    app.use(express.static(CLIENT_DIST));
    app.get('*', (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
  } else {
    app.get('*', (_req, res) => {
      res.type('html').send(`<!doctype html><meta charset="utf-8"><title>Resolve API</title>
        <body style="font-family:system-ui,sans-serif;max-width:560px;margin:80px auto;padding:0 16px;line-height:1.6">
        <h1 style="font-size:24px">This is the Resolve API (port ${PORT})</h1>
        <p>The website runs on <a href="http://localhost:5173">http://localhost:5173</a> while you use <code>npm run dev</code>.</p>
        <p>To serve the whole site from this port instead, run <code>npm run build</code> and then <code>npm start</code>.</p>
        </body>`);
    });
  }
}

// Errors -> JSON
app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: `Each file can be at most ${MAX_FILE_MB} MB.` });
  if (err.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ error: `You can attach up to ${MAX_FILES} files.` });
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Something went wrong on the server.' : err.message });
});

export default app;
