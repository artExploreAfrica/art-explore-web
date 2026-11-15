import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Run-once data migrations.
 *
 * `prisma migrate deploy` changes the database *structure* on every deploy, but
 * data fixes (new tag lists, merged duplicates, back-filled fields) used to be
 * scripts someone had to remember to run on the server — which is how the live
 * site ended up with the new tags section deployed and no tags behind it.
 *
 * A data migration here runs automatically on deploy, exactly once per
 * database: the `DataMigration` table records each one that has been applied.
 * Once only matters — these scripts set up data the admin then owns, so
 * re-running one would quietly undo the team's edits.
 *
 * Each migration runs in its own transaction together with its ledger row, so
 * it is applied and recorded together or not at all. A failure stops the run
 * (later migrations may depend on earlier ones) and fails the deploy.
 */

export type Tx = Prisma.TransactionClient;

export interface DataMigrationResult {
  /** One line per change made, for the deploy log. */
  changes: string[];
  /** Anything worth a human look that did not stop the migration. */
  warnings?: string[];
}

export interface DataMigration {
  /** Unique and permanent — it is the ledger key. Never rename one that has shipped. */
  name: string;
  run: (tx: Tx) => Promise<DataMigrationResult>;
}

export interface RunOptions {
  /** false = dry run: every migration executes and is then rolled back. */
  apply: boolean;
  log?: (line: string) => void;
  /** Per-migration transaction timeout. */
  timeoutMs?: number;
}

export interface RunSummary {
  applied: string[];
  skipped: string[];
}

/** Thrown inside a dry run's transaction so it rolls back. */
class DryRunRollback extends Error {}

export const runPendingDataMigrations = async (
  prisma: PrismaClient,
  migrations: readonly DataMigration[],
  { apply, log = console.log, timeoutMs = 120_000 }: RunOptions,
): Promise<RunSummary> => {
  const names = migrations.map((m) => m.name);
  const duplicate = names.find((n, i) => names.indexOf(n) !== i);
  if (duplicate) throw new Error(`Duplicate data migration name: ${duplicate}`);

  const done = new Set(
    (await prisma.dataMigration.findMany({ select: { name: true } })).map((r) => r.name),
  );

  const summary: RunSummary = { applied: [], skipped: [] };

  for (const migration of migrations) {
    if (done.has(migration.name)) {
      summary.skipped.push(migration.name);
      continue;
    }

    log(`\n▶ ${migration.name} ${apply ? '' : '(dry run)'}`.trimEnd());
    let result: DataMigrationResult = { changes: [] };
    try {
      await prisma.$transaction(
        async (tx) => {
          result = await migration.run(tx);
          if (!apply) throw new DryRunRollback();
          // The primary key on `name` also stops two overlapping deploys from
          // both applying the same migration: the second insert fails and its
          // transaction rolls back.
          await tx.dataMigration.create({ data: { name: migration.name } });
        },
        { timeout: timeoutMs },
      );
    } catch (err) {
      if (!(err instanceof DryRunRollback)) throw err;
    }

    for (const line of result.changes) log(`  ${line}`);
    for (const line of result.warnings ?? []) log(`  ⚠ ${line}`);
    log(`  ${result.changes.length} change(s) ${apply ? 'applied' : 'would be applied'}`);
    summary.applied.push(migration.name);
  }

  return summary;
};
