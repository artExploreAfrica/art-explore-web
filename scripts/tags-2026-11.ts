/**
 * Replace the tag list with the nine agreed tags and apply the first round of
 * assignments (November 2026 "Tags" task).
 *
 * What it does, in one transaction:
 *   1. Creates/updates the nine tags in src/config/tags.ts.
 *   2. Deletes every other tag (the old Style / Ownership / Curation / Format
 *      list). Deleting a tag also detaches it from any space that carried it.
 *   3. Attaches tags to spaces from the lists below. Each list says why.
 *   4. Pre-fills RESIDENCIES and LIVE_EXHIBITION once from what the system
 *      already knows (`hasResidency`, a "residency" mention in the description,
 *      `hasExhibition`), for fixed spaces only (not festivals or nomadic
 *      spaces). After that the admin owns them — this script never
 *      removes a tag from a space, so running it again won't undo hand edits.
 *   WEEKLY_FEATURES is not assigned: it is set by hand in the admin.
 *
 * Assignments are source-backed only (see the review notes in the PR): a tag is
 * given when the client's own description or a published source supports it.
 * Founders' gender is never inferred from a name, so spaces whose founder is
 * named but not confirmed as a woman are left off WOMEN_OWNED for now.
 *
 * Like the other data scripts it never creates or deletes a space, matches by
 * name (case-insensitive, among non-deleted rows), reports names it can't find,
 * and is safe to re-run. Run it after scripts/data-quality-2026-10.ts, which
 * merges duplicates and fixes names this script relies on.
 *
 * Usage:
 *   npx ts-node scripts/tags-2026-11.ts            # dry run (default)
 *   npx ts-node scripts/tags-2026-11.ts --apply    # write
 */
import 'dotenv/config';
import { InstitutionType, Prisma, PrismaClient } from '@prisma/client';
import { TAG_CATEGORY_DEFAULT, TAG_VOCABULARY } from '../src/config/tags';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

type Tx = Prisma.TransactionClient;

/** tag name → spaces. Evidence for each is in the comment above its list. */
const ASSIGNMENTS: Record<string, string[]> = {
  // A named woman founder/owner, per the client's descriptions plus press: the
  // ArtReview list of women-run Lagos galleries (Rele, Tiwani, Bloom Art, kó,
  // SMO, Wunika Mukan), Nike Davies-Okundaye, Bolanle Austen-Peters (Terra
  // Kulture), Kavita Chellaram (Arthouse, kó), Wura-Natasha Ogunji (Treehouse).
  // Awaiting the owner's confirmation, so NOT included: Soto Gallery, Nomadic
  // Art Gallery, Negro Art Gallery, Olori Art Foundation, Nuru gallery, Alara.
  WOMEN_OWNED: [
    'Nike Art Gallery',
    'Rele Gallery',
    'Wunika Mukan',
    'Ko Art Space',
    'Arthouse Contemporary',
    'Terra Kulture',
    'The Treehouse Lagos',
    'SMO Contemporary Art',
    'Tiwani Contemporary',
    'Bloom Art',
  ],

  // The Children's Art Gallery (founded 2022, exhibits and sells children's
  // work); Rele Kids Art Club (ages 3–12); the National Museum's children's
  // programmes and classes.
  CHILDREN_FOCUSED: ['TCA Gallery', 'Rele Gallery', 'National Museum Lagos'],

  // Ogirikan: affordable miniatures and paper works, free entry. The only
  // space with evidence; there is no price data in the catalogue.
  AFFORDABLE_ART: ['Ogirikan Art Gallery'],

  // The space's description mentions workshops, classes, courses or training.
  WORKSHOPS_CLASSES: [
    'ALALI', // pottery, candle-making and cocktail classes
    'Clay of Lagos', // pottery workshops
    'Abela Centre For Olfactory Art', // perfume-creation workshops
    'Yenwa Gallery', // library/workspace for workshops
    'Alliance Francaise', // language courses
    'Oshodi Arts Gallery', // workshops and school programmes
    'KAP Hub', // KAP Film & Television Academy
    'Olori Art Foundation', // painting, Adire and craft workshop space
    'Nike Art Gallery', // offers workshops
    'Universal Studios of Art', // trains student-trainees yearly
    'Terra Kulture', // language school
  ],

  // Opened in 2020 or later, per the description.
  RECENTLY_ESTABLISHED: [
    "O'DA", // 2020
    'Wunika Mukan', // 2020
    'Oshodi Arts Gallery', // Dec 2020
    'Kokopelli Gallery', // 2021
    'Olori Art Foundation', // 2021
    'Yenwa Gallery', // 2021 (physical space April 2023)
    'Soto Gallery', // Sept 2022
    'Tim and Carol Gallery of Art', // 2022
    'The Art Hotel', // July 2022
    'Windsor Gallery', // Sept 2023
    'MadhousebyTikera', // Dec 2023
  ],

  // Founded before 2000, or a heritage museum/site.
  CLASSICS: [
    'Treasure House Fine Arts', // since 1982
    'Universal Studios of Art', // early 1980s
    'Nimbus Gallery', // 1991
    'Hourglass Gallery', // 1996
    'National Museum Lagos', // historic national museum
    'Kalakuta Museum', // Fela's heritage house
    'Freedom Park', // historic site on the old colonial prison ground
    'Badagry Heritage Museum', // slave-trade and colonial heritage
  ],
};

const log: string[] = [];
const missing: string[] = [];
const note = (line: string) => log.push(line);

async function vocabulary(tx: Tx) {
  const wanted = new Set(TAG_VOCABULARY.map((t) => t.name));

  for (const t of TAG_VOCABULARY) {
    const existing = await tx.tag.findUnique({ where: { name: t.name } });
    if (!existing) {
      await tx.tag.create({ data: { ...t, category: TAG_CATEGORY_DEFAULT } });
      note(`tag     + ${t.name} ("${t.label}")`);
    } else if (existing.label !== t.label) {
      await tx.tag.update({ where: { name: t.name }, data: { label: t.label } });
      note(`tag     ~ ${t.name}: "${existing.label}" → "${t.label}"`);
    }
  }

  const old = await tx.tag.findMany({
    where: { name: { notIn: [...wanted] } },
    select: { id: true, name: true, _count: { select: { institutions: true } } },
  });
  for (const t of old) {
    await tx.tag.delete({ where: { id: t.id } });
    note(`tag     - ${t.name} (was on ${t._count.institutions} space(s))`);
  }
}

async function attach(tx: Tx, tag: string, names: string[], why = '') {
  for (const name of names) {
    const row = await tx.institution.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, deletedAt: null },
      include: { tags: { select: { name: true } } },
    });
    if (!row) {
      missing.push(`${tag}: ${name}`);
      continue;
    }
    if (row.tags.some((t) => t.name === tag)) continue;
    await tx.institution.update({ where: { id: row.id }, data: { tags: { connect: { name: tag } } } });
    note(`assign  "${row.name}" + ${tag}${why}`);
  }
}

async function assignments(tx: Tx) {
  for (const [tag, names] of Object.entries(ASSIGNMENTS)) await attach(tx, tag, names);

  // One-time pre-fill from data the system already holds. Festivals and
  // nomadic spaces are left out: the tags are for fixed Art & Cultural Spaces.
  const fixedSpace = { type: { notIn: [InstitutionType.ART_FESTIVAL, InstitutionType.NOMADIC_SPACE] } };
  const residencies = await tx.institution.findMany({
    where: {
      deletedAt: null,
      ...fixedSpace,
      OR: [{ hasResidency: true }, { description: { contains: 'residenc', mode: 'insensitive' } }],
    },
    select: { name: true },
  });
  await attach(tx, 'RESIDENCIES', residencies.map((r) => r.name), ' (runs a residency)');

  const shows = await tx.institution.findMany({
    where: { deletedAt: null, ...fixedSpace, hasExhibition: true },
    select: { name: true },
  });
  await attach(tx, 'LIVE_EXHIBITION', shows.map((r) => r.name), ' (has a live exhibition)');
}

/** Thrown at the end of a dry run so the transaction rolls back. */
class DryRun extends Error {}

async function main(): Promise<void> {
  console.log(`Mode: ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}\n`);

  // One transaction: a dry run executes the real queries and rolls back, so its
  // report is exactly what --apply does.
  try {
    await prisma.$transaction(
      async (tx) => {
        await vocabulary(tx);
        await assignments(tx);
        if (!APPLY) throw new DryRun();
      },
      { timeout: 60_000 },
    );
  } catch (e) {
    if (!(e instanceof DryRun)) throw e;
  }

  console.log(log.length ? log.join('\n') : 'Nothing to change — already done.');
  if (missing.length) console.log(`\nNot found in this database (skipped):\n  ${missing.join('\n  ')}`);
  console.log(`\n${log.length} change(s) ${APPLY ? 'written' : 'would be written — re-run with --apply'}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
