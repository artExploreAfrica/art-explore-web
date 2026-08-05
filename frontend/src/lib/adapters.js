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
//   type         -> artTypes ([base type] + "exhibition" when hasExhibition)
//   images[]     -> image    (first image, or null -> card shows initials)
//   address      -> neighborhood (derived; backend has no neighborhood field)
//   (none)       -> rating   (GAP: backend has no rating — see FRONTEND_INTEGRATION.md)
//   openingHours -> hours    (GAP: shapes incompatible — left null for now)

const AREA_TO_REGION = {
  ISLAND: 'Island',
  MAINLAND: 'Mainland',
  OTHER: 'Other',
};

// Each backend type maps to ONE base artType keyword the UI tabs filter on.
// Tabs match: galleries=["gallery"], exhibitions=["exhibition"],
//             artists=["artist","studio"], events=["event","performance","fair"].
// Adjust these freely — they are pure UI categorization, not backend truth.
const TYPE_TO_ARTTYPE = {
  ART_GALLERY: 'gallery',
  MUSEUM: 'gallery',
  INSTITUTE: 'gallery',
  FOUNDATION: 'gallery',
  STUDIO: 'studio',
  CULTURAL_SPACE: 'event',
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

  const artTypes = [TYPE_TO_ARTTYPE[inst.type] ?? 'gallery'];
  if (inst.hasExhibition) artTypes.push('exhibition');

  return {
    id: inst.id,
    name: inst.name,
    address: inst.address,
    lat: inst.lat,
    lng: inst.lng,
    region,
    neighborhood: deriveNeighborhood(inst.address, region),
    artTypes: [...new Set(artTypes)],
    image: inst.images?.[0] ?? null,
    rating: null, // GAP: no backend rating field yet.
    hours: null, // GAP: openingHours shape differs; "Open Now" disabled.

    // Carried through untouched for detail views / future use.
    description: inst.description ?? null,
    website: inst.website ?? null,
    phone: inst.phone ?? null,
    email: inst.email ?? null,
    tags: inst.tags ?? [],
    type: inst.type,
    openingHours: inst.openingHours ?? null,
  };
}

/** Map a list of institutions. */
export function adaptInstitutions(list = []) {
  return list.map(adaptInstitution);
}
