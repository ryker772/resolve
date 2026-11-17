// Local server: `npm run dev` / `npm start`. (On Vercel, api/index.js uses app.js directly.)
const [major] = process.versions.node.split('.').map(Number);
if (major < 20) {
  console.error(`\nResolve needs Node.js 20 or newer (you have ${process.versions.node}).`);
  console.error('Install the current LTS from https://nodejs.org and try again.\n');
  process.exit(1);
}

const { default: app } = await import('./app.js');
const { PORT, DATABASE_URL } = await import('./config.js');
const { dbReady, dbKind } = await import('./db.js');

try {
  await dbReady();
} catch (err) {
  console.error('\nCould not connect to the database:', err.message, '\n');
  process.exit(1);
}

app.listen(PORT, () => {
  const where = DATABASE_URL ? 'Postgres (DATABASE_URL)' : 'local database in server/data/pglite';
  console.log(`Resolve API running on http://localhost:${PORT} · ${dbKind() === 'postgres' ? where : where}`);
});
