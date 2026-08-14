/**
 * Sync institution images from S3 → Institution.images[] in Postgres.
 *
 * Lists objects under institutions/{slug}/… in the media bucket, matches each
 * slug to an Institution row by name, and writes public S3 URLs into `images`.
 *
 * Usage:
 *   npx ts-node scripts/sync-s3-images-to-db.ts --dry-run
 *   npx ts-node scripts/sync-s3-images-to-db.ts
 *
 * Env (optional overrides — defaults match the populated media bucket):
 *   AWS_S3_BUCKET_NAME / SYNC_S3_BUCKET  (default: art-explore-db-images)
 *   AWS_REGION / SYNC_S3_REGION          (default: eu-north-1)
 */
import 'dotenv/config';
import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;
const DRY_RUN = process.argv.includes('--dry-run');

const BUCKET =
  process.env.SYNC_S3_BUCKET || process.env.AWS_S3_BUCKET_NAME || 'art-explore-db-images';
const REGION = process.env.SYNC_S3_REGION || process.env.AWS_REGION || 'eu-north-1';

/**
 * Known S3 folder slug → DB institution name (when auto-slug fails).
 *
 * Auto-slugging strips punctuation, so a folder cannot match a name carrying a
 * parenthetical, an ampersand, or a shortened form. Each entry below was
 * confirmed against the seeded catalogue — without them these venues keep the
 * pictures that already exist in the bucket but show a placeholder in the app.
 */
const SLUG_ALIASES: Record<string, string> = {
  "od'a-gallery": "O'DA",
  'society-for-art-collection(sartcol)': 'Society for Art Collection (SARTCOL)',
  'bloom-gallery': 'Bloom Art',
  // Names carrying a parenthetical or a "+" the slugger drops.
  '+234-art-fair': '+234 Art Fair (Plus234 Art Fair)',
  'centre-for-contemporary-art': 'Centre for Contemporary Art (CCA)',
  'guest-art-space': 'Guest Artists Space Foundation (GAS)',
  // Folder omits a word the catalogue name carries.
  'biodun-omolayo': 'Biodun Omolayo Gallery',
  bogobiri: 'Bogobiri House',
  mydrim: 'Mydrim Gallery',
  // "Institute" in the folder vs the German "Institut" in the catalogue.
  'goethe-institute-lagos': 'Goethe Institut Lagos',
  // Transposed letters in the folder name (henriWOmeta / henriMOweta) — same venue.
  henriwometa: 'Henrimoweta African Art Center',
   // Folder uses the venue's full name, the catalogue uses the short form —
 // John Randle Centre for Yoruba Culture and History.
 'john-randle-centre': 'Randle Center',
};

const prisma = new PrismaClient();

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

function toSlug(name: string): string {
  // Accents folded first for the same reason as normalizeKey — otherwise an
  // accented letter is deleted rather than reduced to its base form.
  return foldAccents(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/** Collapse to a-z0-9 only for fuzzy compare. */
/**
 * Fold accents to their base letters before matching — NFD splits "ì" into
 * "i" + a combining mark, which the diacritic range then strips.
 *
 * Without this, stripping non-[a-z0-9] deletes the accented letter outright:
 * "MÌLÍKÍ" collapsed to "mlk" and could never meet the bucket's "miliki"
 * folder. Folding first means accented venue names match on their own, rather
 * than each one needing a hand-written alias.
 */
function foldAccents(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalizeKey(value: string): string {
  return foldAccents(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function publicUrl(key: string): string {
  const encoded = key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${encoded}`;
}

async function listInstitutionKeys(): Promise<Map<string, string[]>> {
  const bySlug = new Map<string, string[]>();
  let token: string | undefined;

  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: 'institutions/',
        ContinuationToken: token,
        MaxKeys: 1000,
      }),
    );

    for (const obj of res.Contents ?? []) {
      const key = obj.Key;
      if (!key || !IMAGE_EXT.test(key)) continue;

      // institutions/{slug}/file… — ignore nested junk like institutions/a/b/c
      const parts = key.split('/');
      if (parts.length !== 3 || parts[0] !== 'institutions' || !parts[1] || !parts[2]) {
        continue;
      }

      const slug = parts[1];
      const list = bySlug.get(slug) ?? [];
      list.push(key);
      bySlug.set(slug, list);
    }

    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);

  for (const keys of bySlug.values()) {
    keys.sort();
  }
  return bySlug;
}

function buildNameIndex(institutions: { id: string; name: string; images: string[] }[]): {
  byExactSlug: Map<string, (typeof institutions)[0]>;
  byNormalized: Map<string, (typeof institutions)[0]>;
  byNameLower: Map<string, (typeof institutions)[0]>;
} {
  const byExactSlug = new Map<string, (typeof institutions)[0]>();
  const byNormalized = new Map<string, (typeof institutions)[0]>();
  const byNameLower = new Map<string, (typeof institutions)[0]>();

  for (const inst of institutions) {
    byExactSlug.set(toSlug(inst.name), inst);
    byNormalized.set(normalizeKey(inst.name), inst);
    byNameLower.set(inst.name.toLowerCase(), inst);
  }

  return { byExactSlug, byNormalized, byNameLower };
}

function matchInstitution(
  slug: string,
  index: ReturnType<typeof buildNameIndex>,
): { id: string; name: string; images: string[] } | null {
  const aliasName = SLUG_ALIASES[slug];
  if (aliasName) {
    const hit = index.byNameLower.get(aliasName.toLowerCase());
    if (hit) return hit;
  }

  const exact = index.byExactSlug.get(slug);
  if (exact) return exact;

  const normalized = index.byNormalized.get(normalizeKey(slug));
  if (normalized) return normalized;

  return null;
}

async function main(): Promise<void> {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error('AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are required');
  }

  console.log(`Bucket: s3://${BUCKET} (${REGION})`);
  console.log(`Mode:   ${DRY_RUN ? 'DRY RUN (no DB writes)' : 'APPLY'}`);
  console.log('');

  const bySlug = await listInstitutionKeys();
  const institutions = await prisma.institution.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, images: true },
  });
  const index = buildNameIndex(institutions);

  let matched = 0;
  let updated = 0;
  let skippedEmpty = 0;
  let unmatched = 0;
  const unmatchedSlugs: string[] = [];

  for (const [slug, keys] of [...bySlug.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (keys.length === 0) {
      skippedEmpty += 1;
      continue;
    }

    const inst = matchInstitution(slug, index);
    if (!inst) {
      unmatched += 1;
      unmatchedSlugs.push(slug);
      console.log(`✗  no DB match for slug "${slug}" (${keys.length} file(s))`);
      continue;
    }

    matched += 1;
    const urls = keys.map(publicUrl);
    // Append rather than replace: admin uploads live under institutions/{id}/…,
    // which the slug matcher never sees, and overwriting would drop them from
    // the DB while orphaning the S3 objects they point at.
    const added = urls.filter((u) => !inst.images.includes(u));
    const merged = [...inst.images, ...added];

    if (added.length === 0) {
      console.log(`=  ${inst.name} — already synced (${urls.length})`);
      continue;
    }

    console.log(
      `${DRY_RUN ? '~' : '✓'}  ${inst.name} ← ${slug} (+${added.length} of ${urls.length} image(s), ${merged.length} total)`,
    );
    for (const u of added) console.log(`     ${u}`);

    if (!DRY_RUN) {
      await prisma.institution.update({
        where: { id: inst.id },
        data: { images: merged },
      });
      updated += 1;
    } else {
      updated += 1; // would update
    }
  }

  // Optional: clear Redis institution list/map cache (best-effort).
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
  console.log(`S3 slugs with images: ${bySlug.size}`);
  console.log(`Skipped (no files):   ${skippedEmpty}`);
  console.log(`Matched:              ${matched}`);
  console.log(`${DRY_RUN ? 'Would update' : 'Updated'}:           ${updated}`);
  console.log(`Unmatched slugs:      ${unmatched}`);
  if (unmatchedSlugs.length) {
    console.log(`  → ${unmatchedSlugs.join(', ')}`);
  }
  console.log(`DB institutions:      ${institutions.length}`);
  console.log(
    `DB still without images after match: ${institutions.length - matched} (no S3 folder or empty)`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
