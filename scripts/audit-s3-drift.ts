/**
 * Read-only reconciliation between the S3 media bucket and Institution.images[].
 *
 * Why the two counts disagree: the bucket holds TWO incompatible key
 * conventions, written by different code paths.
 *
 *   institutions/{slug}/image-1.jpg      bulk upload — folder is a name-derived slug
 *   institutions/{cuid}/{uuid}.jpg       admin panel — folder is the institution id
 *
 * `s3Uploader.ts` writes the second. `sync-s3-images-to-db.ts` reads only the
 * first (it hard-filters on a 3-segment key and then matches the slug back to a
 * row by name). So half the bucket is invisible to the syncer, and the name
 * matching needs a hand-maintained alias table to work at all.
 *
 * This script reports the true state before anything is changed. It performs
 * no writes: ListObjectsV2 and findMany only.
 *
 * Usage:
 *   npx ts-node scripts/audit-s3-drift.ts
 *   npx ts-node scripts/audit-s3-drift.ts --full   # list every item, not just samples
 */
import 'dotenv/config';
import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';

const BUCKET = process.env.AWS_S3_BUCKET_NAME || 'art-explore-db-images';
const REGION = process.env.AWS_REGION || 'eu-north-1';
const FULL = process.argv.includes('--full');

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

const prisma = new PrismaClient();
const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// ---------------------------------------------------------------------------
// Name matching — mirrors sync-s3-images-to-db.ts, which exports nothing and
// self-executes on import, so it cannot be reused directly.
// ---------------------------------------------------------------------------

const SLUG_ALIASES: Record<string, string> = {
  "od'a-gallery": "O'DA",
  'society-for-art-collection(sartcol)': 'Society for Art Collection (SARTCOL)',
  'bloom-gallery': 'Bloom Art',
  '+234-art-fair': '+234 Art Fair (Plus234 Art Fair)',
  'centre-for-contemporary-art': 'Centre for Contemporary Art (CCA)',
  'guest-art-space': 'Guest Artists Space Foundation (GAS)',
  'biodun-omolayo': 'Biodun Omolayo Gallery',
  bogobiri: 'Bogobiri House',
  mydrim: 'Mydrim Gallery',
  'goethe-institute-lagos': 'Goethe Institut Lagos',
  henriwometa: 'Henrimoweta African Art Center',
};

const foldAccents = (v: string): string => v.normalize('NFD').replace(/[̀-ͯ]/g, '');
const toSlug = (n: string): string =>
  foldAccents(n).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-');
const normalizeKey = (v: string): string => foldAccents(v).toLowerCase().replace(/[^a-z0-9]/g, '');

const publicUrl = (key: string): string =>
  `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key.split('/').map(encodeURIComponent).join('/')}`;

/** Reverse a stored public URL back to its S3 key, or null if it is not ours. */
function keyFromUrl(url: string): string | null {
  const prefix = `https://${BUCKET}.s3.${REGION}.amazonaws.com/`;
  if (!url.startsWith(prefix)) return null;
  return decodeURIComponent(url.slice(prefix.length));
}

async function listAll(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const res = await s3.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token, MaxKeys: 1000 }),
    );
    for (const o of res.Contents ?? []) if (o.Key && IMAGE_EXT.test(o.Key)) keys.push(o.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

const show = (label: string, items: string[]): void => {
  if (items.length === 0) return;
  console.log(`\n  ${label} (${items.length}):`);
  const slice = FULL ? items : items.slice(0, 15);
  for (const i of slice) console.log(`    ${i}`);
  if (!FULL && items.length > slice.length) {
    console.log(`    … and ${items.length - slice.length} more (--full to list all)`);
  }
};

async function main(): Promise<void> {
  for (const k of ['DATABASE_URL', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'] as const) {
    if (!process.env[k]) throw new Error(`Missing required env: ${k}`);
  }

  console.log(`Bucket : s3://${BUCKET} (${REGION})`);
  console.log('Mode   : READ-ONLY (ListObjectsV2 + findMany)\n');

  const [instKeys, exhKeys, institutions] = await Promise.all([
    listAll('institutions/'),
    listAll('exhibitions/'),
    prisma.institution.findMany({ select: { id: true, name: true, images: true, deletedAt: true } }),
  ]);

  const byId = new Map(institutions.map((i) => [i.id, i]));
  const byExactSlug = new Map(institutions.map((i) => [toSlug(i.name), i]));
  const byNormalized = new Map(institutions.map((i) => [normalizeKey(i.name), i]));
  const byNameLower = new Map(institutions.map((i) => [i.name.trim().toLowerCase(), i]));

  // Every key currently referenced by the database.
  const referenced = new Set<string>();
  for (const i of institutions) {
    for (const url of i.images) {
      const k = keyFromUrl(url);
      if (k) referenced.add(k);
    }
  }

  // Classify every institutions/ key.
  const idPrefixed: string[] = [];
  const slugMatched: string[] = [];
  const slugUnmatched: string[] = [];
  const malformed: string[] = [];
  const unmatchedSlugs = new Set<string>();

  for (const key of instKeys) {
    const parts = key.split('/');
    if (parts.length !== 3 || !parts[1] || !parts[2]) {
      malformed.push(key);
      continue;
    }
    const folder = parts[1];
    if (byId.has(folder)) {
      idPrefixed.push(key);
      continue;
    }
    const alias = SLUG_ALIASES[folder];
    const hit =
      (alias ? byNameLower.get(alias.toLowerCase()) : undefined) ??
      byExactSlug.get(folder) ??
      byNormalized.get(normalizeKey(folder));
    if (hit) slugMatched.push(key);
    else {
      slugUnmatched.push(key);
      unmatchedSlugs.add(folder);
    }
  }

  /**
   * Resolve a key's folder segment to a human name. An id-prefixed key carries
   * a cuid, which is unreadable on its own — the whole point of the audit is to
   * say WHICH institution is affected, so map it back.
   */
  const ownerOf = (key: string): string => {
    const folder = key.split('/')[1] ?? '';
    const direct = byId.get(folder);
    if (direct) return `${direct.name}${direct.deletedAt ? ' [soft-deleted]' : ''}`;
    const alias = SLUG_ALIASES[folder];
    const hit =
      (alias ? byNameLower.get(alias.toLowerCase()) : undefined) ??
      byExactSlug.get(folder) ??
      byNormalized.get(normalizeKey(folder));
    return hit ? `${hit.name}${hit.deletedAt ? ' [soft-deleted]' : ''}` : `?? no match for "${folder}"`;
  };

  const orphans = instKeys.filter((k) => !referenced.has(k));
  const orphansByOwner = new Map<string, number>();
  for (const k of orphans) orphansByOwner.set(ownerOf(k), (orphansByOwner.get(ownerOf(k)) ?? 0) + 1);
  const dead: string[] = [];
  const inBucket = new Set([...instKeys, ...exhKeys]);
  const foreign: string[] = [];
  for (const i of institutions) {
    for (const url of i.images) {
      const k = keyFromUrl(url);
      if (!k) foreign.push(`${i.name}  ${url}`);
      else if (!inBucket.has(k)) dead.push(`${i.name}  ${k}`);
    }
  }

  const live = institutions.filter((i) => !i.deletedAt);
  const noImage = live.filter((i) => i.images.length === 0);

  console.log('='.repeat(70));
  console.log('S3 ↔ DATABASE DRIFT');
  console.log('='.repeat(70));
  console.log(`  objects under institutions/ : ${instKeys.length}`);
  console.log(`    ├─ id-prefixed  (admin panel uploads) : ${idPrefixed.length}`);
  console.log(`    ├─ slug-prefixed, matched a row       : ${slugMatched.length}`);
  console.log(`    ├─ slug-prefixed, NO matching row     : ${slugUnmatched.length}`);
  console.log(`    └─ malformed / nested                 : ${malformed.length}`);
  console.log(`  objects under exhibitions/  : ${exhKeys.length}`);
  console.log(`\n  institutions in DB          : ${institutions.length} (${live.length} live)`);
  console.log(`  keys referenced by images[] : ${referenced.size}`);

  console.log('\n  ── problems ──');
  console.log(`  ORPHANS  in S3, not referenced by any row : ${orphans.length}`);
  console.log(`  DEAD     referenced by a row, absent in S3: ${dead.length}`);
  console.log(`  FOREIGN  images[] URL for another bucket  : ${foreign.length}`);
  console.log(`  live institutions with no image at all    : ${noImage.length} / ${live.length}`);

  const recoverable = idPrefixed.filter((k) => !referenced.has(k));

  show(
    'orphaned objects, by institution',
    [...orphansByOwner.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, n]) => `${String(n).padStart(3)}  ${name}`),
  );
  show('dead references', dead);
  show('foreign URLs', foreign);
  show('slug folders matching no institution', [...unmatchedSlugs]);
  show('malformed keys', malformed);
  show(
    'live institutions with no image',
    noImage.map((i) => i.name),
  );

  console.log('\n  ── what a fixed sync would recover ──');
  console.log(`  id-prefixed objects the current sync CANNOT see: ${recoverable.length}`);
  if (recoverable.length > 0) {
    show('…belonging to', [...new Set(recoverable.map((k) => ownerOf(k)))]);
    console.log(`  Example URL that would be attached:\n    ${publicUrl(recoverable[0])}`);
  }

  // ---- direct answers, in the order they are usually asked ----
  console.log(`\n${'='.repeat(70)}`);
  console.log('PLAIN ANSWERS');
  console.log('='.repeat(70));
  console.log(`  1. institution images in S3 ................ ${instKeys.length}`);
  console.log(`  2. images referenced by the database ....... ${referenced.size}`);
  console.log(`  3. S3 images invisible to the panel ....... ${orphans.length}`);
  console.log(`       of which recoverable by fixing sync ... ${recoverable.length}`);
  console.log(`  4. DB references with no S3 object ........ ${dead.length}`);
  console.log(`  5. orphaned S3 images ..................... ${orphans.length}`);
  console.log(`  6. using OLD slug convention .............. ${slugMatched.length + slugUnmatched.length}`);
  console.log(`  7. using NEW institution-ID convention .... ${idPrefixed.length}`);
  console.log(`  8. institutions affected .................. ${orphansByOwner.size} with orphans, ` +
    `${new Set(dead.map((d) => d.split('  ')[0])).size} with dead links`);
  console.log('='.repeat(70));
}

main()
  .catch((err) => {
    console.error('Audit failed:', err instanceof Error ? `${err.name}: ${err.message}` : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });