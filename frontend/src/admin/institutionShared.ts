// Shared between InstitutionsPage.tsx (direct create/edit) and
// SubmitInstitutionPage.tsx (submit-for-approval create/edit) — kept in one
// place so the two forms can't quietly drift apart on field shape/behaviour.

// Enum values come straight from prisma/schema.prisma. Sending anything else
// is rejected by z.nativeEnum() with "Invalid enum value".
export type InstitutionType =
  | "ART_GALLERY"
  | "MUSEUM"
  | "INSTITUTE"
  | "FOUNDATION"
  | "STUDIO"
  | "CULTURAL_SPACE";
export type AreaEnum = "ISLAND" | "MAINLAND" | "OTHER";

export const INSTITUTION_TYPES: InstitutionType[] = [
  "ART_GALLERY",
  "MUSEUM",
  "INSTITUTE",
  "FOUNDATION",
  "STUDIO",
  "CULTURAL_SPACE",
];
export const AREAS: AreaEnum[] = ["ISLAND", "MAINLAND", "OTHER"];

/** Mirrors MAX_IMAGE_BYTES in src/middleware/upload.ts — keep the two in step. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Opening hours, keyed by JavaScript day index so the client can index it with
 * `Date.prototype.getDay()`. `null` for a day means closed. A day that is
 * absent entirely means "not recorded", which is not the same thing.
 *
 * The backend schema is `.strict()` — only keys "0".."6" are accepted, and each
 * time must match /^([01]\d|2[0-3]):[0-5]\d$/. The old freeform
 * `{ "mon": "9am-5pm" }` shape is rejected outright; that unparseable format is
 * what made the public "Open Now" filter inert.
 */
export type DayHours = { open: string; close: string } | null;
export type OpeningHours = Partial<Record<"0" | "1" | "2" | "3" | "4" | "5" | "6", DayHours>>;

export const DAYS: { key: "0" | "1" | "2" | "3" | "4" | "5" | "6"; label: string }[] = [
  { key: "1", label: "Monday" },
  { key: "2", label: "Tuesday" },
  { key: "3", label: "Wednesday" },
  { key: "4", label: "Thursday" },
  { key: "5", label: "Friday" },
  { key: "6", label: "Saturday" },
  { key: "0", label: "Sunday" },
];

/** One row of the opening-hours editor. `recorded: false` omits the day entirely. */
export interface DayRow {
  recorded: boolean;
  closed: boolean;
  open: string;
  close: string;
}

export const emptyDayRow = (): DayRow => ({
  recorded: false,
  closed: false,
  open: "10:00",
  close: "18:00",
});

export const emptyHours = (): Record<string, DayRow> =>
  Object.fromEntries(DAYS.map((d) => [d.key, emptyDayRow()]));

/**
 * Editor rows → the API's day-indexed shape.
 *
 * Only days marked "recorded" are sent. Returns null when nothing is recorded,
 * so the key is omitted rather than sent as `{}` — on create the service writes
 * `openingHours ?? JsonNull`, and an empty object would claim we know the hours
 * are empty when we simply have not been told them.
 */
export function hoursToApi(hours: Record<string, DayRow>): OpeningHours | null {
  const out: OpeningHours = {};
  let any = false;

  for (const { key } of DAYS) {
    const row = hours[key];
    if (!row?.recorded) continue;
    any = true;
    out[key] = row.closed ? null : { open: row.open, close: row.close };
  }

  return any ? out : null;
}

/** Stored value → editor rows. */
export function hoursFromApi(value: OpeningHours | null | undefined): Record<string, DayRow> {
  const rows = emptyHours();
  if (!value || typeof value !== "object") return rows;

  for (const { key } of DAYS) {
    if (!(key in value)) continue;
    const day = value[key];
    rows[key] = day
      ? { recorded: true, closed: false, open: day.open, close: day.close }
      : { recorded: true, closed: true, open: "10:00", close: "18:00" };
  }
  return rows;
}

/**
 * Accepts a coordinate pair pasted straight out of Google Maps and splits it.
 * Handles "6.4638, 3.4342", "6.4638,3.4342" and "6.4638 3.4342". Returns null
 * when it cannot parse cleanly rather than guessing — a silently wrong pin is
 * worse than an unchanged field.
 */
export function parseGeocode(input: string): { lat: string; lng: string } | null {
  const parts = input.trim().split(/[,\s]+/).filter(Boolean);
  if (parts.length !== 2) return null;

  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat: String(lat), lng: String(lng) };
}

/** Mirrors prisma/schema.prisma `model Tag`. */
export interface Tag {
  id: string;
  name: string;
  label: string;
  category: string;
}

/** Mirrors prisma/schema.prisma `model SubCategory`. */
export interface SubCategory {
  id: string;
  name: string;
  type: InstitutionType;
  description?: string;
}
