// Adapters: translate a backend Institution into the shape the existing UI
// components already expect (the old `galleries.js` mock shape).
//
// Keeping the UI's field names means the components don't have to change much —
// only the data SOURCE changes (mock array -> API + this adapter).
//
// ── Field-by-field mapping (backend -> frontend) ───────────────────────────
//   id           id (was a number, now a cuid string — used only as a React key)
//   name         name
//   address      address
//   lat / lng    lat / lng
//   area         -> region   ("ISLAND" -> "Island", etc.)
//   type         -> type + typeLabel ("HUB_INSTITUTION" -> "Art Hub/Institution")
//   images[]     -> image    (first image, or null -> card shows initials)
//   address      -> neighborhood (derived; backend has no neighborhood field)
//   rating       -> rating       (aggregate; null until a review is approved)
//   reviewCount  -> reviewCount  (0 until a review is approved)
//   openingHours -> hours    (GAP: shapes incompatible — left null for now)

import { formatInstitutionType } from '../admin/institutionShared';

const AREA_TO_REGION = {
  ISLAND: 'Island',
  MAINLAND: 'Mainland',
  OTHER: 'Other',
};

/** Best-effort neighborhood from an address like "12 X Rd, Lekki Phase I, Lagos". */
function deriveNeighborhood(address, region) {
  if (!address) return region;
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  // Drop a trailing "Lagos" if present, then take the last remaining segment.
  const trimmed = parts.filter((p) => p.toLowerCase() !== 'lagos');
  return trimmed.length >= 2 ? trimmed[trimmed.length - 1] : trimmed[0] || region;
}

/** Map a single backend institution to the UI gallery shape. */
export function adaptInstitution(inst) {
  const region = AREA_TO_REGION[inst.area] ?? 'Other';

  return {
    id: inst.id,
    name: inst.name,
    address: inst.address,
    lat: inst.lat,
    lng: inst.lng,
    region,
    neighborhood: deriveNeighborhood(inst.address, region),
    typeLabel: formatInstitutionType(inst.type),
    hasExhibition: Boolean(inst.hasExhibition),
    image: inst.images?.[0] ?? null,
    // The backend does expose an aggregate rating and a review
    // count on the institution row; both are null/0 until a
    // review is approved for that venue.
    rating: inst.rating ?? null,
    reviewCount: inst.reviewCount ?? 0,
    hours: null, // GAP: openingHours shape differs; "Open Now" disabled.

    // Carried through untouched for detail views / future use.
    subArea: inst.subArea ?? null,
    description: inst.description ?? null,
    website: inst.website ?? null,
    instagram: inst.instagram ?? null,
    phone: inst.phone ?? null,
    email: inst.email ?? null,
    mapUrl: inst.mapUrl ?? null,
    hasResidency: Boolean(inst.hasResidency),
    tags: inst.tags ?? [],
    type: inst.type,
    subType: inst.subType ?? null,
    openingHours: inst.openingHours ?? null,
  };
}

// A neighbourhood is only worth showing if it narrows things down: the
// sheet's sub_area sometimes just restates the area ("Mainland"), and the
// address-derived one can be a postcode line ("Lagos 106104") or a note.
const isVaguePlace = (s) =>
  !s ||
  /\d|\(|nigeria|not available|confirmed/i.test(s) ||
  ['island', 'mainland', 'other', 'lagos'].includes(s.toLowerCase());

/**
 * The most specific place name for a venue: sub_area from the sheet, else the
 * neighbourhood from its address (postcode dropped), else the region.
 */
export function placeOf(g) {
  if (!isVaguePlace(g.subArea)) return g.subArea;
  const fromAddress = g.neighborhood?.replace(/\s+\d{5,6}$/, '');
  if (!isVaguePlace(fromAddress)) return fromAddress;
  return g.subArea || g.region;
}

/** Map a list of institutions. */
export function adaptInstitutions(list = []) {
  return list.map(adaptInstitution);
}
