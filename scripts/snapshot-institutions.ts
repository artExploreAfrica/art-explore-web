/**
 * Read-only snapshot of the Institution table, and a diff between two snapshots.
 *
 * Written for the sub-area seed run. `prisma db seed` overwrites `isPublished`,
 * `approvalStatus`, `lat`, `lng`, `name`, `type`, `address` and `area`
 * unconditionally on every matched row — that is pre-existing behaviour, not
 * something the sub-area change introduced, but it has teeth on a database that
 * now has curated data in it. Take a snapshot before, take one after, diff them,
 * and you can see exactly what moved instead of hoping.
 *
 * This script NEVER writes to the database. Only `findMany`.
 *
 * Usage:
 *   npx ts-node scripts/snapshot-institutions.ts
 *       → writes backups/institutions-<timestamp>.json and prints a summary
 *
 *   npx ts-node scripts/snapshot-institutions.ts --compare backups/institutions-<before>.json
 *       → snapshots again, then reports every field that changed between the two
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

const prisma = new PrismaClient();

const BACKUP_DIR = resolve(process.cwd(), 'backups');

/** The fields the seed can overwrite, plus the ones we are trying to populate. */
const SELECT = {
  id: true,
  name: true,
  type: true,
  address: true,
  area: true,
  subArea: true,
  lat: true,
  lng: true,
  isPublished: true,
  approvalStatus: true,
  deletedAt: true,
} as const;

type Row = {
  id: string;
  name: string;
  type: string;
  address: string;
  area: string;
  subArea: string | null;
  lat: number;
  lng: number;
  isPublished: boolean;
  approvalStatus: string;
  deletedAt: Date | string | null;
};

const TRACKED: (keyof Row)[] = [
  'name',
  'type',
  'address',
  'area',
  'subArea',
  'lat',
  'lng',
  'isPublished',
  'approvalStatus',
];

async function snapshot(): Promise<Row[]> {
  // findMany only — no writes anywhere in this file.
  const rows = (await prisma.institution.findMany({
    select: SELECT,
    orderBy: { name: 'asc' },
  })) as unknown as Row[];
  return rows;
}

function summarise(rows: Row[], label: string): void {
  const withSub = rows.filter((r) => r.subArea != null && String(r.subArea).trim() !== '');
  const dist = new Map<string, number>();
  for (const r of withSub) {
    const key = String(r.subArea);
    dist.set(key, (dist.get(key) ?? 0) + 1);
  }

  console.log(`\n── ${label} ──`);
  console.log(`  institutions (incl. soft-deleted): ${rows.length}`);
  console.log(`  published:                         ${rows.filter((r) => r.isPublished).length}`);
  console.log(
    `  approvalStatus=APPROVED:           ${rows.filter((r) => r.approvalStatus === 'APPROVED').length}`,
  );
  console.log(`  soft-deleted:                      ${rows.filter((r) => r.deletedAt).length}`);
  console.log(`  subArea populated:                 ${withSub.length}`);

  if (dist.size > 0) {
    console.log('  subArea distribution:');
    for (const [k, v] of [...dist.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${String(v).padStart(3)}  "${k}"`);
    }
  }
}

function compare(before: Row[], after: Row[]): void {
  const beforeById = new Map(before.map((r) => [r.id, r]));
  const changes: Record<string, number> = {};
  const details: string[] = [];

  for (const a of after) {
    const b = beforeById.get(a.id);
    if (!b) {
      details.push(`  + NEW ROW  ${a.name}`);
      changes['(new rows)'] = (changes['(new rows)'] ?? 0) + 1;
      continue;
    }
    for (const f of TRACKED) {
      const bv = b[f];
      const av = a[f];
      if (String(bv) !== String(av)) {
        changes[f] = (changes[f] ?? 0) + 1;
        if (details.length < 40) {
          details.push(
            `  ~ ${a.name.padEnd(36)} ${String(f).padEnd(14)} ${JSON.stringify(bv)} → ${JSON.stringify(av)}`,
          );
        }
      }
    }
  }

  const missing = before.filter((b) => !after.some((a) => a.id === b.id));
  for (const m of missing) details.push(`  - ROW GONE  ${m.name}`);

  console.log('\n══ CHANGES ══');
  if (Object.keys(changes).length === 0 && missing.length === 0) {
    console.log('  none — the two snapshots are identical.');
    return;
  }
  for (const [field, count] of Object.entries(changes).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(4)} row(s)  ${field}`);
  }
  console.log('\n  sample:');
  for (const d of details) console.log(d);
  if (missing.length > 0)
    console.log(`\n  ${missing.length} row(s) present before and absent after.`);
}

async function main(): Promise<void> {
  const compareIdx = process.argv.indexOf('--compare');
  const comparePath = compareIdx >= 0 ? process.argv[compareIdx + 1] : undefined;

  const rows = await snapshot();

  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join(BACKUP_DIR, `institutions-${stamp}.json`);
  writeFileSync(file, JSON.stringify(rows, null, 2), 'utf-8');

  console.log(`Snapshot written: ${file}`);
  summarise(rows, comparePath ? 'AFTER' : 'CURRENT');

  if (comparePath) {
    const before = JSON.parse(readFileSync(resolve(process.cwd(), comparePath), 'utf-8')) as Row[];
    summarise(before, 'BEFORE');
    compare(before, rows);
  }
}

main()
  .catch((err) => {
    console.error('Snapshot failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });