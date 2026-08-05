/**
 * Conversion helpers for `Institution.openingHours`.
 *
 * The API stores and validates hours keyed by JavaScript day index —
 * `{ "0": null, "1": { open: "10:00", close: "18:00" } }` — but the source
 * spreadsheet carries per-day free text (`{ "mon": "10am-6pm", "sun": "closed" }`).
 * These helpers bridge the two so seeded venues are queryable by the
 * `?openNow=true` filter instead of holding hours nothing can parse.
 */

/** One day's trading hours; `null` means closed that day. */
export interface DayHours {
  open: string;
  close: string;
}

export type NormalizedOpeningHours = Record<string, DayHours | null>;

/** Day-name keys used by the sheet → JavaScript day index (`Date#getDay`). */
const DAY_INDEX: Record<string, string> = {
  sun: '0',
  sunday: '0',
  mon: '1',
  monday: '1',
  tue: '2',
  tues: '2',
  tuesday: '2',
  wed: '3',
  weds: '3',
  wednesday: '3',
  thu: '4',
  thur: '4',
  thurs: '4',
  thursday: '4',
  fri: '5',
  friday: '5',
  sat: '6',
  saturday: '6',
};

/** "10am" | "6:30pm" | "18:00" → "HH:mm", or null if unparseable. */
export function parseClockTime(raw: string): string | null {
  const t = raw.trim().toLowerCase().replace(/\./g, '');

  const ampm = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (ampm) {
    let hour = Number(ampm[1]);
    const minute = ampm[2] ?? '00';
    if (hour < 1 || hour > 12) return null;
    if (ampm[3] === 'am') hour = hour === 12 ? 0 : hour;
    else hour = hour === 12 ? 12 : hour + 12;
    return `${String(hour).padStart(2, '0')}:${minute}`;
  }

  const iso = t.match(/^(\d{1,2}):(\d{2})$/);
  if (iso) {
    const hour = Number(iso[1]);
    if (hour > 23) return null;
    return `${String(hour).padStart(2, '0')}:${iso[2]}`;
  }

  return null;
}

/**
 * Convert freeform per-day hours into the validated day-indexed shape.
 *
 * Already-normalised input passes through untouched, so re-seeding is safe. A
 * day whose value cannot be parsed is dropped rather than guessed — an absent
 * day reads as "hours unknown", which is honest, where a wrong one would make
 * the venue advertise an opening time it does not keep. Returns undefined when
 * nothing at all could be salvaged.
 */
export function normalizeOpeningHours(
  parsed: unknown,
): NormalizedOpeningHours | undefined {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;

  const source = parsed as Record<string, unknown>;
  const out: NormalizedOpeningHours = {};

  for (const [rawKey, rawValue] of Object.entries(source)) {
    const key = rawKey.trim().toLowerCase();
    const dayIndex = /^[0-6]$/.test(key) ? key : DAY_INDEX[key];
    if (!dayIndex) continue;

    if (rawValue === null) {
      out[dayIndex] = null;
      continue;
    }

    // Already normalised — still routed through parseClockTime so a stray
    // "9am" in an otherwise-normalised record is corrected rather than stored.
    if (typeof rawValue === 'object') {
      const v = rawValue as { open?: unknown; close?: unknown };
      if (typeof v.open === 'string' && typeof v.close === 'string') {
        const open = parseClockTime(v.open);
        const close = parseClockTime(v.close);
        if (open && close) out[dayIndex] = { open, close };
      }
      continue;
    }

    if (typeof rawValue !== 'string') continue;

    const value = rawValue.trim().toLowerCase();
    if (!value || value === 'closed' || value === 'close') {
      out[dayIndex] = null;
      continue;
    }

    const range = value.split(/\s*(?:-|–|—|to)\s*/);
    if (range.length !== 2) continue;
    const open = parseClockTime(range[0]);
    const close = parseClockTime(range[1]);
    if (open && close) out[dayIndex] = { open, close };
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

const ALL_DAYS = ['0', '1', '2', '3', '4', '5', '6'];
const TIME = String.raw`\d{1,2}(?::\d{2})?\s*(?:am|pm)|\d{1,2}:\d{2}`;
const TIME_RANGE = new RegExp(`(${TIME})\\s*(?:-|–|—|to)\\s*(${TIME})`, 'i');
const DAY_WORD = String.raw`[a-z]{3,9}`;
const DAY_RANGE = new RegExp(`\\b(${DAY_WORD})\\s*(?:-|–|—|to)\\s*(${DAY_WORD})\\b`, 'i');

/** Strip a trailing plural so "mondays" resolves like "monday". */
const dayIndexOf = (word: string): string | undefined =>
  DAY_INDEX[word] ?? DAY_INDEX[word.replace(/s$/, '')];

/** Expand "tue".."sun" to ["2","3","4","5","6","0"], wrapping around the week. */
function expandDayRange(from: string, to: string): string[] | undefined {
  const a = dayIndexOf(from);
  const b = dayIndexOf(to);
  if (a === undefined || b === undefined) return undefined;

  const days: string[] = [];
  let cur = Number(a);
  const end = Number(b);
  for (let guard = 0; guard < 7; guard++) {
    days.push(String(cur));
    if (cur === end) return days;
    cur = (cur + 1) % 7;
  }
  return days;
}

/** Which days a clause refers to once its time range has been removed. */
function daysInClause(text: string): string[] {
  if (/\b(daily|everyday|every day|all week|7 days)\b/i.test(text)) return [...ALL_DAYS];

  const range = text.match(DAY_RANGE);
  if (range) {
    const expanded = expandDayRange(range[1].toLowerCase(), range[2].toLowerCase());
    if (expanded) return expanded;
  }

  const singles: string[] = [];
  for (const word of text.toLowerCase().match(/[a-z]+/g) ?? []) {
    const idx = dayIndexOf(word);
    if (idx !== undefined && !singles.includes(idx)) singles.push(idx);
  }
  if (singles.length > 0) return singles;

  // A bare "9am-5pm" with no day qualifier means every day.
  return [...ALL_DAYS];
}

/**
 * Parse the sheet's free-text hours — "Tue-Sat 11am-6pm",
 * "Mon-Sat 9am-5pm; Sun 12pm-5pm", "8am-6pm daily" — into the day-indexed shape.
 *
 * Roughly a third of the CSV stores hours this way rather than as JSON, so
 * without this those venues would carry no hours at all and never match the
 * "Open Now" filter. Anything genuinely indeterminate ("by appointment only",
 * "24hr hotel") is still left unset rather than invented.
 */
export function parseFreeformHours(raw: string): NormalizedOpeningHours | undefined {
  if (!raw.trim()) return undefined;

  const out: NormalizedOpeningHours = {};

  for (const rawClause of raw.split(/[;,]/)) {
    // Drop editorial parentheticals and approximation marks: "(verify)", "~9am".
    const clause = rawClause.replace(/\([^)]*\)/g, ' ').replace(/~/g, ' ').trim();
    if (!clause) continue;

    const times = clause.match(TIME_RANGE);

    if (!times) {
      // "closed Mondays" carries real information even with no time range.
      if (/\bclosed\b/i.test(clause)) {
        const rest = clause.replace(/\bclosed\b/gi, ' ');
        for (const word of rest.toLowerCase().match(/[a-z]+/g) ?? []) {
          const idx = dayIndexOf(word);
          if (idx !== undefined) out[idx] = null;
        }
      }
      continue;
    }

    const open = parseClockTime(times[1]);
    const close = parseClockTime(times[2]);
    if (!open || !close) continue;

    const withoutTimes = clause.replace(TIME_RANGE, ' ');
    for (const day of daysInClause(withoutTimes)) {
      // First clause to mention a day wins, so "Mon-Sat 9-5; Sun 12-5" keeps
      // Sunday's more specific entry and does not overwrite the earlier range.
      if (!(day in out)) out[day] = { open, close };
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Single entry point for a raw `openingHours` cell: JSON if it parses, free
 * text otherwise. Returns undefined when the value carries no usable hours.
 */
export function parseOpeningHoursCell(raw: string): NormalizedOpeningHours | undefined {
  try {
    return normalizeOpeningHours(JSON.parse(raw));
  } catch {
    return parseFreeformHours(raw);
  }
}
