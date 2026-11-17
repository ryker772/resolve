// Vercel entry point: the whole Express API runs as one Vercel Function.
// vercel.json sends every /api/* request here; the React app is served by Vercel's CDN.
import app from '../server/src/app.js';

export default app;
