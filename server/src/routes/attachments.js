// Download an attachment. Staff use their token; students use ticket + access code.
import { Router } from 'express';
import { db } from '../db.js';
import { optionalAuth } from '../auth.js';
import { openFile } from '../uploads.js';
import { HttpError, wrap, clean } from '../util.js';

const router = Router();

router.get('/attachments/:id', optionalAuth, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const a = Number.isInteger(id)
    ? await db.get('SELECT a.*, c.ticket, c.access_code FROM attachments a JOIN complaints c ON c.id = a.complaint_id WHERE a.id = ?', id)
    : null;
  if (!a) throw new HttpError(404, 'File not found.');

  const studentOk =
    clean(req.query.ticket, 40).toUpperCase() === a.ticket &&
    clean(req.query.code, 20).toUpperCase() === a.access_code;
  if (!req.user && !studentOk) throw new HttpError(403, 'You do not have access to this file.');

  const stream = await openFile(a);
  if (!stream) throw new HttpError(404, 'File is missing from storage.');
  res.setHeader('Content-Type', a.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${a.original_name.replace(/["\\\r\n]/g, '_')}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}));

export default router;
