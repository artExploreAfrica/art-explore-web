import React, { useEffect, useMemo, useState } from "react";
import { adminApi, Pagination } from "../api";

// Mirrors prisma/schema.prisma `model Institution`. Field names here are the
// contract — see src/validators/institution.validator.ts for what is writable.
interface Institution {
  id: string;
  name: string;
  description?: string;
  type?: InstitutionType;
  address?: string;
  area?: AreaEnum;
  subArea?: string | null;
  lat?: number;
  lng?: number;
  mapUrl?: string | null;
  website?: string;
  instagram?: string | null;
  phone?: string | null;
  email?: string | null;
  openingHours?: OpeningHours | null;
  notes?: string | null;
  hasResidency?: boolean;
  hasSocial?: boolean;
  isPublished?: boolean;
  // Postgres `images String[]` — the ONLY image field on the model. There is no
  // imageUrl / coverImageUrl / logoUrl / image column; reading those was what
  // made every row render "No image".
  images?: string[];
  [key: string]: any;
}

interface Exhibition {
  id: string;
  // Prisma calls this `name`, not `title`.
  name: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  approvalStatus?: string;
  isActive?: boolean;
  [key: string]: any;
}

// Enum values come straight from prisma/schema.prisma. Sending anything else
// is rejected by z.nativeEnum() with "Invalid enum value".
type InstitutionType =
  | "ART_GALLERY"
  | "MUSEUM"
  | "INSTITUTE"
  | "FOUNDATION"
  | "STUDIO"
  | "CULTURAL_SPACE";
type AreaEnum = "ISLAND" | "MAINLAND" | "OTHER";

const INSTITUTION_TYPES: InstitutionType[] = [
  "ART_GALLERY",
  "MUSEUM",
  "INSTITUTE",
  "FOUNDATION",
  "STUDIO",
  "CULTURAL_SPACE",
];
const AREAS: AreaEnum[] = ["ISLAND", "MAINLAND", "OTHER"];

/** Mirrors MAX_IMAGE_BYTES in src/middleware/upload.ts — keep the two in step. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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
type DayHours = { open: string; close: string } | null;
type OpeningHours = Partial<Record<"0" | "1" | "2" | "3" | "4" | "5" | "6", DayHours>>;

const DAYS: { key: "0" | "1" | "2" | "3" | "4" | "5" | "6"; label: string }[] = [
  { key: "1", label: "Monday" },
  { key: "2", label: "Tuesday" },
  { key: "3", label: "Wednesday" },
  { key: "4", label: "Thursday" },
  { key: "5", label: "Friday" },
  { key: "6", label: "Saturday" },
  { key: "0", label: "Sunday" },
];

/** One row of the opening-hours editor. `recorded: false` omits the day entirely. */
interface DayRow {
  recorded: boolean;
  closed: boolean;
  open: string;
  close: string;
}

const emptyDayRow = (): DayRow => ({ recorded: false, closed: false, open: "10:00", close: "18:00" });

const emptyHours = (): Record<string, DayRow> =>
  Object.fromEntries(DAYS.map((d) => [d.key, emptyDayRow()]));

// Every key here maps onto institutionFieldsSchema. `subArea`, `mapUrl`,
// `notes`, `hasResidency` and `hasSocial` are backed by real columns as of
// migration 20260809120000_add_institution_admin_fields — before that they were
// silently discarded by the DTO whitelist, which is the bug this form caused.
const emptyForm = {
  name: "",
  description: "",
  type: "ART_GALLERY" as InstitutionType,
  address: "",
  area: "ISLAND" as AreaEnum,
  subArea: "",
  lat: "",
  lng: "",
  mapUrl: "",
  website: "",
  instagram: "",
  phone: "",
  email: "",
  notes: "",
  hasResidency: false,
  hasSocial: false,
};

type InstitutionForm = typeof emptyForm;

/** Exhibition dates come back as full ISO timestamps; show the date part only. */
function formatDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toISOString().slice(0, 10);
}

/**
 * The image contract, in one place.
 *
 * `Institution.images` is `String[]` in Postgres (prisma/schema.prisma) and the
 * admin list returns the row whole, so the array arrives verbatim. There is no
 * `imageUrl`, `coverImageUrl`, `logoUrl` or `image` column anywhere on the
 * model — reading those returned `undefined` for every institution, which is
 * what rendered the placeholder on 100% of rows regardless of the state of S3.
 *
 * Blank entries are skipped rather than returned: `<img src="">` re-requests
 * the current page and reports a load error, which would be indistinguishable
 * from a genuinely broken S3 URL. An empty string is not a URL, so it is
 * treated as absent.
 *
 * Nothing else is filtered. A stored value that is not a resolvable URL — a
 * leftover relative path from the CSV, say — is still handed to the <img> so it
 * fails visibly and is reported as broken. Hiding it would turn a data bug into
 * a silent one, which is exactly how this defect survived as long as it did.
 */
export function getImageUrl(inst: Pick<Institution, 'images'>): string | null {
  if (!Array.isArray(inst.images)) return null;
  const first = inst.images.find((url) => typeof url === 'string' && url.trim() !== '');
  return first ? first.trim() : null;
}

/** How many usable entries `images[]` holds — surfaced in the thumbnail tooltip. */
export function countImages(inst: Pick<Institution, 'images'>): number {
  if (!Array.isArray(inst.images)) return 0;
  return inst.images.filter((url) => typeof url === 'string' && url.trim() !== '').length;
}

/**
 * Turns the form into a body that satisfies the API schema.
 *
 * The two rules that matter:
 *  - lat/lng are `z.number()`, not strings — an <input> always yields a string,
 *    so they must be coerced here or the request is rejected as "Expected
 *    number, received string".
 *  - optional string fields must be OMITTED when blank, not sent as "".
 *    `website` is `z.string().url().optional()`, and "" is not a valid URL, so
 *    an empty website box was enough to 400 an otherwise fine edit.
 */
function toApiPayload(form: InstitutionForm, hours: Record<string, DayRow>): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: form.name.trim(),
    type: form.type,
    address: form.address.trim(),
    area: form.area,
    lat: Number(form.lat),
    lng: Number(form.lng),
    hasResidency: form.hasResidency,
    hasSocial: form.hasSocial,
  };

  // Optional strings: omit when blank. Sending "" fails `.url()` and `.email()`,
  // and an empty website box alone used to 400 an otherwise valid save.
  const optional: [keyof InstitutionForm, string][] = [
    ["description", "description"],
    ["subArea", "subArea"],
    ["mapUrl", "mapUrl"],
    ["website", "website"],
    ["instagram", "instagram"],
    ["phone", "phone"],
    ["email", "email"],
    ["notes", "notes"],
  ];
  for (const [key, apiKey] of optional) {
    const value = String(form[key] ?? "").trim();
    if (value) payload[apiKey] = value;
  }

  const openingHours = hoursToApi(hours);
  if (openingHours) payload.openingHours = openingHours;

  return payload;
}

/**
 * Editor rows → the API's day-indexed shape.
 *
 * Only days marked "recorded" are sent. Returns null when nothing is recorded,
 * so the key is omitted rather than sent as `{}` — on create the service writes
 * `openingHours ?? JsonNull`, and an empty object would claim we know the hours
 * are empty when we simply have not been told them.
 */
function hoursToApi(hours: Record<string, DayRow>): OpeningHours | null {
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
function hoursFromApi(value: OpeningHours | null | undefined): Record<string, DayRow> {
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

export function InstitutionsPage() {
  // allItems holds every institution across every backend page (the backend
  // only ever returns 20 at a time, so we fetch every page once up front and
  // keep the full set in memory — with ~100 galleries this is cheap, and it's
  // what lets search/filter and alphabetical sorting work across all of them
  // instead of just whatever page happened to be open).
  const [allItems, setAllItems] = useState<Institution[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [hours, setHours] = useState<Record<string, DayRow>>(emptyHours);
  // Images are read-only in this form — writes go through the separate upload
  // endpoint, so the editor shows what is stored rather than pretending to edit it.
  const [editingImages, setEditingImages] = useState<string[]>([]);
  const [geocodePaste, setGeocodePaste] = useState("");
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Image chosen in the Create form, uploaded straight after the row is created.
  const [newFile, setNewFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saveStage, setSaveStage] = useState<"creating" | "uploading" | null>(null);
  // Non-fatal outcome: the row was created but the image was not attached.
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // expandable "Manage" row state
  const [manageId, setManageId] = useState<string | null>(null);
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [exLoading, setExLoading] = useState(false);
  // Matches createExhibitionSchema: name (not title) + both dates AND both
  // times are required. The times are pre-filled with a sane default so the
  // common case is one field of typing, not four.
  const [exForm, setExForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    startTime: "10:00",
    endTime: "18:00",
  });
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Rows whose stored image URL exists but failed to load (403/404 from S3).
  // Keyed by URL, not by institution id: after an upload the row keeps its id
  // but gets a new URL, and a flag keyed by id would mark the fresh image
  // broken without ever testing it.
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  async function loadAll() {
    setLoading(true);
    setError(null);
    // Re-test every image on a refresh. Without this, a URL that failed while
    // the bucket policy was wrong stays flagged broken after it is fixed, and
    // the panel keeps reporting a problem that no longer exists.
    setBrokenImages({});
    try {
      const first = await adminApi.institutions(1);
      const totalPages = first.pagination?.totalPages || 1;
      let combined: Institution[] = first.data || [];

      if (totalPages > 1) {
        const rest = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) => adminApi.institutions(i + 2))
        );
        combined = combined.concat(...rest.map((r) => r.data || []));
      }

      setAllItems(combined);
      setPagination(first.pagination);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  // Always alphabetical by name, filtered down to whatever matches the
  // search box (matches on name, area, or sub-area so you can also type
  // a location to narrow things down).
  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? allItems.filter((inst) =>
          [inst.name, inst.area, inst.subArea, inst.address]
            .filter(Boolean)
            .some((field) => String(field).toLowerCase().includes(q))
        )
      : allItems;
    return [...filtered].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [allItems, search]);

  // Coverage across the whole catalogue, not just the filtered page.
  const imageStats = useMemo(() => {
    const withImage = allItems.filter((inst) => getImageUrl(inst) !== null);
    return {
      withImage: withImage.length,
      broken: withImage.filter((inst) => brokenImages[getImageUrl(inst)!]).length,
    };
  }, [allItems, brokenImages]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setHours(emptyHours());
    setEditingImages([]);
    setGeocodePaste("");
    setGeocodeError(null);
    setNewFile(null);
    setFileError(null);
    setNotice(null);
    setShowForm(true);
  }

  function startEdit(inst: Institution) {
    setEditingId(inst.id);
    setForm({
      name: inst.name || "",
      description: inst.description || "",
      type: (inst.type as InstitutionType) || "ART_GALLERY",
      address: inst.address || "",
      area: (inst.area as AreaEnum) || "ISLAND",
      subArea: inst.subArea || "",
      lat: inst.lat === undefined || inst.lat === null ? "" : String(inst.lat),
      lng: inst.lng === undefined || inst.lng === null ? "" : String(inst.lng),
      mapUrl: inst.mapUrl || "",
      website: inst.website || "",
      instagram: inst.instagram || "",
      phone: inst.phone || "",
      email: inst.email || "",
      notes: inst.notes || "",
      hasResidency: Boolean(inst.hasResidency),
      hasSocial: Boolean(inst.hasSocial),
    });
    setHours(hoursFromApi(inst.openingHours));
    setEditingImages(Array.isArray(inst.images) ? inst.images : []);
    setGeocodePaste("");
    setGeocodeError(null);
    setNewFile(null);
    setFileError(null);
    setNotice(null);
    setShowForm(true);
  }

  /** Paste "6.4638, 3.4342" and fill lat/lng from it. */
  function applyGeocode() {
    const parsed = parseGeocode(geocodePaste);
    if (!parsed) {
      setGeocodeError('Could not read that. Expected two numbers, e.g. "6.4638, 3.4342".');
      return;
    }
    setGeocodeError(null);
    setForm((prev) => ({ ...prev, lat: parsed.lat, lng: parsed.lng }));
    setGeocodePaste("");
  }

  function setDay(key: string, patch: Partial<DayRow>) {
    setHours((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  /**
   * Create (or update) the institution, then upload the chosen image.
   *
   * Two API calls, one user action. It has to be two: the upload endpoint is
   * POST /admin/institutions/:id/images, and there is no id until the row
   * exists. S3 needs nothing set up in advance — a key prefix springs into
   * existence with its first object, so `institutions/{newId}/…` is created
   * implicitly by the upload itself.
   *
   * The two calls are reported separately on purpose. If the row is created but
   * the image fails, the institution genuinely exists and saying "create
   * failed" would be a lie that sends the admin off to create a duplicate.
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = toApiPayload(form, hours);

      if (editingId) {
        await adminApi.updateInstitution(editingId, payload);
        setShowForm(false);
        loadAll();
        return;
      }

      setSaveStage("creating");
      const created = await adminApi.createInstitution(payload);
      const newId: string | undefined = created?.data?.id;

      if (!newFile) {
        setShowForm(false);
        loadAll();
        return;
      }

      if (!newId) {
        // Created, but the response did not carry an id, so there is nothing to
        // attach the file to. Do not retry blindly — that would duplicate the row.
        setNotice(
          `"${payload.name}" was created, but the API did not return its id, so the image was not ` +
            `uploaded. Use the Image button on the row to add it.`,
        );
        setShowForm(false);
        loadAll();
        return;
      }

      setSaveStage("uploading");
      try {
        await adminApi.uploadInstitutionImage(newId, newFile);
      } catch (uploadErr: any) {
        // The institution is real. Say so plainly, and surface the backend's own
        // message rather than a generic failure.
        setNotice(
          `"${payload.name}" was created, but the image did not upload: ${uploadErr.message}. ` +
            `The institution is saved — use the Image button on its row to try again.`,
        );
        setShowForm(false);
        loadAll();
        return;
      }

      setShowForm(false);
      loadAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
      setSaveStage(null);
    }
  }

  /** Reject oversized or non-image files here rather than via a 413 round-trip. */
  function pickNewFile(file: File | null) {
    setFileError(null);
    if (!file) {
      setNewFile(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setFileError(`"${file.name}" is not an image (${file.type || "unknown type"}).`);
      setNewFile(null);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setFileError(
        `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ` +
          `${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
      );
      setNewFile(null);
      return;
    }
    setNewFile(file);
  }

  async function handlePublish(id: string) {
    setBusyId(id);
    try {
      await adminApi.publishInstitution(id);
      loadAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    setBusyId(id);
    try {
      await adminApi.deleteInstitution(id);
      loadAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleUpload(id: string, file: File) {
    setUploadError(null);
    try {
      await adminApi.uploadInstitutionImage(id, file);
      loadAll();
    } catch (err: any) {
      // Surface the backend's own message verbatim. Do not translate it into a
      // generic string: whether this is a 400 (bad file), a 404 (wrong id) or
      // an S3 "NoSuchBucket"/"AccessDenied" is the entire diagnostic signal.
      setUploadError(err.message);
    } finally {
      setUploadTargetId(null);
      setUploadFile(null);
    }
  }

  function toggleUploadTarget(id: string) {
    setUploadTargetId((prev) => (prev === id ? null : id));
    setUploadFile(null);
    setUploadError(null);
  }

  function toggleManage(id: string) {
    if (manageId === id) {
      setManageId(null);
      return;
    }
    setManageId(id);
    setExLoading(true);
    adminApi
      .institutionExhibitions(id)
      .then((result) => setExhibitions(result.data || result))
      .catch((err) => setError(err.message))
      .finally(() => setExLoading(false));
  }

  async function handleAddExhibition(institutionId: string) {
    setError(null);
    try {
      await adminApi.createExhibition(institutionId, {
        name: exForm.name.trim(),
        startDate: exForm.startDate,
        endDate: exForm.endDate,
        startTime: exForm.startTime,
        endTime: exForm.endTime,
      });
      setExForm({ name: "", startDate: "", endDate: "", startTime: "10:00", endTime: "18:00" });
      const result = await adminApi.institutionExhibitions(institutionId);
      setExhibitions(result.data || result);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDeleteExhibition(institutionId: string, exhibitionId: string) {
    if (!confirm("Delete this exhibition?")) return;
    try {
      await adminApi.deleteExhibition(institutionId, exhibitionId);
      const result = await adminApi.institutionExhibitions(institutionId);
      setExhibitions(result.data || result);
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Institutions</h1>
        <button className="admin-btn admin-btn-primary" onClick={startCreate}>
          + New institution
        </button>
      </div>

      {showForm && (
        <form className="admin-form-card" onSubmit={handleSubmit}>
          <div className="admin-form-row">
            <label>Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="admin-form-row">
            <label>Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="admin-form-row">
            <label>Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as InstitutionType })}
              required
            >
              {INSTITUTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-form-row">
            <label>Address</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
          </div>
          <div className="admin-form-row">
            <label>Area</label>
            <select
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value as AreaEnum })}
              required
            >
              {AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-form-row">
            <label>Sub-area</label>
            <input
              placeholder="Lekki Phase 1, Ikoyi, Yaba…"
              value={form.subArea}
              onChange={(e) => setForm({ ...form, subArea: e.target.value })}
            />
          </div>

          <hr className="admin-form-divider" />
          <strong>Location</strong>

          {/* Convenience only — writes straight into the lat/lng below, which
              are the real columns. Nothing new is stored for this. */}
          <div className="admin-form-row">
            <label>Paste coordinates</label>
            <input
              placeholder="6.4638, 3.4342 — paste from Google Maps, then Apply"
              value={geocodePaste}
              onChange={(e) => setGeocodePaste(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyGeocode();
                }
              }}
            />
            <button className="admin-btn" type="button" onClick={applyGeocode} disabled={!geocodePaste.trim()}>
              Apply
            </button>
          </div>
          {geocodeError && <p className="admin-error">{geocodeError}</p>}

          <div className="admin-form-row">
            <label>Latitude</label>
            <input
              type="number"
              step="any"
              min={-90}
              max={90}
              value={form.lat}
              onChange={(e) => setForm({ ...form, lat: e.target.value })}
              required
            />
          </div>
          <div className="admin-form-row">
            <label>Longitude</label>
            <input
              type="number"
              step="any"
              min={-180}
              max={180}
              value={form.lng}
              onChange={(e) => setForm({ ...form, lng: e.target.value })}
              required
            />
          </div>
          <div className="admin-form-row">
            <label>Map URL</label>
            <input
              type="url"
              placeholder="https://maps.app.goo.gl/… (leave blank if none)"
              value={form.mapUrl}
              onChange={(e) => setForm({ ...form, mapUrl: e.target.value })}
            />
          </div>

          <hr className="admin-form-divider" />
          <strong>Contact</strong>

          <div className="admin-form-row">
            <label>Website</label>
            <input
              type="url"
              placeholder="https://example.com (leave blank if none)"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </div>
          <div className="admin-form-row">
            <label>Instagram</label>
            <input
              placeholder="@handle or profile URL"
              value={form.instagram}
              onChange={(e) => setForm({ ...form, instagram: e.target.value })}
            />
          </div>
          <div className="admin-form-row">
            <label>Phone</label>
            <input
              placeholder="+234…"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="admin-form-row">
            <label>Email</label>
            <input
              type="email"
              placeholder="hello@example.com (leave blank if none)"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <hr className="admin-form-divider" />
          <strong>Opening hours</strong>
          <p className="admin-page-note" style={{ marginTop: 0 }}>
            Tick a day to record it. Untick means “not recorded”, which is not the same as closed — leave a day
            unticked if you simply don’t know. These hours drive the public “Open Now” filter.
          </p>
          {DAYS.map(({ key, label }) => {
            const row = hours[key];
            return (
              <div className="admin-form-row" key={key}>
                <label>
                  <input
                    type="checkbox"
                    checked={row.recorded}
                    onChange={(e) => setDay(key, { recorded: e.target.checked })}
                  />{" "}
                  {label}
                </label>
                {row.recorded && (
                  <>
                    <label>
                      <input
                        type="checkbox"
                        checked={row.closed}
                        onChange={(e) => setDay(key, { closed: e.target.checked })}
                      />{" "}
                      Closed
                    </label>
                    {!row.closed && (
                      <>
                        <input
                          type="time"
                          value={row.open}
                          onChange={(e) => setDay(key, { open: e.target.value })}
                        />
                        <input
                          type="time"
                          value={row.close}
                          onChange={(e) => setDay(key, { close: e.target.value })}
                        />
                      </>
                    )}
                  </>
                )}
              </div>
            );
          })}

          <hr className="admin-form-divider" />
          <strong>Flags & internal</strong>

          <div className="admin-form-row">
            <label>
              <input
                type="checkbox"
                checked={form.hasResidency}
                onChange={(e) => setForm({ ...form, hasResidency: e.target.checked })}
              />{" "}
              Runs a residency programme
            </label>
          </div>
          <div className="admin-form-row">
            <label>
              <input
                type="checkbox"
                checked={form.hasSocial}
                onChange={(e) => setForm({ ...form, hasSocial: e.target.checked })}
              />{" "}
              Has a social presence
            </label>
          </div>
          <div className="admin-form-row">
            <label>Internal notes</label>
            <textarea
              placeholder="Not shown on the public site."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <hr className="admin-form-divider" />
          <strong>Image</strong>

          {editingId ? (
            <>
              {/* Read-only when editing: images are written by
                  POST /institutions/:id/images, not by this PUT. An editable
                  field here would imply otherwise and quietly do nothing. */}
              {editingImages.length === 0 ? (
                <p className="admin-page-note">
                  None stored. Use the <em>Image</em> button on the row to upload one.
                </p>
              ) : (
                <ul className="admin-page-note">
                  {editingImages.map((url) => (
                    <li key={url} style={{ wordBreak: "break-all" }}>
                      <a href={url} target="_blank" rel="noreferrer">
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <div className="admin-form-row">
                <label>Cover image (optional)</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => pickNewFile(e.target.files?.[0] ?? null)}
                />
              </div>
              {newFile && (
                <p className="admin-page-note" style={{ marginTop: 0 }}>
                  Selected: <strong>{newFile.name}</strong> ({(newFile.size / 1024).toFixed(0)} KB) — uploaded
                  automatically once the institution is created.
                </p>
              )}
              {fileError && <p className="admin-error">{fileError}</p>}
            </>
          )}

          <hr className="admin-form-divider" />
          <p className="admin-page-note" style={{ marginTop: 0 }}>
            Name, type, address, area, latitude and longitude are required. Sub-category and tags are writable on the
            API but have no field here yet.
          </p>
          <button className="admin-btn admin-btn-primary" type="submit" disabled={saving}>
            {saveStage === "creating"
              ? "Creating institution..."
              : saveStage === "uploading"
                ? "Uploading image..."
                : saving
                  ? "Saving..."
                  : editingId
                    ? "Save changes"
                    : newFile
                      ? "Create institution + upload image"
                      : "Create institution"}
          </button>
          <button className="admin-btn" type="button" onClick={() => setShowForm(false)}>
            Cancel
          </button>
        </form>
      )}

      {error && <p className="admin-error">{error}</p>}
      {uploadError && <p className="admin-error">Image upload failed: {uploadError}</p>}
      {/* Partial success: the row exists, the image did not attach. Deliberately
          not styled as an error — calling this a failure would send the admin
          off to create a second copy of an institution that already saved. */}
      {notice && (
        <p className="admin-page-note" style={{ borderLeft: "3px solid #d9a441", paddingLeft: 10 }}>
          {notice}{" "}
          <button className="admin-btn" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </p>
      )}

      <div className="admin-search-bar">
        <input
          type="text"
          placeholder="Search institutions by name, area, or sub-area..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button className="admin-btn" onClick={() => setSearch("")}>
            Clear
          </button>
        )}
        <span className="admin-search-count">
          {loading
            ? "Loading..."
            : `Showing ${visibleItems.length} of ${allItems.length} total (sorted A–Z)`}
        </span>
      </div>

      {/*
        Image coverage at a glance. This is the number that actually answers
        "is the image pipeline working?" — a row count of stored URLs, separate
        from how many of them the browser could fetch. Reading it off the table
        by eye across ~100 rows is not realistic.
      */}
      {!loading && (
        <p className="admin-page-note">
          Images: {imageStats.withImage} of {allItems.length} institution(s) have a URL stored
          {imageStats.broken > 0 && ` · ${imageStats.broken} stored URL(s) failed to load`}
          {imageStats.withImage === 0 &&
            " — nothing has been synced yet, so every row correctly shows “No image”."}
        </p>
      )}

      {loading && <p>Loading...</p>}

      {!loading && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Name</th>
              <th>Location</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => {
              const imgUrl = getImageUrl(item);
              const imageCount = countImages(item);
              return (
                <React.Fragment key={item.id}>
                  <tr>
                    <td>
                      {/*
                        Three distinct states, deliberately never collapsed into
                        one placeholder:

                          images[] empty        → "No image"          (nothing stored — expected for most rows)
                          URL stored, loaded    → the thumbnail
                          URL stored, 403/404   → "Image URL broken"  (S3 or data problem)

                        The original code hid a failed <img> with
                        display:none, which made a broken S3 URL look identical
                        to an institution that simply has no photo. Those are
                        different bugs owned by different people, and telling
                        them apart is the whole point of this cell.
                      */}
                      {imgUrl ? (
                        brokenImages[imgUrl] ? (
                          <div
                            className="admin-thumb-placeholder"
                            title={`Stored URL did not load (403/404?):\n${imgUrl}`}
                          >
                            Image URL broken
                          </div>
                        ) : (
                          <img
                            className="admin-thumb"
                            src={imgUrl}
                            alt={item.name}
                            loading="lazy"
                            title={
                              imageCount > 1
                                ? `${imageCount} images stored. Showing the first:\n${imgUrl}`
                                : imgUrl
                            }
                            onError={() =>
                              setBrokenImages((prev) => ({ ...prev, [imgUrl]: true }))
                            }
                          />
                        )
                      ) : (
                        <div
                          className="admin-thumb-placeholder"
                          title="images[] is empty for this institution — nothing has been uploaded or synced yet."
                        >
                          No image
                        </div>
                      )}
                    </td>
                    <td>{item.name}</td>
                    <td>{[item.area, item.subArea].filter(Boolean).join(" · ") || "—"}</td>
                    <td>
                      <span className={`admin-badge ${item.isPublished ? "admin-badge-success" : "admin-badge-neutral"}`}>
                        {item.isPublished ? "Published" : "Unpublished"}
                      </span>
                    </td>
                    <td>
                      <button className="admin-btn" onClick={() => startEdit(item)}>
                        Edit
                      </button>
                      {!item.isPublished && (
                        <button className="admin-btn admin-btn-success" disabled={busyId === item.id} onClick={() => handlePublish(item.id)}>
                          Publish
                        </button>
                      )}
                      <button className="admin-btn" onClick={() => toggleUploadTarget(item.id)}>
                        Image
                      </button>
                      <button className="admin-btn" onClick={() => toggleManage(item.id)}>
                        Manage
                      </button>
                      <button className="admin-btn admin-btn-danger" disabled={busyId === item.id} onClick={() => handleDelete(item.id, item.name)}>
                        Delete
                      </button>
                    </td>
                  </tr>

                  {uploadTargetId === item.id && (
                    <tr className="admin-detail-row">
                      <td colSpan={5}>
                        <div className="admin-form-row">
                          <label>Upload a new cover image</label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                          />
                          <button
                            className="admin-btn admin-btn-primary"
                            type="button"
                            disabled={!uploadFile || busyId === item.id}
                            onClick={() => uploadFile && handleUpload(item.id, uploadFile)}
                          >
                            Submit
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {manageId === item.id && (
                    <tr className="admin-detail-row">
                      <td colSpan={5}>
                        <strong>Exhibitions</strong>
                        {exLoading && <p>Loading exhibitions...</p>}
                        {!exLoading && exhibitions.length === 0 && <p className="admin-page-note">No exhibitions yet.</p>}
                        {!exLoading && exhibitions.length > 0 && (
                          <ul>
                            {exhibitions.map((ex) => (
                              <li key={ex.id}>
                                {ex.name}{" "}
                                {ex.startDate
                                  ? `(${formatDate(ex.startDate)}${ex.endDate ? ` – ${formatDate(ex.endDate)}` : ""})`
                                  : ""}{" "}
                                {ex.approvalStatus && ex.approvalStatus !== "APPROVED" && (
                                  <span className="admin-badge admin-badge-neutral">{ex.approvalStatus}</span>
                                )}{" "}
                                <button className="admin-btn admin-btn-danger" onClick={() => handleDeleteExhibition(item.id, ex.id)}>
                                  Delete
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="admin-form-row">
                          <label>New exhibition name</label>
                          <input value={exForm.name} onChange={(e) => setExForm({ ...exForm, name: e.target.value })} />
                        </div>
                        <div className="admin-form-row">
                          <label>Start date</label>
                          <input type="date" value={exForm.startDate} onChange={(e) => setExForm({ ...exForm, startDate: e.target.value })} />
                        </div>
                        <div className="admin-form-row">
                          <label>End date</label>
                          <input type="date" value={exForm.endDate} onChange={(e) => setExForm({ ...exForm, endDate: e.target.value })} />
                        </div>
                        <div className="admin-form-row">
                          <label>Opening time</label>
                          <input type="time" value={exForm.startTime} onChange={(e) => setExForm({ ...exForm, startTime: e.target.value })} />
                        </div>
                        <div className="admin-form-row">
                          <label>Closing time</label>
                          <input type="time" value={exForm.endTime} onChange={(e) => setExForm({ ...exForm, endTime: e.target.value })} />
                        </div>
                        <button
                          className="admin-btn admin-btn-primary"
                          disabled={!exForm.name.trim() || !exForm.startDate || !exForm.endDate}
                          onClick={() => handleAddExhibition(item.id)}
                        >
                          Add exhibition
                        </button>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
