# Tags

Tags are labels the team attaches to Art & Cultural Spaces (admin › Institutions › Edit › **Tags**). They are
managed on admin › **Tags**: create, rename, delete. There is no category any more.

## The nine tags

Women Owned · Affordable Art · Children Focused · Residencies · Workshops & Classes · Weekly Features ·
Recently established · Classics · Live Exhibition

The list lives in `src/config/tags.ts` (read by `prisma/seed.ts` and `scripts/tags-2026-11.ts`). The admin
owns it after that.

`Tag.category` is a leftover: the admin neither shows nor asks for it. The column is `NOT NULL`, so the API
stores `STYLE` when it isn't given. Dropping the column would be a production database change; it can go in
a later tidy-up.

## On the public site

The homepage section **Find your kind of space** shows six of the tags as swipeable photo cards: Women Owned,
Affordable Art, Children Focused, Workshops & Classes, Recently established, Classics.

- A card links to `/galleries?tag=<SLUG>`: the directory opens on its **Tags** tab with that sub-tag picked.
- Its cover is a photo of one of the spaces carrying the tag. `COVER_PREFERENCE` in
  `frontend/src/components/sections/TagShowcase.jsx` names the preferred space per tag, falling back to the
  first tagged space that has a photo.
- A tag nobody carries yet gets no card. If none do, the whole section is hidden.
- Residencies, Weekly Features and Live Exhibition aren't on the homepage; they're for the directory and
  admin.

## In the directory

The directory page (`/galleries`) uses the same tags:

- **Cards** show each space's real tags (A to Z) instead of its type. A space with no real tag shows no chip, so the
  tagged ones stand out. (The small "Exhibition" chip for a space with a live exhibition is unchanged.)
- A **Tags** header tab sits beside All, Art Gallery, Museum and the other type tabs. It counts the spaces that carry at
  least one tag. Choosing it opens a row of sub-tags (only the tags in use, with counts); picking one narrows the list,
  picking it again clears it.
- The pick lives in the URL as `?tag=<SLUG>`, so a homepage tag card, or a shared link, opens the Tags tab with that
  sub-tag already picked.

## Releasing to production

Merging changes no data. After `dev` is released to `main`:

1. Back up the production database.
2. `npx ts-node scripts/data-quality-2026-10.ts` (review the dry run, then `--apply`), if not already done.
3. `npx ts-node scripts/tags-2026-11.ts` (review the dry run, then `--apply`). This replaces the old tag list
   with the nine and attaches the first assignments. It never removes a tag from a space, so it is safe to
   re-run, and it won't undo hand edits.

Until step 3, the homepage tag section stays hidden (no space has any of the new tags).

## Deciding who gets a tag

- **Women Owned**: a named woman founder/owner, per the client's description or a published source. Founders'
  gender is not inferred from a name; spaces awaiting the owner's confirmation are left off.
- **Workshops & Classes**: the space's description mentions workshops, classes, courses or training.
- **Recently established**: opened in 2020 or later, per the description.
- **Classics**: founded before 2000, or a heritage museum/site.
- **Children Focused / Affordable Art**: a published source says so (the venue's own site or press).
- **Residencies / Live Exhibition**: pre-filled once from existing data for fixed spaces; manual afterwards.
- **Weekly Features**: set by hand.
