import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { TAG_VOCABULARY } from '../src/config/tags';

describe('tag vocabulary', () => {
  it('is the nine agreed tags, with unique upper-case slugs', () => {
    expect(TAG_VOCABULARY.map((t) => t.label)).toEqual([
      'Women Owned',
      'Affordable Art',
      'Children Focused',
      'Residencies',
      'Workshops & Classes',
      'Weekly Features',
      'Recently established',
      'Classics',
      'Live Exhibition',
    ]);
    const slugs = TAG_VOCABULARY.map((t) => t.name);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[A-Z]+(_[A-Z]+)*$/);
  });

  // The homepage lists its six tags by slug in the frontend package, which
  // can't import from src/. A typo there would silently drop a card, so check
  // every slug it names exists, with the same label.
  it('covers every tag the homepage section names', () => {
    const file = path.resolve(__dirname, '../frontend/src/components/sections/TagShowcase.jsx');
    const source = fs.readFileSync(file, 'utf8');
    const named = [...source.matchAll(/\{ name: "([A-Z_]+)", label: "([^"]+)"/g)].map((m) => ({
      name: m[1],
      label: m[2],
    }));

    expect(named).toHaveLength(6);
    for (const tag of named) {
      expect(TAG_VOCABULARY).toContainEqual(expect.objectContaining(tag));
    }
  });
});
