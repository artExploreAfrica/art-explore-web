import { TagCategory } from '@prisma/client';

/**
 * The tag vocabulary: the tags the Art Explore team works with (the nine
 * agreed in November 2026, plus Yoruba History, which has a home-page card).
 *
 * One list, read by `prisma/seed.ts` (fresh databases) and
 * `scripts/tags-2026-11.ts` (replaces the old list on an existing one), so
 * they can't drift apart. After that the admin owns the list — tags can be
 * created, renamed and deleted on the Tags page.
 *
 * `category` is a leftover: the admin no longer shows or asks for it, but the
 * column is NOT NULL, so every tag carries the same hidden value.
 */
export const TAG_CATEGORY_DEFAULT = TagCategory.STYLE;

export interface TagDefinition {
  /** Machine slug, unique. */
  name: string;
  /** What people see. */
  label: string;
}

export const TAG_VOCABULARY: readonly TagDefinition[] = [
  { name: 'WOMEN_OWNED', label: 'Women Owned' },
  { name: 'AFFORDABLE_ART', label: 'Affordable Art' },
  { name: 'CHILDREN_FOCUSED', label: 'Children Focused' },
  { name: 'RESIDENCIES', label: 'Residencies' },
  { name: 'WORKSHOPS_CLASSES', label: 'Workshops & Classes' },
  { name: 'WEEKLY_FEATURES', label: 'Weekly Features' },
  { name: 'RECENTLY_ESTABLISHED', label: 'Recently established' },
  { name: 'CLASSICS', label: 'Classics' },
  { name: 'LIVE_EXHIBITION', label: 'Live Exhibition' },
  // Created in the live admin (Nov 2026) and given a home-page card; listed
  // here so a fresh database (seed) has it too, or that card would be missing.
  { name: 'YORUBA_HISTORY', label: 'Yoruba History' },
];
