// File uploads. Files are held in memory by multer, then saved to:
// - Vercel Blob (private store) when one is connected, or
// - server/data/uploads on this computer otherwise.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import multer from 'multer';
import { UPLOAD_DIR, USE_BLOB, IS_VERCEL, MAX_FILE_MB, MAX_FILES, MAX_TOTAL_MB } from './config.js';
import { HttpError } from './util.js';

const ALLOWED = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]);

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) cb(null, true);
    else cb(new HttpError(400, `"${file.originalname}" is not an allowed file type. Use images, PDF, Word or text files.`));
  }
});

// Express middleware: parses multipart form data into req.body and req.files.
export function uploadFiles(field = 'files') {
  const handler = parser.array(field, MAX_FILES);
  return (req, res, next) =>
    handler(req, res, (err) => {
      if (err) return next(err);
      const total = (req.files || []).reduce((n, f) => n + f.size, 0);
      if (total > MAX_TOTAL_MB * 1024 * 1024) return next(new HttpError(400, `Attachments can be at most ${MAX_TOTAL_MB} MB in total.`));
      if ((req.files || []).length && IS_VERCEL && !USE_BLOB) {
        return next(new HttpError(503, 'File uploads are not set up yet (no Blob store connected). Submit without attachments for now.'));
      }
      next();
    });
}

function safeExt(name) {
  return path.extname(name).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 10);
}

// Saves multer files; returns rows ready for the attachments table.
export async function saveFiles(files = []) {
  const saved = [];
  for (const f of files) {
    const key = `complaints/${crypto.randomUUID()}${safeExt(f.originalname)}`;
    if (USE_BLOB) {
      const { put } = await import('@vercel/blob');
      await put(key, f.buffer, { access: 'private', contentType: f.mimetype, addRandomSuffix: false });
      saved.push({ name: f.originalname, key, storage: 'blob', mime: f.mimetype, size: f.size });
    } else {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      const local = path.basename(key);
      fs.writeFileSync(path.join(UPLOAD_DIR, local), f.buffer);
      saved.push({ name: f.originalname, key: local, storage: 'local', mime: f.mimetype, size: f.size });
    }
  }
  return saved;
}

// Returns a Node readable stream for a stored attachment, or null if it is missing.
export async function openFile(att) {
  if (att.storage === 'blob') {
    const { get } = await import('@vercel/blob');
    const result = await get(att.stored_name, { access: 'private' });
    if (!result || result.statusCode !== 200) return null;
    return Readable.fromWeb(result.stream);
  }
  const file = path.join(UPLOAD_DIR, path.basename(att.stored_name));
  return fs.existsSync(file) ? fs.createReadStream(file) : null;
}
