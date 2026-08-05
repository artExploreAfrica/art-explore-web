/**
 * Refresh Institution.hasExhibition for every institution.
 *
 * The flag is recomputed on every exhibition write, but its date half goes stale
 * on its own: an exhibition that simply ends produces no write, so a venue keeps
 * advertising an exhibition that finished. Run this on a schedule (daily, just
 * after midnight) to catch those.
 *
 * Usage:
 *   npx ts-node scripts/recompute-has-exhibition.ts --dry-run
 *   npx ts-node scripts/recompute-has-exhibition.ts
 *   npm run recompute:exhibitions
 *
 * Cron (server local time):
 *   5 0 * * *  cd /srv/art-explore && npm run recompute:exhibitions >> /var/log/art-explore-exhibitions.log 2>&1
 */
import 'dotenv/config';
import { ApprovalStatus, PrismaClient } from '@prisma/client';

const DRY_RUN = process.argv.includes('--dry-run');
const prisma = new PrismaClient();

/** Midnight today — an exhibition whose last day is today is still running. */
const startOfToday = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

async function main(): Promise<void> {
  console.log('Recompute Institution.hasExhibition');
  console.log(`Mode:   ${DRY_RUN ? 'DRY RUN (no DB writes)' : 'APPLY'}`);
  console.log('');

  const institutions = await prisma.institution.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, hasExhibition: true },
  });

  // One grouped count instead of a query per institution.
  const liveCounts = await prisma.exhibition.groupBy({
    by: ['institutionId'],
    where: {
      approvalStatus: ApprovalStatus.APPROVED,
      isActive: true,
      endDate: { gte: startOfToday() },
    },
    _count: { _all: true },
  });
  const withLive = new Set(liveCounts.map((row) => row.institutionId));

  const stale = institutions.filter((i) => i.hasExhibition !== withLive.has(i.id));

  for (const inst of stale) {
    const next = withLive.has(inst.id);
    console.log(`${DRY_RUN ? '~' : '✓'}  ${inst.name}: ${inst.hasExhibition} → ${next}`);
  }

  if (!DRY_RUN && stale.length > 0) {
    const turnOn = stale.filter((i) => withLive.has(i.id)).map((i) => i.id);
    const turnOff = stale.filter((i) => !withLive.has(i.id)).map((i) => i.id);

    await prisma.$transaction([
      prisma.institution.updateMany({
        where: { id: { in: turnOn } },
        data: { hasExhibition: true },
      }),
      prisma.institution.updateMany({
        where: { id: { in: turnOff } },
        data: { hasExhibition: false },
      }),
    ]);

    // hasExhibition is part of the public payload.
    const { invalidateInstitutionCache } = await import('../src/utils/institutionCache');
    await invalidateInstitutionCache();
    console.log('\nRedis institution cache invalidated.');
  }

  console.log('\n── Summary ──────────────────────────');
  console.log(`Institutions checked:  ${institutions.length}`);
  console.log(`With a live exhibition: ${withLive.size}`);
  console.log(`${DRY_RUN ? 'Would change' : 'Changed'}:          ${stale.length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
