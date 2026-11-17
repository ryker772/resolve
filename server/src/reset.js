// Deletes the LOCAL database and uploaded files so you can start fresh. Run: npm run reset
// It never touches a hosted (Neon) database.
import fs from 'node:fs';
import { DATA_DIR, DATABASE_URL } from './config.js';

if (DATABASE_URL) {
  console.log('DATABASE_URL is set, so this project uses a hosted database. `npm run reset` only clears the local one.');
  console.log('Remove DATABASE_URL from server/.env first if you want to reset the local database.');
  process.exit(0);
}
fs.rmSync(DATA_DIR, { recursive: true, force: true });
console.log('Local database and uploads deleted. The next `npm run dev` creates a fresh database with the default staff accounts.');
