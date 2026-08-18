import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  SlidersHorizontal,
  X,
  Pencil,
  Trash2,
  ImagePlus,
  CalendarRange,
  CheckCircle2,
  Building2,
  SearchX,
  AlertCircle,
  Info,
  MapPin,
  Phone,
  Clock,
  SlidersHorizontal as FlagsIcon,
  ImageIcon,
  UploadCloud,
  FileCheck2,
  Star,
} from "lucide-react";
import { adminApi, Pagination } from "../api";
import {
  AREAS,
  AreaEnum,
  DAYS,
  DayRow,
  emptyHours,
  formatInstitutionType,
  hoursFromApi,
  hoursToApi,
  INSTITUTION_TYPES,
  InstitutionType,
  MAX_IMAGE_BYTES,
  OpeningHours,
  parseGeocode,
  Tag,
} from "../institutionShared";

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
  // `listForAdmin` includes tags on every row (see institution.service.ts).
  tags?: { id: string; name: string }[];
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

/** Skeleton rows shown while the catalogue is loading, shaped like the real table
 * so the layout doesn't jump once data arrives. */
function TableSkeleton() {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Institution</th>
            <th>Location</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }, (_, i) => (
            <tr key={i}>
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="admin-skeleton-row" style={{ width: 44, height: 44, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="admin-skeleton-row" style={{ width: "60%", height: 12, marginBottom: 6 }} />
                    <div className="admin-skeleton-row" style={{ width: "35%", height: 10 }} />
                  </div>
                </div>
              </td>
              <td><div className="admin-skeleton-row" style={{ width: "70%", height: 12 }} /></td>
              <td><div className="admin-skeleton-row" style={{ width: 70, height: 18, borderRadius: 999 }} /></td>
              <td><div className="admin-skeleton-row" style={{ width: 120, height: 26 }} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InstitutionsPage() {
  // allItems holds every institution across every backend page (the backend
  // only ever returns 20 at a time, so we fetch every page once up front and
  // keep the full set in memory — with ~100 galleries this is cheap, and it's
  // what lets search/filter and alphabetical sorting work across all of them
  // instead of just whatever page happened to be open).
  const [allItems, setAllItems] = useState<Institution[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  // Every defined tag, for the filter dropdown — deliberately not derived from
  // allItems: there is no UI yet to attach tags to an institution, so scanning
  // institutions for their tags would always come up empty.
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterArea, setFilterArea] = useState<AreaEnum | "">("");
  const [filterSubArea, setFilterSubArea] = useState("");
  const [filterTagId, setFilterTagId] = useState("");
  const [filterType, setFilterType] = useState<InstitutionType | "">("");
  const [filterStatus, setFilterStatus] = useState<"" | "published" | "unpublished">("");
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
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  // Cover-change is keyed by image URL so the button that was clicked can show
  // its own "Setting..." state without disabling the whole row.
  const [coverBusyUrl, setCoverBusyUrl] = useState<string | null>(null);
  const [deleteBusyUrl, setDeleteBusyUrl] = useState<string | null>(null);
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

  async function loadAllTags() {
    try {
      const first = await adminApi.tags(1);
      const totalPages = first.pagination?.totalPages || 1;
      let combined: Tag[] = first.data || [];

      if (totalPages > 1) {
        const rest = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) => adminApi.tags(i + 2))
        );
        combined = combined.concat(...rest.map((r) => r.data || []));
      }

      setAllTags(combined);
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadAll();
    loadAllTags();
  }, []);

  // Distinct sub-areas actually present in the loaded catalogue, so the
  // filter only ever offers choices that can return a result.
  const subAreaOptions = useMemo(() => {
    const values = new Set<string>();
    allItems.forEach((inst) => {
      if (inst.subArea) values.add(inst.subArea);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [allItems]);

  // Sourced from allTags (every tag that exists), not from allItems' attached
  // tags — there is no admin UI yet to attach a tag to an institution, so the
  // latter would always be empty. Grouped by category to match TagsPage.tsx.
  const tagOptionsByCategory = useMemo(() => {
    const byCategory = new Map<string, Tag[]>();
    allTags.forEach((tag) => {
      const list = byCategory.get(tag.category) || [];
      list.push(tag);
      byCategory.set(tag.category, list);
    });
    byCategory.forEach((list) => list.sort((a, b) => a.label.localeCompare(b.label)));
    return Array.from(byCategory, ([category, tags]) => ({ category, tags })).sort((a, b) =>
      a.category.localeCompare(b.category),
    );
  }, [allTags]);

  const activeFilterCount = [filterArea, filterSubArea, filterTagId, filterType, filterStatus].filter(
    Boolean,
  ).length;

  function clearFilters() {
    setFilterArea("");
    setFilterSubArea("");
    setFilterTagId("");
    setFilterType("");
    setFilterStatus("");
  }

  // Always alphabetical by name, filtered down to whatever matches the
  // search box (matches on name, area, or sub-area so you can also type
  // a location to narrow things down) and whichever filters are set.
  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = allItems.filter((inst) => {
      if (q) {
        const matchesSearch = [inst.name, inst.area, inst.subArea, inst.address]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }
      if (filterArea && inst.area !== filterArea) return false;
      if (filterSubArea && inst.subArea !== filterSubArea) return false;
      if (filterTagId && !(inst.tags || []).some((t) => t.id === filterTagId)) return false;
      if (filterType && inst.type !== filterType) return false;
      if (filterStatus === "published" && !inst.isPublished) return false;
      if (filterStatus === "unpublished" && inst.isPublished) return false;
      return true;
    });
    return [...filtered].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [allItems, search, filterArea, filterSubArea, filterTagId, filterType, filterStatus]);

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

  /**
   * Uploads are sent one at a time, not via Promise.all: the backend appends
   * to `images[]` with a read-modify-write (see addImage in
   * institution.service.ts), so two concurrent uploads for the same
   * institution can race and silently drop one image.
   */
  async function handleUpload(id: string, files: File[]) {
    setUploadError(null);
    setUploadBusy(true);
    try {
      for (const file of files) {
        // eslint-disable-next-line no-await-in-loop
        await adminApi.uploadInstitutionImage(id, file);
      }
      loadAll();
    } catch (err: any) {
      // Surface the backend's own message verbatim. Do not translate it into a
      // generic string: whether this is a 400 (bad file), a 404 (wrong id) or
      // an S3 "NoSuchBucket"/"AccessDenied" is the entire diagnostic signal.
      setUploadError(err.message);
      // Refresh anyway: earlier files in the batch may have already attached.
      loadAll();
    } finally {
      setUploadBusy(false);
      setUploadFiles([]);
    }
  }

  async function handleSetCover(id: string, url: string) {
    setUploadError(null);
    setCoverBusyUrl(url);
    try {
      await adminApi.setInstitutionCoverImage(id, url);
      loadAll();
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setCoverBusyUrl(null);
    }
  }

  async function handleDeleteImage(id: string, url: string) {
    if (!confirm("Delete this image? This can't be undone.")) return;
    setUploadError(null);
    setDeleteBusyUrl(url);
    try {
      await adminApi.removeInstitutionImage(id, url);
      loadAll();
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setDeleteBusyUrl(null);
    }
  }

  function toggleUploadTarget(id: string) {
    setUploadTargetId((prev) => (prev === id ? null : id));
    setUploadFiles([]);
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

  const formCard = !showForm ? null : (
    <form className="admin-form-card" onSubmit={handleSubmit}>
      <div className="admin-form-section">
        <div className="admin-form-section-head">
          <Info size={16} />
          <div>
            <h3>Basic details</h3>
            <p>What it's called and how it's classified.</p>
          </div>
        </div>
        <div className="admin-form-row">
          <label className="admin-required">Name</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="admin-form-row">
          <label>Description <span className="admin-optional">(optional)</span></label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="admin-form-grid">
          <div className="admin-form-row">
            <label className="admin-required">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as InstitutionType })}
              required
            >
              {INSTITUTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {formatInstitutionType(t)}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-form-row">
            <label className="admin-required">Area</label>
            <select
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value as AreaEnum })}
              required
            >
              {AREAS.map((a) => (
                <option key={a} value={a}>
                  {a.charAt(0) + a.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="admin-form-row">
          <label className="admin-required">Address</label>
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
        </div>
        <div className="admin-form-row">
          <label>Sub-area <span className="admin-optional">(optional)</span></label>
          <input
            placeholder="Lekki Phase 1, Ikoyi, Yaba…"
            value={form.subArea}
            onChange={(e) => setForm({ ...form, subArea: e.target.value })}
          />
        </div>
      </div>

      <div className="admin-form-section">
        <div className="admin-form-section-head">
          <MapPin size={16} />
          <div>
            <h3>Location</h3>
            <p>Coordinates that place it on the map.</p>
          </div>
        </div>

        {/* Convenience only — writes straight into the lat/lng below, which
            are the real columns. Nothing new is stored for this. */}
        <div className="admin-form-row">
          <label>Paste coordinates</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ flex: 1 }}
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
        </div>
        {geocodeError && (
          <p className="admin-error"><AlertCircle size={14} />{geocodeError}</p>
        )}

        <div className="admin-form-grid">
          <div className="admin-form-row">
            <label className="admin-required">Latitude</label>
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
            <label className="admin-required">Longitude</label>
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
        </div>
        <div className="admin-form-row">
          <label>Map URL <span className="admin-optional">(optional)</span></label>
          <input
            type="url"
            placeholder="https://maps.app.goo.gl/… (leave blank if none)"
            value={form.mapUrl}
            onChange={(e) => setForm({ ...form, mapUrl: e.target.value })}
          />
        </div>
      </div>

      <div className="admin-form-section">
        <div className="admin-form-section-head">
          <Phone size={16} />
          <div>
            <h3>Contact</h3>
            <p>All optional — fill in whatever the venue has.</p>
          </div>
        </div>
        <div className="admin-form-grid">
          <div className="admin-form-row">
            <label>Website</label>
            <input
              type="url"
              placeholder="https://example.com"
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
              placeholder="hello@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="admin-form-section">
        <div className="admin-form-section-head">
          <Clock size={16} />
          <div>
            <h3>Opening hours</h3>
            <p>Tick a day to record it — untick means "not recorded", not closed. Drives the public "Open Now" filter.</p>
          </div>
        </div>
        <div className="admin-hours-grid">
          {DAYS.map(({ key, label }) => {
            const row = hours[key];
            return (
              <div className="admin-hours-row" key={key}>
                <label className="admin-hours-day">
                  <input
                    type="checkbox"
                    checked={row.recorded}
                    onChange={(e) => setDay(key, { recorded: e.target.checked })}
                  />
                  {label}
                </label>
                {row.recorded && (
                  <>
                    <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input
                        type="checkbox"
                        checked={row.closed}
                        onChange={(e) => setDay(key, { closed: e.target.checked })}
                      />
                      Closed
                    </label>
                    {!row.closed && (
                      <>
                        <input
                          type="time"
                          value={row.open}
                          onChange={(e) => setDay(key, { open: e.target.value })}
                        />
                        <span style={{ color: "var(--ae-muted)" }}>–</span>
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
        </div>
      </div>

      <div className="admin-form-section">
        <div className="admin-form-section-head">
          <FlagsIcon size={16} />
          <div>
            <h3>Flags &amp; internal</h3>
            <p>Notes here are internal — never shown on the public site.</p>
          </div>
        </div>
        <div className="admin-form-grid" style={{ marginBottom: 12 }}>
          <div className="admin-checkbox-row">
            <label>
              <input
                type="checkbox"
                checked={form.hasResidency}
                onChange={(e) => setForm({ ...form, hasResidency: e.target.checked })}
              />
              Runs a residency programme
            </label>
          </div>
          <div className="admin-checkbox-row">
            <label>
              <input
                type="checkbox"
                checked={form.hasSocial}
                onChange={(e) => setForm({ ...form, hasSocial: e.target.checked })}
              />
              Has a social presence
            </label>
          </div>
        </div>
        <div className="admin-form-row">
          <label>Internal notes</label>
          <textarea
            placeholder="Not shown on the public site."
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
      </div>

      <div className="admin-form-section">
        <div className="admin-form-section-head">
          <ImageIcon size={16} />
          <div>
            <h3>Photo</h3>
            <p>{editingId ? "Managed from the row's Image action, not here." : "Attached automatically once the institution is created."}</p>
          </div>
        </div>

        {editingId ? (
          <>
            {/* Read-only when editing: images are written by
                POST /institutions/:id/images, not by this PUT. An editable
                field here would imply otherwise and quietly do nothing. */}
            {editingImages.length === 0 ? (
              <p className="admin-page-note" style={{ marginTop: 0 }}>
                None stored. Use the <em>Image</em> action on the row to upload one.
              </p>
            ) : (
              <div className="admin-cover-picker" style={{ marginTop: 0 }}>
                {editingImages.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" title={url}>
                    <img src={url} alt="" className="admin-thumb" style={{ width: 64, height: 64 }} />
                  </a>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <label className="admin-dropzone">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => pickNewFile(e.target.files?.[0] ?? null)}
              />
              <UploadCloud size={22} />
              <p className="admin-dropzone-label">Click to choose a cover image</p>
              <p className="admin-dropzone-hint">JPG, PNG, WEBP or GIF — up to {MAX_IMAGE_BYTES / 1024 / 1024} MB</p>
            </label>
            {newFile && (
              <div className="admin-file-picked">
                <FileCheck2 size={16} />
                <span>{newFile.name} ({(newFile.size / 1024).toFixed(0)} KB)</span>
              </div>
            )}
            {fileError && <p className="admin-error"><AlertCircle size={14} />{fileError}</p>}
          </>
        )}
      </div>

      <p className="admin-form-footnote">
        Fields marked * are required. Sub-category and tags are writable on the API but have no field here yet.
      </p>
      <div className="admin-form-actions">
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
      </div>
    </form>
  );

  return (
    <div>
      <div className="admin-page-header">
        <div className="admin-page-header-text">
          <h1 className="admin-page-title">Institutions</h1>
          <p className="admin-page-subtitle">
            {loading ? "Loading catalogue…" : `${allItems.length} institution${allItems.length === 1 ? "" : "s"} in the catalogue`}
          </p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={startCreate}>
          <Plus size={15} />
          New institution
        </button>
      </div>

      {!editingId && formCard}

      {error && <p className="admin-error"><AlertCircle size={16} />{error}</p>}
      {uploadError && <p className="admin-error"><AlertCircle size={16} />Image upload failed: {uploadError}</p>}
      {/* Partial success: the row exists, the image did not attach. Deliberately
          not styled as an error — calling this a failure would send the admin
          off to create a second copy of an institution that already saved. */}
      {notice && (
        <p className="admin-notice">
          <Info size={16} />
          <span>
            {notice}{" "}
            <button className="admin-btn admin-btn-sm" style={{ marginLeft: 6 }} onClick={() => setNotice(null)}>
              Dismiss
            </button>
          </span>
        </p>
      )}

      <div className="admin-search-bar">
        <div className="admin-search-input-wrap">
          <Search size={15} />
          <input
            type="text"
            placeholder="Search by name, area, or sub-area..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {search && (
          <button className="admin-btn admin-btn-sm" onClick={() => setSearch("")}>
            <X size={13} />
            Clear
          </button>
        )}
        <button
          className={`admin-btn${activeFilterCount > 0 ? " admin-btn-primary" : ""}`}
          onClick={() => setShowFilters((v) => !v)}
        >
          <SlidersHorizontal size={14} />
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </button>
        {!loading && (
          <span className="admin-search-count">
            Showing {visibleItems.length} of {allItems.length}
          </span>
        )}
      </div>

      {showFilters && (
        <div className="admin-filter-panel">
          <div className="admin-filter-row">
            <label>Sub-area</label>
            <select value={filterSubArea} onChange={(e) => setFilterSubArea(e.target.value)}>
              <option value="">All</option>
              {subAreaOptions.map((sa) => (
                <option key={sa} value={sa}>
                  {sa}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-filter-row">
            <label>Tag</label>
            <select value={filterTagId} onChange={(e) => setFilterTagId(e.target.value)}>
              <option value="">All</option>
              {tagOptionsByCategory.map(({ category, tags }) => (
                <optgroup key={category} label={category.charAt(0) + category.slice(1).toLowerCase()}>
                  {tags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="admin-filter-row">
            <label>Location</label>
            <select value={filterArea} onChange={(e) => setFilterArea(e.target.value as AreaEnum | "")}>
              <option value="">All</option>
              {AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-filter-row">
            <label>Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as "" | "published" | "unpublished")}
            >
              <option value="">All</option>
              <option value="published">Published</option>
              <option value="unpublished">Unpublished</option>
            </select>
          </div>
          <div className="admin-filter-row">
            <label>Type</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value as InstitutionType | "")}>
              <option value="">All</option>
              {INSTITUTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {formatInstitutionType(t)}
                </option>
              ))}
            </select>
          </div>
          <button className="admin-btn" type="button" disabled={activeFilterCount === 0} onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      )}

      {loading && <TableSkeleton />}

      {!loading && visibleItems.length === 0 && (
        <div className="admin-empty-state">
          {allItems.length === 0 ? (
            <>
              <Building2 size={40} strokeWidth={1.4} />
              <p className="admin-empty-state-title">No institutions yet</p>
              <p className="admin-empty-state-body">Add the first gallery, museum, or cultural space to get the catalogue started.</p>
              <button className="admin-btn admin-btn-primary" onClick={startCreate}>
                <Plus size={15} />
                New institution
              </button>
            </>
          ) : (
            <>
              <SearchX size={40} strokeWidth={1.4} />
              <p className="admin-empty-state-title">No matches</p>
              <p className="admin-empty-state-body">Nothing matches your search and filters. Try clearing them.</p>
              <button
                className="admin-btn"
                onClick={() => {
                  setSearch("");
                  clearFilters();
                }}
              >
                Clear search &amp; filters
              </button>
            </>
          )}
        </div>
      )}

      {!loading && visibleItems.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Institution</th>
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
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {/*
                            Three distinct states, deliberately never collapsed into
                            one placeholder:

                              images[] empty        → building icon  (nothing stored — expected for most rows)
                              URL stored, loaded    → the thumbnail
                              URL stored, 403/404   → alert icon     (S3 or data problem)

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
                                <AlertCircle size={16} />
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
                              <Building2 size={16} />
                            </div>
                          )}
                          <div>
                            <span className="admin-table-name">{item.name}</span>
                            {item.type && (
                              <span className="admin-table-sub">{formatInstitutionType(item.type)}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{[item.area && (item.area.charAt(0) + item.area.slice(1).toLowerCase()), item.subArea].filter(Boolean).join(" · ") || "—"}</td>
                      <td>
                        <span className={`admin-badge ${item.isPublished ? "admin-badge-success" : "admin-badge-neutral"}`}>
                          <span className="admin-badge-dot" />
                          {item.isPublished ? "Published" : "Unpublished"}
                        </span>
                      </td>
                      <td>
                        <div className="admin-row-actions">
                          <button className="admin-btn admin-btn-sm" onClick={() => startEdit(item)}>
                            <Pencil size={13} />
                            Edit
                          </button>
                          {!item.isPublished && (
                            <button
                              className="admin-icon-btn"
                              title="Publish"
                              disabled={busyId === item.id}
                              onClick={() => handlePublish(item.id)}
                            >
                              <CheckCircle2 size={15} />
                            </button>
                          )}
                          <button
                            className={"admin-icon-btn" + (uploadTargetId === item.id ? " admin-icon-btn-active" : "")}
                            title="Manage images"
                            onClick={() => toggleUploadTarget(item.id)}
                          >
                            <ImagePlus size={15} />
                          </button>
                          <button
                            className={"admin-icon-btn" + (manageId === item.id ? " admin-icon-btn-active" : "")}
                            title="Manage exhibitions"
                            onClick={() => toggleManage(item.id)}
                          >
                            <CalendarRange size={15} />
                          </button>
                          <button
                            className="admin-icon-btn admin-icon-btn-danger"
                            title="Delete"
                            disabled={busyId === item.id}
                            onClick={() => handleDelete(item.id, item.name)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {editingId === item.id && (
                      <tr className="admin-detail-row">
                        <td colSpan={4}>{formCard}</td>
                      </tr>
                    )}

                    {uploadTargetId === item.id && (
                      <tr className="admin-detail-row">
                        <td colSpan={4}>
                          <h3 className="admin-section-title"><ImagePlus size={15} /> Images</h3>
                          {Array.isArray(item.images) && item.images.length > 0 && (
                            <>
                              <p className="admin-form-hint" style={{ margin: "0 0 8px" }}>Pick one to use as the cover</p>
                              <div className="admin-cover-picker">
                                {item.images.map((url) => {
                                  const isCover = url === imgUrl;
                                  return (
                                    <div key={url} className="admin-cover-picker-item">
                                      <img
                                        src={url}
                                        alt=""
                                        className="admin-thumb"
                                        title={url}
                                      />
                                      {isCover ? (
                                        <span className="admin-badge admin-badge-success">
                                          <Star size={11} />
                                          Cover
                                        </span>
                                      ) : (
                                        <button
                                          className="admin-btn admin-btn-sm"
                                          type="button"
                                          disabled={coverBusyUrl !== null}
                                          onClick={() => handleSetCover(item.id, url)}
                                        >
                                          {coverBusyUrl === url ? "Setting..." : "Set as cover"}
                                        </button>
                                      )}
                                      <button
                                        className="admin-btn admin-btn-sm admin-btn-danger"
                                        type="button"
                                        disabled={deleteBusyUrl !== null}
                                        onClick={() => handleDeleteImage(item.id, url)}
                                      >
                                        {deleteBusyUrl === url ? "Deleting..." : "Delete"}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}
                          <label className="admin-dropzone" style={{ maxWidth: 420 }}>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(e) => setUploadFiles(Array.from(e.target.files ?? []))}
                            />
                            <UploadCloud size={20} />
                            <p className="admin-dropzone-label">
                              {uploadFiles.length > 0
                                ? `${uploadFiles.length} file${uploadFiles.length === 1 ? "" : "s"} selected`
                                : "Click to choose image(s)"}
                            </p>
                            <p className="admin-dropzone-hint">You can select multiple files</p>
                          </label>
                          {uploadError && <p className="admin-error"><AlertCircle size={14} />{uploadError}</p>}
                          <div style={{ marginTop: 10 }}>
                            <button
                              className="admin-btn admin-btn-primary"
                              type="button"
                              disabled={uploadFiles.length === 0 || uploadBusy}
                              onClick={() => handleUpload(item.id, uploadFiles)}
                            >
                              {uploadBusy
                                ? "Uploading..."
                                : uploadFiles.length > 1
                                  ? `Upload ${uploadFiles.length} images`
                                  : "Upload"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {manageId === item.id && (
                      <tr className="admin-detail-row">
                        <td colSpan={4}>
                          <h3 className="admin-section-title"><CalendarRange size={15} /> Exhibitions</h3>
                          {exLoading && (
                            <div className="admin-loading" style={{ padding: "8px 0" }}>
                              <span className="admin-spinner" />
                              Loading exhibitions...
                            </div>
                          )}
                          {!exLoading && exhibitions.length === 0 && <p className="admin-page-note" style={{ marginTop: 4 }}>No exhibitions yet.</p>}
                          {!exLoading && exhibitions.length > 0 && (
                            <ul style={{ margin: "8px 0", paddingLeft: 18 }}>
                              {exhibitions.map((ex) => (
                                <li key={ex.id} style={{ marginBottom: 4 }}>
                                  {ex.name}{" "}
                                  {ex.startDate
                                    ? `(${formatDate(ex.startDate)}${ex.endDate ? ` – ${formatDate(ex.endDate)}` : ""})`
                                    : ""}{" "}
                                  {ex.approvalStatus && ex.approvalStatus !== "APPROVED" && (
                                    <span className="admin-badge admin-badge-neutral">{ex.approvalStatus}</span>
                                  )}{" "}
                                  <button className="admin-btn admin-btn-sm admin-btn-danger" onClick={() => handleDeleteExhibition(item.id, ex.id)}>
                                    <Trash2 size={12} />
                                    Delete
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="admin-form-grid-3" style={{ marginTop: 10 }}>
                            <div className="admin-form-row admin-form-span-2">
                              <label>New exhibition name</label>
                              <input value={exForm.name} onChange={(e) => setExForm({ ...exForm, name: e.target.value })} />
                            </div>
                            <div />
                            <div className="admin-form-row">
                              <label>Start date</label>
                              <input type="date" value={exForm.startDate} onChange={(e) => setExForm({ ...exForm, startDate: e.target.value })} />
                            </div>
                            <div className="admin-form-row">
                              <label>End date</label>
                              <input type="date" value={exForm.endDate} onChange={(e) => setExForm({ ...exForm, endDate: e.target.value })} />
                            </div>
                            <div />
                            <div className="admin-form-row">
                              <label>Opening time</label>
                              <input type="time" value={exForm.startTime} onChange={(e) => setExForm({ ...exForm, startTime: e.target.value })} />
                            </div>
                            <div className="admin-form-row">
                              <label>Closing time</label>
                              <input type="time" value={exForm.endTime} onChange={(e) => setExForm({ ...exForm, endTime: e.target.value })} />
                            </div>
                          </div>
                          <button
                            className="admin-btn admin-btn-primary"
                            style={{ marginTop: 10 }}
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
        </div>
      )}
    </div>
  );
}
