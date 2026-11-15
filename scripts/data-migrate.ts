/**
 * Apply pending run-once data migrations (src/dataMigrations).
 *
 * Runs on every deploy right after `prisma migrate deploy` (see
 * .github/workflows/cd.yml); a migration already recorded in the
 * `DataMigration` table is skipped, so each runs once per database.
 *
 * Usage:
 *   npm run data:migrate:dry   # show what would change, write nothing
 *   npm run data:migrate       # apply and record
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { DATA_MIGRATIONS } from '../src/dataMigrations';
import { runPendingDataMigrations } from '../src/dataMigrations/runner';

const apply = !process.argv.includes('--dry-run');

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    console.log(`Data migrations — ${apply ? 'APPLY' : 'DRY RUN (no writes)'}`);
    const { applied, skipped } = await runPendingDataMigrations(prisma, DATA_MIGRATIONS, {
      apply,
    });
    console.log(
      `\n${applied.length} ${apply ? 'applied' : 'pending'}, ${skipped.length} already done` +
        (skipped.length ? ` (${skipped.join(', ')})` : ''),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('\n✖ Data migration failed — nothing from the failing migration was written.');
  console.error(err);
  process.exitCode = 1;
});
