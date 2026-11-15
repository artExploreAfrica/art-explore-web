import { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { DATA_MIGRATIONS } from '../src/dataMigrations';
import { DataMigration, runPendingDataMigrations } from '../src/dataMigrations/runner';

/**
 * A fake client with real transaction semantics for the one table the runner
 * writes: ledger rows created inside a transaction only land if the callback
 * resolves, exactly like a Postgres rollback.
 */
const fakePrisma = (alreadyApplied: string[] = []) => {
  const ledger = new Set(alreadyApplied);
  const client = {
    dataMigration: {
      findMany: vi.fn(async () => [...ledger].map((name) => ({ name }))),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
      const pending: string[] = [];
      const tx = {
        dataMigration: {
          create: vi.fn(async ({ data }: { data: { name: string } }) => {
            if (ledger.has(data.name) || pending.includes(data.name)) {
              throw new Error('Unique constraint failed on name');
            }
            pending.push(data.name);
          }),
        },
      };
      await fn(tx); // throws → nothing in `pending` is committed
      pending.forEach((n) => ledger.add(n));
    }),
  };
  return { prisma: client as unknown as PrismaClient, ledger };
};

const migration = (name: string, run = vi.fn(async () => ({ changes: [`did ${name}`] }))) => ({
  name,
  run,
});

const quiet = { log: () => {} };

describe('runPendingDataMigrations', () => {
  it('runs each pending migration once and records it', async () => {
    const { prisma, ledger } = fakePrisma();
    const a = migration('a');
    const b = migration('b');

    const summary = await runPendingDataMigrations(prisma, [a, b], { apply: true, ...quiet });

    expect(summary).toEqual({ applied: ['a', 'b'], skipped: [] });
    expect(a.run).toHaveBeenCalledTimes(1);
    expect(b.run).toHaveBeenCalledTimes(1);
    expect([...ledger]).toEqual(['a', 'b']);
  });

  it('skips migrations already in the ledger — the next deploy is a no-op', async () => {
    const { prisma } = fakePrisma(['a']);
    const a = migration('a');
    const b = migration('b');

    const summary = await runPendingDataMigrations(prisma, [a, b], { apply: true, ...quiet });

    expect(summary).toEqual({ applied: ['b'], skipped: ['a'] });
    expect(a.run).not.toHaveBeenCalled();
    expect(b.run).toHaveBeenCalledTimes(1);
  });

  it('a dry run executes migrations but records nothing', async () => {
    const { prisma, ledger } = fakePrisma();
    const a = migration('a');

    const summary = await runPendingDataMigrations(prisma, [a], { apply: false, ...quiet });

    expect(a.run).toHaveBeenCalledTimes(1);
    expect(summary.applied).toEqual(['a']);
    expect(ledger.size).toBe(0);
  });

  it('a failing migration is not recorded, stops later ones, and rethrows', async () => {
    const { prisma, ledger } = fakePrisma();
    const broken = migration(
      'broken',
      vi.fn(async () => {
        throw new Error('boom');
      }),
    );
    const later = migration('later');

    await expect(
      runPendingDataMigrations(prisma, [broken, later], { apply: true, ...quiet }),
    ).rejects.toThrow('boom');
    expect(later.run).not.toHaveBeenCalled();
    expect(ledger.size).toBe(0);
  });

  it('refuses a list with a duplicate name before touching the database', async () => {
    const { prisma } = fakePrisma();
    const dup: DataMigration[] = [migration('x'), migration('x')];

    await expect(runPendingDataMigrations(prisma, dup, { apply: true, ...quiet })).rejects.toThrow(
      'Duplicate data migration name: x',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('logs changes and warnings for the deploy log', async () => {
    const { prisma } = fakePrisma();
    const lines: string[] = [];
    const m = migration(
      'm',
      vi.fn(async () => ({ changes: ['tag + X'], warnings: ['space not found'] })),
    );

    await runPendingDataMigrations(prisma, [m], { apply: true, log: (l) => lines.push(l) });

    expect(lines.join('\n')).toContain('tag + X');
    expect(lines.join('\n')).toContain('⚠ space not found');
  });
});

describe('DATA_MIGRATIONS registry', () => {
  it('has unique names and includes the November 2026 tags fix', () => {
    const names = DATA_MIGRATIONS.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain('2026-11-tags');
  });
});
