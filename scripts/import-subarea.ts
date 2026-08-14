/**
 * Import `sub_area` from the source sheet into `Institution.subArea`.
 *
 * Why this exists instead of `prisma db seed`:
 * the seed matches on `deletedAt: null`, so a CSV name whose only match has been
 * soft-deleted does not update it — it INSERTS a duplicate. Against the current
 * database that means 19 new rows, 17 of them resurrections of institutions an
 * admin deliberately removed. The seed also overwrites `isPublished`,
 * `approvalStatus`, `lat` and `lng` unconditionally.
 *
 * This script does exactly one thing. There is no `create`, no `delete`, and no
 * field other than `subArea` in any `data` object — so the row count cannot
 * change and nothing curated in the admin UI can be clobbered.
 *
 * Usage:
 *   npx ts-node scripts/import-subarea.ts               # dry run (default)
 *   npx ts-node scripts/import-subarea.ts --apply       # write
 *   npx ts-node scripts/import-subarea.ts --apply --overwrite
 *
 * Default is conservative: a row that already has a subArea is left alone, so a
 * value typed in the admin panel wins over the sheet. `--overwrite` flips that.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const OVERWRITE = process.argv.includes('--overwrite');

const CSV_CANDIDATES = ['ArtandCulturalSpacesDB-latest-4.csv', 'ArtandCulturalSpacesDB-latest.csv'];

/** Identical to the parser in prisma/seed.ts — quoted fields, escaped quotes. */
function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

async function main(): Promise<void> {
  const csvPath = CSV_CANDIDATES.map((f) => resolve(process.cwd(), f)).find((p) => existsSync(p));
  if (!csvPath) throw new Error(`No CSV found (tried ${CSV_CANDIDATES.join(', ')})`);

  console.log(`CSV:  ${csvPath}`);
  console.log(
    `Mode: ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}${OVERWRITE ? ' --overwrite' : ''}\n`,
  );

  const lines = readFileSync(csvPath, 'utf-8')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => l.trim());
  const headers = parseCsvRow(lines[0]);
  const nameIdx = headers.indexOf('name');
  const subIdx = headers.indexOf('sub_area');
  if (nameIdx < 0 || subIdx < 0) throw new Error('CSV is missing a `name` or `sub_area` column');

  // One query instead of 103 round-trips: pull every live row up front and
  // match in memory, case-insensitively, the same way the seed's query does.
  const live = await prisma.institution.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, subArea: true },
  });
  const byName = new Map(live.map((r) => [r.name.trim().toLowerCase(), r]));

  let written = 0;
  let unchanged = 0;
  let keptExisting = 0;
  let blank = 0;
  const unmatched: string[] = [];
  const overwrites: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvRow(lines[i]);
    const name = (values[nameIdx] ?? '').trim();
    const sub = (values[subIdx] ?? '').trim();
    if (!name) continue;

    if (!sub) {
      blank++;
      continue;
    }

    const row = byName.get(name.toLowerCase());
    if (!row) {
      // Not created — that is the entire point of this script.
      unmatched.push(name);
      continue;
    }

    if (row.subArea === sub) {
      unchanged++;
      continue;
    }

    if (row.subArea && !OVERWRITE) {
      keptExisting++;
      overwrites.push(`${name}: kept "${row.subArea}" (sheet says "${sub}")`);
      continue;
    }

    if (row.subArea) overwrites.push(`${name}: "${row.subArea}" -> "${sub}"`);

    if (APPLY) {
      // The only write in this file. One field.
      await prisma.institution.update({ where: { id: row.id }, data: { subArea: sub } });
    }
    written++;
  }

  console.log('='.repeat(64));
  console.log(APPLY ? 'APPLIED' : 'WOULD APPLY');
  console.log('='.repeat(64));
  console.log(`  live institutions:              ${live.length}`);
  console.log(`  ${APPLY ? 'rows written' : 'rows that would be written'}:      ${written}`);
  console.log(`  already correct (no change):    ${unchanged}`);
  console.log(
    `  already set, kept as-is:        ${keptExisting}${OVERWRITE ? '' : '   (use --overwrite to replace)'}`,
  );
  console.log(`  blank in sheet, skipped:        ${blank}`);
  console.log(`  no live match, SKIPPED not created: ${unmatched.length}`);

  if (overwrites.length > 0) {
    console.log('\n  rows that already had a value:');
    for (const o of overwrites) console.log(`    ${o}`);
  }
  if (unmatched.length > 0) {
    console.log('\n  skipped (soft-deleted or name mismatch):');
    for (const n of unmatched) console.log(`    - ${n}`);
  }

  if (!APPLY) console.log('\n  Nothing was written. Re-run with --apply to commit.');
  console.log('='.repeat(64));
}

main()
  .catch((err) => {
    console.error('Import failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });