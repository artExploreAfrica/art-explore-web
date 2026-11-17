/**
 * Runs before `npm run dev` (the "predev" script).
 *
 * Why this exists: on Windows, a running API server keeps Prisma's engine file
 * (node_modules/.prisma/client/query_engine-windows.dll.node) open, and
 * `prisma generate` can't replace an open file — it fails with
 *   EPERM: operation not permitted, rename '...dll.node.tmpNNNN' -> '...dll.node'
 * The old predev ran `prisma generate` on every start, before kill-port had a
 * chance to stop the old server, so any leftover server (another terminal, a
 * closed VS Code terminal that didn't stop its process) broke `npm run dev`.
 *
 * What it does now:
 *  1. Skips generating when nothing changed — the schema and the Prisma
 *     version are the same as at the last successful generate. That's most
 *     starts, and then the engine file is never touched.
 *  2. When something did change, stops whatever is on the API port first,
 *     then generates.
 *  3. Cleans up the .tmp files that failed attempts leave behind.
 *  4. If the file is still locked, says so in plain words.
 *
 * Plain Node (no TypeScript) so it runs before anything is compiled.
 */
const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const schemaFile = path.join(root, 'prisma', 'schema.prisma');
const clientDir = path.join(root, 'node_modules', '.prisma', 'client');
const stampFile = path.join(clientDir, '.generate-stamp');
const API_PORT = 4555;

function prismaVersion() {
  try {
    return require(path.join(root, 'node_modules', '@prisma', 'client', 'package.json')).version;
  } catch {
    return 'unknown';
  }
}

function currentStamp() {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(schemaFile));
  hash.update(prismaVersion());
  return hash.digest('hex');
}

function removeLeftoverTmpFiles() {
  if (!fs.existsSync(clientDir)) return;
  for (const name of fs.readdirSync(clientDir)) {
    if (/\.node\.tmp\d+$/.test(name)) {
      try {
        fs.unlinkSync(path.join(clientDir, name));
      } catch {
        // Still held by some process; harmless, try again next time.
      }
    }
  }
}

const stamp = currentStamp();
const generated = fs.existsSync(path.join(clientDir, 'index.js'));
const upToDate =
  generated && fs.existsSync(stampFile) && fs.readFileSync(stampFile, 'utf8').trim() === stamp;

removeLeftoverTmpFiles();

if (upToDate) {
  console.log('[prisma] Schema unchanged since the last generate — skipping.');
  process.exit(0);
}

// Stop an old API server first: it is what holds the engine file open.
try {
  execSync(`npx kill-port ${API_PORT}`, { cwd: root, stdio: 'ignore' });
} catch {
  // Nothing was listening — fine.
}

try {
  execSync('npx prisma generate', { cwd: root, stdio: 'inherit' });
  fs.writeFileSync(stampFile, stamp);
  removeLeftoverTmpFiles();
} catch {
  console.error(
    [
      '',
      '[prisma] Could not update the Prisma files — another program still has them open.',
      '         Usually that is an API server still running somewhere else:',
      '           • another terminal running `npm run dev` / `npm run dev:all` (press Ctrl+C there)',
      '           • a VS Code terminal that was closed without stopping it',
      '           • `npx prisma studio` or `npm run test:watch`',
      '         Stop it, then run `npm run dev` again.',
      '         Last resort (stops ALL Node programs on this computer):  taskkill /F /IM node.exe',
      '',
    ].join('\n'),
  );
  process.exit(1);
}
