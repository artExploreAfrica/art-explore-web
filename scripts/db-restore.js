#!/usr/bin/env node
/**
 * Load a database dump into the local Docker Postgres (art-explore-db).
 *
 *   npm run db:restore                      # uses backups/art-explore-demo.dump
 *   npm run db:restore -- path/to/file.dump # or any other dump
 *
 * Runs pg_restore *inside* the container, so Postgres tools are not needed on
 * the host. Works the same on Mac, Windows and Linux. The target database must
 * be empty (a fresh `docker compose up -d`); it refuses to touch one that
 * already has data.
 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONTAINER = 'art-explore-db';
const DB_USER = 'artexplore';
const DB_NAME = process.env.RESTORE_DB_NAME || 'artexplore'; // override only for testing

const file = path.resolve(process.argv[2] || path.join('backups', 'art-explore-demo.dump'));

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

if (!fs.existsSync(file)) {
  fail(`Dump file not found: ${file}\n  Put art-explore-demo.dump in the backups/ folder (or pass its path).`);
}

const running = spawnSync('docker', ['ps', '--filter', `name=^${CONTAINER}$`, '--format', '{{.Names}}'], {
  encoding: 'utf8',
});
if (running.error || running.status !== 0) {
  fail('Could not talk to Docker. Is Docker Desktop open?');
}
if (!running.stdout.includes(CONTAINER)) {
  fail(`The ${CONTAINER} container is not running. Start it with: docker compose up -d`);
}

const hasTables = spawnSync(
  'docker',
  ['exec', CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME, '-Atc', "select count(*) from information_schema.tables where table_schema='public'"],
  { encoding: 'utf8' },
);
if (hasTables.status !== 0) {
  fail(`Could not query the database yet. Wait a few seconds and retry.\n${hasTables.stderr}`);
}
if (Number(hasTables.stdout.trim()) > 0) {
  fail(
    'The database already has tables, so nothing was changed.\n' +
      '  To start over (this deletes local data): docker compose down -v && docker compose up -d',
  );
}

console.log(`Restoring ${path.basename(file)} into ${CONTAINER}…`);
const restore = spawn('docker', ['exec', '-i', CONTAINER, 'pg_restore', '-U', DB_USER, '-d', DB_NAME, '--no-owner'], {
  stdio: ['pipe', 'inherit', 'inherit'],
});
fs.createReadStream(file).pipe(restore.stdin);
restore.on('close', (code) => {
  if (code !== 0) fail(`pg_restore failed (exit ${code}). See the messages above.`);
  console.log('✔ Done. Start the app with: npm run dev');
});
