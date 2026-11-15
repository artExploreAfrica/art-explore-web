import { applyTags } from '../../scripts/tags-2026-11';
import { DataMigration } from './runner';

/**
 * Every data migration, in the order they must run. Append only: a name that
 * has shipped is recorded in production's ledger, so renaming or removing it
 * would make it run again (or orphan the record).
 */
export const DATA_MIGRATIONS: readonly DataMigration[] = [
  {
    // The nine-tag vocabulary and its first round of assignments. Applied by
    // hand on local databases in November 2026; never applied to production,
    // which is why the home page's tags section was empty there.
    name: '2026-11-tags',
    run: async (tx) => {
      const { changes, missing } = await applyTags(tx);
      return {
        changes,
        warnings: missing.map((m) => `space not found, skipped — ${m}`),
      };
    },
  },
];
