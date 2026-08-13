/**
 * Predict exactly what `prisma db seed` would do — without doing it.
 *
 * Read-only. Runs the same name match `seedGalleries` uses
 * (`findFirst` on name, case-insensitive, `deletedAt: null`) for every CSV row
 * and reports which rows would UPDATE and which would CREATE.
 *
 * This exists because of a sharp edge: the seed deliberately ignores
 * soft-deleted rows, so a CSV name whose only match has been deleted does not
 * update it — it inserts a brand-new duplicate, published and approved. On a
 * database where an admin has curated deletions, a routine re-seed can quietly
 * resurrect everything they removed.
 *
 * Usage:
 *   npx ts-node scripts/predict-seed.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const prisma = new PrismaClient();

// Same candidate order as prisma/seed.ts.
const CSV_CANDIDATES = [
  'ArtandCulturalSpacesDB-latest-4.csv',
  'ArtandCulturalSpacesDB-latest.csv',
  'institutions-with-images.csv',
];

/** Identical to the parser in prisma/seed.ts — quoted fields, escaped quotes. */
function parseCsvRow(line: string): string[] {
  const result: string[] = [];
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
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

async function main(): Promise<void> {
  const csvPath = CSV_CANDIDATES.map((f) => resolve(process.cwd(), f)).find((p) => existsSync(p));
  if (!csvPath) throw new Error(`No CSV found (tried ${CSV_CANDIDATES.join(', ')})`);
  console.log(`CSV: ${csvPath}\n`);

  const lines = readFileSync(csvPath, 'utf-8')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => l.trim());
  const headers = parseCsvRow(lines[0]);
  const nameIdx = headers.indexOf('name');
  const subIdx = headers.indexOf('sub_area');

  const wouldUpdate: { name: string; sub: string }[] = [];
  const wouldCreate: { name: string; sub: string }[] = [];
  const deletedMatch: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvRow(lines[i]);
    const name = (values[nameIdx] ?? '').trim();
    const sub = (values[subIdx] ?? '').trim();
    if (!name) continue;

    // Exactly the query seedGalleries runs.
    const live = await prisma.institution.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, deletedAt: null },
      select: { id: true },
    });

    if (live) {
      wouldUpdate.push({ name, sub });
    } else {
      wouldCreate.push({ name, sub });
      // Is there a soft-deleted row with this name? Then the create is a
      // resurrection of something an admin deliberately removed.
      const gone = await prisma.institution.findFirst({
        where: { name: { equals: name, mode: 'insensitive' }, deletedAt: { not: null } },
        select: { id: true },
      });
      if (gone) deletedMatch.push(name);
    }
  }

  const total = await prisma.institution.count();
  const live = await prisma.institution.count({ where: { deletedAt: null } });

  console.log('='.repeat(64));
  console.log('PREDICTION — nothing was written');
  console.log('='.repeat(64));
  console.log(`  institutions now:        ${total} (${live} live, ${total - live} soft-deleted)`);
  console.log(`  CSV rows:                ${wouldUpdate.length + wouldCreate.length}`);
  console.log(`  would UPDATE:            ${wouldUpdate.length}`);
  console.log(`  would CREATE (new rows): ${wouldCreate.length}`);
  console.log(`  ...of which resurrect a SOFT-DELETED row: ${deletedMatch.length}`);
  console.log(`\n  institutions after seed: ${total + wouldCreate.length}`);

  if (deletedMatch.length > 0) {
    console.log('\n  ⚠️  These were deleted and would come back as new rows:');
    for (const n of deletedMatch) console.log(`      - ${n}`);
  }

  const otherCreates = wouldCreate.filter((c) => !deletedMatch.includes(c.name));
  if (otherCreates.length > 0) {
    console.log('\n  New rows with no prior record (genuinely new venues):');
    for (const c of otherCreates.slice(0, 25)) console.log(`      - ${c.name}`);
    if (otherCreates.length > 25) console.log(`      ... and ${otherCreates.length - 25} more`);
  }

  const subCount = [...wouldUpdate, ...wouldCreate].filter((r) => r.sub).length;
  console.log(`\n  rows that would end up with a subArea: ${subCount}`);
  console.log('='.repeat(64));
}

main()
  .catch((err) => {
    console.error('Prediction failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });