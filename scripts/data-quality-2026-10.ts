/**
 * One-off data-quality pass over the live institutions (October 2026 audit).
 *
 * The audit compared the production catalogue with the client's latest sheet
 * (ArtandCulturalSpacesDBlatest5.csv) and found:
 *   - two duplicates: "J. Randle Centre" is the sheet's "John Randle Centre",
 *     and "Art House Foundation" is the same organisation as "Arthouse
 *     Contemporary" (same website, phone and address);
 *   - 16 entries whose type/subType disagree with the sheet — mostly festivals
 *     and nomadic spaces still filed as cultural spaces or galleries;
 *   - opening hours missing for 45 fixed venues. Hours were researched and only
 *     taken from the venue's own website; everything else is left unset rather
 *     than guessed (see HOURS / BY_APPOINTMENT below for sources);
 *   - no tags on any entry. Only tags provable from the data are assigned
 *     (BY_APPOINTMENT, ONLINE, LIVE_EXHIBITION); style and curation tags are an
 *     editorial call left to the client.
 *
 * Requires the 20261030120000_finalise_institution_types migration (the new
 * InstitutionType values) to have been applied first.
 *
 * Like import-subarea.ts, this never creates an institution and never
 * hard-deletes one: a merged duplicate is soft-deleted (deletedAt + unpublished)
 * so it can be restored. Entries are matched by name, case-insensitively, among
 * rows that are not soft-deleted; a name that isn't found is reported and
 * skipped, so the script is safe to run against any environment and to re-run.
 *
 * Usage:
 *   npx ts-node scripts/data-quality-2026-10.ts            # dry run (default)
 *   npx ts-node scripts/data-quality-2026-10.ts --apply    # write
 */
import 'dotenv/config';
import {
  ApprovalStatus,
  InstitutionSubType,
  InstitutionType,
  Prisma,
  PrismaClient,
  TagCategory,
} from '@prisma/client';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

type Tx = Prisma.TransactionClient;
type DayHours = { open: string; close: string } | null;
/** Keyed by JS day index ("0" = Sunday), the shape the API validates. */
type OpeningHours = Record<'0' | '1' | '2' | '3' | '4' | '5' | '6', DayHours>;

/**
 * Duplicates. `keep` survives; `drop` is folded into it and soft-deleted.
 * `rename` sets the survivor's name (the sheet's spelling, so a future re-seed
 * matches it instead of inserting a third copy).
 */
const MERGES: { keep: string[]; drop: string; rename?: string }[] = [
  // Live row has the images; the sheet spells it "John Randle Centre".
  { keep: ['J. Randle Centre', 'John Randle Centre'], drop: 'John Randle Centre', rename: 'John Randle Centre' },
  { keep: ['Arthouse Contemporary'], drop: 'Art House Foundation' },
];

/** Target type/subType. `null` subType clears it (nomadic spaces have none). */
const TYPES: [name: string, type: InstitutionType, subType: InstitutionSubType | null][] = [
  // Sheet: Art Festivals
  ['LagosPhoto Festival', 'ART_FESTIVAL', 'ART_FESTIVAL'],
  ['Open House Lagos', 'ART_FESTIVAL', 'ART_FESTIVAL'],
  ['Miniature Art Fair Lagos', 'ART_FESTIVAL', 'ART_FESTIVAL'],
  ['Lagos Street Art Festival', 'ART_FESTIVAL', 'ART_FESTIVAL'],
  ['Lagos Biennial', 'ART_FESTIVAL', 'ART_FESTIVAL'],
  ['ART X Lagos', 'ART_FESTIVAL', 'ART_FESTIVAL'],
  ['+234 Art Fair (Plus234 Art Fair)', 'ART_FESTIVAL', 'ART_FESTIVAL'],
  // Sheet: Nomadic Spaces
  ['Obodo', 'NOMADIC_SPACE', null],
  ['Lagos Gallery Weekend', 'NOMADIC_SPACE', null],
  ['FF Projects', 'NOMADIC_SPACE', null],
  ['Fresco Gallery', 'NOMADIC_SPACE', null],
  // Admin-added galleries (not in the sheet) that were missing a subType
  ['Halal Art Gallerieo', 'ART_GALLERY', 'ART_GALLERY'],
  ['Habitude Gallery', 'ART_GALLERY', 'ART_GALLERY'],
  ['Abstract Strokes', 'ART_GALLERY', 'ART_GALLERY'],
  ['Framemaster Limited', 'ART_GALLERY', 'ART_GALLERY'],
  // A museum of Yoruba culture and history; the sheet files it under hubs.
  ['John Randle Centre', 'HUB_INSTITUTION', 'MUSEUM'],
];

const week = (
  fallback: DayHours,
  overrides: Partial<OpeningHours> = {},
): OpeningHours => ({
  '0': fallback, '1': fallback, '2': fallback, '3': fallback,
  '4': fallback, '5': fallback, '6': fallback,
  ...overrides,
});

/** Only set where the venue has no hours yet — never overwrites curated ones. */
const HOURS: { name: string; hours: OpeningHours; source: string }[] = [
  {
    name: 'Yenwa Gallery',
    hours: week({ open: '12:00', close: '18:00' }, { '1': null }),
    source: 'yenwagallery.com — "Monday: Closed, Tues-Sun: 12:00PM - 6:00PM"',
  },
  {
    name: 'Angels and Muse',
    hours: week({ open: '09:30', close: '18:00' }, { '1': { open: '09:30', close: '20:00' } }),
    source: 'angelsandmuse.org — "Open Daily 9:30–6:00, Monday Until 8:00"',
  },
];

/** Visits by appointment only — tagged BY_APPOINTMENT, hours stay unset. */
const BY_APPOINTMENT = [
  'Guest Artists Space Foundation (GAS)', // guestartistsspace.com: registered visitors, Wed & Fri 12–4pm
  'Polygon', // sheet: "By appointment only"
  'Yusuf Grillo Museum', // sheet: "By appointment only"
  'The Treehouse Lagos', // sheet: "By appointment/programme-based"
];

/** Named as an online gallery. */
const ONLINE = ['Awizzy Online Art Gallery'];

/** Field corrections from the venue's own site. */
const ADDRESSES: [name: string, address: string][] = [
  // guestartistsspace.com library open-day page; the stored value was a placeholder.
  ['Guest Artists Space Foundation (GAS)', '9b Hakeem Dickson Drive, off T.F. Kuboye Road, Oniru, Lagos'],
];

/** Same definitions as seedTags() in prisma/seed.ts. */
const TAGS = {
  BY_APPOINTMENT: { label: 'By Appointment', category: TagCategory.FORMAT },
  ONLINE: { label: 'Online', category: TagCategory.FORMAT },
  LIVE_EXHIBITION: { label: 'Live Exhibition', category: TagCategory.FORMAT },
} as const;

const log: string[] = [];
const missing: string[] = [];
/** Curated values that differ from ours — reported, not overwritten. */
const kept: string[] = [];
const note = (line: string) => log.push(line);

async function findLive(tx: Tx, name: string) {
  return tx.institution.findFirst({
    where: { name: { equals: name, mode: 'insensitive' }, deletedAt: null },
  });
}

/** Mirrors recomputeInstitutionRating() in src/services/review.service.ts, on the tx. */
async function recomputeRating(tx: Tx, institutionId: string) {
  const agg = await tx.review.aggregate({
    where: { institutionId, approvalStatus: ApprovalStatus.APPROVED },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const count = agg._count._all;
  await tx.institution.update({
    where: { id: institutionId },
    data: {
      rating:
        count > 0 && agg._avg.rating !== null ? Math.round(agg._avg.rating * 10) / 10 : null,
      reviewCount: count,
    },
  });
}

async function merges(tx: Tx) {
  for (const m of MERGES) {
    let keep = null;
    for (const name of m.keep) {
      keep = await findLive(tx, name);
      if (keep) break;
    }
    if (!keep) {
      missing.push(`merge: none of ${m.keep.join(' / ')}`);
      continue;
    }
    const drop = await findLive(tx, m.drop);

    if (drop && drop.id !== keep.id) {
      // Fill gaps on the survivor from the duplicate; never overwrite.
      const fill: Prisma.InstitutionUpdateInput = {};
      for (const f of ['description', 'address', 'website', 'instagram', 'phone', 'email', 'mapUrl', 'subArea'] as const) {
        if (!keep[f] && drop[f]) fill[f] = drop[f];
      }
      if (!keep.openingHours && drop.openingHours) fill.openingHours = drop.openingHours as Prisma.InputJsonValue;
      const images = [...new Set([...keep.images, ...drop.images])];
      if (images.length !== keep.images.length) fill.images = images;

      const exhibitions = await tx.exhibition.updateMany({
        where: { institutionId: drop.id },
        data: { institutionId: keep.id },
      });

      // Reviews are unique per (institution, user): move only the ones that
      // don't collide; a colliding one stays on the soft-deleted duplicate.
      const keepReviewers = new Set(
        (await tx.review.findMany({ where: { institutionId: keep.id }, select: { userId: true } })).map(
          (r) => r.userId,
        ),
      );
      const dropReviews = await tx.review.findMany({ where: { institutionId: drop.id } });
      const movable = dropReviews.filter((r) => !keepReviewers.has(r.userId)).map((r) => r.id);
      if (movable.length) {
        await tx.review.updateMany({ where: { id: { in: movable } }, data: { institutionId: keep.id } });
      }

      await tx.institution.update({ where: { id: keep.id }, data: fill });
      await tx.institution.update({
        where: { id: drop.id },
        data: { deletedAt: new Date(), isPublished: false },
      });
      if (movable.length) await recomputeRating(tx, keep.id);

      note(
        `merge   "${drop.name}" → "${keep.name}": filled [${Object.keys(fill).join(', ') || '—'}], ` +
          `${exhibitions.count} exhibition(s), ${movable.length}/${dropReviews.length} review(s) moved; duplicate soft-deleted`,
      );
    }

    if (m.rename && keep.name !== m.rename) {
      await tx.institution.update({ where: { id: keep.id }, data: { name: m.rename } });
      note(`rename  "${keep.name}" → "${m.rename}"`);
    }
  }
}

async function types(tx: Tx) {
  for (const [name, type, subType] of TYPES) {
    const row = await findLive(tx, name);
    if (!row) {
      missing.push(`type: ${name}`);
      continue;
    }
    if (row.type === type && row.subType === subType) continue;
    await tx.institution.update({ where: { id: row.id }, data: { type, subType } });
    note(`type    "${row.name}": ${row.type}/${row.subType ?? '—'} → ${type}/${subType ?? '—'}`);
  }
}

async function hours(tx: Tx) {
  for (const h of HOURS) {
    const row = await findLive(tx, h.name);
    if (!row) {
      missing.push(`hours: ${h.name}`);
      continue;
    }
    if (row.openingHours) {
      if (JSON.stringify(row.openingHours) !== JSON.stringify(h.hours)) {
        kept.push(`hours "${row.name}": has different hours already, left as-is`);
      }
      continue;
    }
    await tx.institution.update({
      where: { id: row.id },
      // Closed days are JSON null inside the object; Prisma's input type
      // doesn't model null members, hence the cast (same as the seed).
      data: { openingHours: h.hours as unknown as Prisma.InputJsonValue },
    });
    note(`hours   "${row.name}": set (${h.source})`);
  }
}

async function addresses(tx: Tx) {
  for (const [name, address] of ADDRESSES) {
    const row = await findLive(tx, name);
    if (!row) {
      missing.push(`address: ${name}`);
      continue;
    }
    if (row.address === address) continue;
    await tx.institution.update({ where: { id: row.id }, data: { address } });
    note(`address "${row.name}": "${row.address ?? ''}" → "${address}"`);
  }
}

async function tags(tx: Tx) {
  for (const [name, t] of Object.entries(TAGS)) {
    await tx.tag.upsert({ where: { name }, update: {}, create: { name, ...t } });
  }

  const connect = async (tag: keyof typeof TAGS, names: string[]) => {
    for (const name of names) {
      const row = await tx.institution.findFirst({
        where: { name: { equals: name, mode: 'insensitive' }, deletedAt: null },
        include: { tags: { select: { name: true } } },
      });
      if (!row) {
        missing.push(`tag ${tag}: ${name}`);
        continue;
      }
      if (row.tags.some((t) => t.name === tag)) continue;
      await tx.institution.update({
        where: { id: row.id },
        data: { tags: { connect: { name: tag } } },
      });
      note(`tag     "${row.name}": + ${tag}`);
    }
  };

  await connect('BY_APPOINTMENT', BY_APPOINTMENT);

  const online = await tx.institution.findMany({
    where: { deletedAt: null, subType: InstitutionSubType.ONLINE },
    select: { name: true },
  });
  await connect('ONLINE', [...new Set([...ONLINE, ...online.map((r) => r.name)])]);

  // LIVE_EXHIBITION mirrors the hasExhibition flag (kept current by
  // recompute-has-exhibition.ts) — added where set, removed where not.
  const withShow = await tx.institution.findMany({
    where: { deletedAt: null, hasExhibition: true },
    select: { name: true },
  });
  await connect('LIVE_EXHIBITION', withShow.map((r) => r.name));
  const stale = await tx.institution.findMany({
    where: { deletedAt: null, hasExhibition: false, tags: { some: { name: 'LIVE_EXHIBITION' } } },
    select: { id: true, name: true },
  });
  for (const row of stale) {
    await tx.institution.update({
      where: { id: row.id },
      data: { tags: { disconnect: { name: 'LIVE_EXHIBITION' } } },
    });
    note(`tag     "${row.name}": - LIVE_EXHIBITION (no current exhibition)`);
  }
}

/** Thrown at the end of a dry run so the transaction rolls back. */
class DryRun extends Error {}

async function main(): Promise<void> {
  console.log(`Mode: ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}\n`);

  // Every step runs inside one transaction: a dry run executes the real
  // queries and then rolls back, so its report is exactly what --apply does.
  try {
    await prisma.$transaction(
      async (tx) => {
        await merges(tx);
        await types(tx);
        await hours(tx);
        await addresses(tx);
        await tags(tx);
        if (!APPLY) throw new DryRun();
      },
      { timeout: 60_000 },
    );
  } catch (e) {
    if (!(e instanceof DryRun)) throw e;
  }

  console.log(log.length ? log.join('\n') : 'Nothing to change — already clean.');
  if (kept.length) {
    console.log(`\nKept existing (differs from this script):\n  ${kept.join('\n  ')}`);
  }
  if (missing.length) {
    console.log(`\nNot found in this database (skipped):\n  ${missing.join('\n  ')}`);
  }
  console.log(`\n${log.length} change(s) ${APPLY ? 'written' : 'would be written — re-run with --apply'}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
