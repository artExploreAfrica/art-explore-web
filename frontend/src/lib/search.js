import { placeOf } from "./adapters";

/**
 * Forgiving search for spaces — shared by the directory (/galleries) and the
 * map's search box.
 *
 * Visitors type names the way their keyboard lets them, so a match must not
 * depend on tone marks, apostrophes, spelling variants or exact word order:
 *
 *   "alara"            finds  "Alárá"                (tone marks / accents)
 *   "ile ife", "ọ̀yọ́"   find   "Ilé-Ifẹ̀", "Oyo"        (dots below, hyphens)
 *   "nikes gallery"    finds  "Nike's Gallery"        (apostrophes ' ’ ʼ `)
 *   "nike art"         finds  "Nike Art Gallery"      (word prefixes, any order)
 *   "nikeart"          finds  "Nike Art"              (missing spaces)
 *   "art center"       finds  "… Art Centre"          (US/UK spellings)
 *   "galleries"        finds  "… Gallery"             (plurals)
 *   "galery", "musuem" find   "Gallery", "Museum"     (one typo, longer words)
 *   "terra kulture"    finds  "Terra Kulture" — and "& / and" are the same.
 *
 * Everything is plain string work on the already-loaded list: no requests,
 * fast enough to run on every keystroke for a few hundred spaces.
 */

// British and American spellings, common misspellings and short forms, all
// mapped to one form. Applied to both the query and the space's text.
const VARIANTS = {
  center: "centre",
  centers: "centre",
  centres: "centre",
  theater: "theatre",
  theaters: "theatre",
  color: "colour",
  colors: "colour",
  gallary: "gallery",
  galleria: "gallery",
  galeria: "gallery",
  musuem: "museum",
  museam: "museum",
  // No short abbreviations ("st", "vi"…): people type letter by letter, and
  // "st" on the way to "studio" must not be read as "saint".
};

/**
 * Text → comparable form: no tone marks or accents (é, ẹ, ṣ, ọ̀ → e, e, s, o),
 * no apostrophes, lower-case, "&" read as "and", every other symbol a space.
 */
export function normalizeText(text) {
  if (!text) return "";
  return String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // combining marks: tones, accents, dots below
    .toLowerCase()
    .replace(/['’‘`´ʼʻ]/g, "") // apostrophes: "nike's" → "nikes"
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** One word → its base form: spelling variant, then plural. */
function baseWord(word) {
  const v = VARIANTS[word];
  if (v) return v;
  if (word.length > 4 && word.endsWith("ies")) return word.slice(0, -3) + "y"; // galleries → gallery
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1); // arts → art
  return word;
}

function words(text) {
  return normalizeText(text)
    .split(" ")
    .filter(Boolean)
    .map(baseWord);
}

/** At most one insertion, deletion, substitution or swap apart. */
function withinOneEdit(a, b) {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  if (la === lb) {
    // substitution, or two neighbours swapped
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/**
 * Pre-computes a space's searchable text once (call it in a useMemo), so
 * typing doesn't redo the work for every space on every keystroke.
 */
export function searchIndex(fields) {
  const list = words(fields.filter(Boolean).join(" "));
  return { words: list, compact: list.join("") };
}

/** Pre-computes the query once per keystroke. */
export function searchQuery(query) {
  const list = words(query);
  return { words: list, compact: list.join("") };
}

/**
 * Does the space match? Every word typed must match a word of the space —
 * as the start of it ("gal" → "gallery"), or one typo away for words of
 * five letters or more. Failing that, the query with its spaces removed may
 * appear in the space's text with its spaces removed ("nikeart").
 */
export function matchesSearch(index, query) {
  if (!query.words.length) return true;
  const everyWord = query.words.every((q) =>
    index.words.some(
      (w) =>
        w.startsWith(q) ||
        (q.length >= 5 && (withinOneEdit(q, w) || withinOneEdit(q, w.slice(0, q.length)))),
    ),
  );
  if (everyWord) return true;
  return query.compact.length >= 3 && index.compact.includes(query.compact);
}

/** Convenience for one-off checks: does `text` (or any of `texts`) match `query`? */
export function textMatches(texts, query) {
  const list = Array.isArray(texts) ? texts : [texts];
  return matchesSearch(searchIndex(list), searchQuery(query));
}

// ── Spaces ──────────────────────────────────────────────────

// Each space's prepared text, worked out once and kept for as long as the
// space object lives (the list is loaded once and shared).
const spaceIndexes = new WeakMap();

/** What a space can be found by: name, area, type and tags. */
function spaceIndex(space) {
  let index = spaceIndexes.get(space);
  if (!index) {
    index = searchIndex([
      space.name,
      placeOf(space),
      space.neighborhood,
      space.subArea,
      space.typeLabel,
      ...(space.tags ?? []).map((t) => t.label),
    ]);
    spaceIndexes.set(space, index);
  }
  return index;
}

/**
 * Filters a list of spaces by what the visitor typed. An empty query keeps
 * everything.
 */
export function filterSpaces(spaces, query) {
  const q = searchQuery(query);
  if (!q.words.length) return spaces;
  return spaces.filter((space) => matchesSearch(spaceIndex(space), q));
}
