/**
 * Copy institution image URLs from the live site → local Institution.images[].
 *
 * For every local institution with no images, find the same venue on the live
 * public API (matched by name) and copy its image URLs. Only the URLs are
 * copied: the files already live in the public S3 bucket, so no AWS
 * credentials are needed. Use this when the S3 sync can't run locally, or to
 * pick up admin uploads (stored under institutions/{id}/…, which the S3 sync's
 * folder-name matcher never sees).
 *
 * Never touches a row that already has images, and never writes to the live
 * site or to S3.
 *
 * Usage:
 *   npm run sync:images:live:dry   # show what would change
 *   npm run sync:images:live       # write to the local database
 *
 * Env (optional):
 *   LIVE_API_URL   (default: https://api.artexplore.africa)
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const DRY_RUN = process.argv.includes('--dry-run');
const LIVE_API_URL = (process.env.LIVE_API_URL || 'https://api.artexplore.africa').replace(/\/+$/, '');
const PAGE_SIZE = 100; // API maximum per page

/** Only URLs from the media bucket are accepted; anything else is skipped. */
const ALLOWED_IMAGE_PREFIX = 'https://art-explore-db-images.s3.eu-north-1.amazonaws.com/';

/**
 * Local catalogue name → live site name, where the two differ and the
 * normalised match below can't bridge them.
 */
const NAME_ALIASES: Record<string, string> = {
  'John Randle Centre': 'J. Randle Centre',
};

interface LiveInstitution {
  id: string;
  name: string;
  images?: string[] | null;
}

const prisma = new PrismaClient();

/** Fold accents, lowercase, keep a-z0-9 only: "MÌLÍKÍ (X)" → "milikix". */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Same as normalize, with any parenthetical dropped: "+234 Art Fair (Plus234)" → "234artfair". */
function normalizeWithoutParens(value: string): string {
  return normalize(value.replace(/\([^)]*\)/g, ''));
}

async function fetchLiveInstitutions(): Promise<LiveInstitution[]> {
  const all: LiveInstitution[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const url = `${LIVE_API_URL}/api/v1/institutions?limit=${PAGE_SIZE}&page=${page}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      throw new Error(`Live API returned ${res.status} for ${url}`);
    }
    const body = (await res.json()) as {
      data?: LiveInstitution[];
      pagination?: { totalPages?: number };
    };
    all.push(...(body.data ?? []));
    totalPages = body.pagination?.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages);

  return all;
}

function buildIndex(live: LiveInstitution[]): {
  byExact: Map<string, LiveInstitution>;
  byNormalized: Map<string, LiveInstitution>;
  byNoParens: Map<string, LiveInstitution>;
} {
  const byExact = new Map<string, LiveInstitution>();
  const byNormalized = new Map<string, LiveInstitution>();
  const byNoParens = new Map<string, LiveInstitution>();

  for (const inst of live) {
    byExact.set(inst.name.toLowerCase(), inst);
    byNormalized.set(normalize(inst.name), inst);
    byNoParens.set(normalizeWithoutParens(inst.name), inst);
  }
  return { byExact, byNormalized, byNoParens };
}

function findLiveMatch(
  localName: string,
  index: ReturnType<typeof buildIndex>,
): { match: LiveInstitution; via: string } | null {
  const alias = NAME_ALIASES[localName];
  if (alias) {
    const hit = index.byExact.get(alias.toLowerCase());
    if (hit) return { match: hit, via: 'alias' };
  }

  const exact = index.byExact.get(localName.toLowerCase());
  if (exact) return { match: exact, via: 'exact' };

  const normalized = index.byNormalized.get(normalize(localName));
  if (normalized) return { match: normalized, via: 'normalised' };

  const noParens = index.byNoParens.get(normalizeWithoutParens(localName));
  if (noParens) return { match: noParens, via: 'without brackets' };

  return null;
}

async function main(): Promise<void> {
  console.log(`Live API: ${LIVE_API_URL}`);
  console.log(`Mode:     ${DRY_RUN ? 'DRY RUN (no DB writes)' : 'APPLY'}`);
  console.log('');

  // Raw SQL because seeded rows store `images` as NULL, which Prisma's
  // `isEmpty` filter does not match; coalesce treats NULL and {} alike.
  const [live, missing] = await Promise.all([
    fetchLiveInstitutions(),
    prisma.$queryRaw<{ id: string; name: string; type: string }[]>`
      SELECT id, name, type::text AS type
      FROM "Institution"
      WHERE "deletedAt" IS NULL AND coalesce(array_length(images, 1), 0) = 0
      ORDER BY type, name`,
  ]);
  const index = buildIndex(live);

  console.log(`Live institutions:         ${live.length}`);
  console.log(`Local without any images:  ${missing.length}`);
  console.log('');

  let updated = 0;
  const noMatch: string[] = [];
  const noImagesLive: string[] = [];

  for (const inst of missing) {
    const found = findLiveMatch(inst.name, index);
    if (!found) {
      noMatch.push(`${inst.name} [${inst.type}]`);
      console.log(`✗  ${inst.name} [${inst.type}] — not on the live site`);
      continue;
    }

    const all = found.match.images ?? [];
    const urls = all.filter((u) => u.startsWith(ALLOWED_IMAGE_PREFIX));
    const rejected = all.length - urls.length;

    if (urls.length === 0) {
      noImagesLive.push(`${inst.name} [${inst.type}]`);
      console.log(
        `–  ${inst.name} [${inst.type}] — on the live site as "${found.match.name}" but it has no usable images` +
          (rejected ? ` (${rejected} skipped: not from the media bucket)` : ''),
      );
      continue;
    }

    const renamed = found.match.name !== inst.name ? ` as "${found.match.name}"` : '';
    console.log(
      `${DRY_RUN ? '~' : '✓'}  ${inst.name} [${inst.type}] ← live${renamed} (${found.via}, +${urls.length} image(s))` +
        (rejected ? ` — ${rejected} skipped: not from the media bucket` : ''),
    );
    for (const u of urls) console.log(`     ${u}`);

    if (!DRY_RUN) {
      // Re-check emptiness at write time so a concurrent admin upload is never overwritten.
      const count = await prisma.$executeRaw`
        UPDATE "Institution"
        SET images = ${urls}::text[], "updatedAt" = now()
        WHERE id = ${inst.id} AND coalesce(array_length(images, 1), 0) = 0`;
      if (count === 1) updated += 1;
    } else {
      updated += 1; // would update
    }
  }

  if (!DRY_RUN && updated > 0) {
    try {
      const { invalidateInstitutionCache } = await import('../src/utils/institutionCache');
      await invalidateInstitutionCache();
      console.log('\nRedis institution cache invalidated.');
    } catch (err) {
      console.warn(
        '\nCould not invalidate Redis cache (TTL is 60s):',
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log('\n── Summary ──────────────────────────');
  console.log(`Local without images:      ${missing.length}`);
  console.log(`${DRY_RUN ? 'Would update' : 'Updated'}:              ${updated}`);
  console.log(`Not on the live site:      ${noMatch.length}`);
  if (noMatch.length) console.log(`  → ${noMatch.join(', ')}`);
  console.log(`On live but no images:     ${noImagesLive.length}`);
  if (noImagesLive.length) console.log(`  → ${noImagesLive.join(', ')}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
