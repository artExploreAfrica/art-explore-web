import React, { useEffect, useMemo, useState } from "react";
import { adminApi } from "../api";
import {
  AREAS,
  AreaEnum,
  DAYS,
  DayRow,
  emptyHours,
  hoursFromApi,
  hoursToApi,
  INSTITUTION_TYPES,
  InstitutionType,
  MAX_IMAGE_BYTES,
  parseGeocode,
  SubCategory,
  Tag,
} from "../institutionShared";

// Mirrors the writable shape of Institution (see institutionFieldsSchema in
// src/validators/institution.validator.ts). Both submitting a brand-new venue
// and proposing an edit to an existing one build this same shape — the only
// difference is which admin endpoint the payload goes to.
interface Institution {
  id: string;
  name: string;
  description?: string | null;
  type: InstitutionType;
  address: string;
  area: AreaEnum;
  subArea?: string | null;
  lat: number;
  lng: number;
  mapUrl?: string | null;
  website?: string | null;
  instagram?: string | null;
  phone?: string | null;
  email?: string | null;
  openingHours?: any;
  notes?: string | null;
  hasResidency?: boolean;
  hasSocial?: boolean;
  subCategoryId?: string | null;
  tags?: { id: string; name: string }[];
  [key: string]: any;
}

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
  subCategoryId: "",
};

type FormState = typeof emptyForm;

/**
 * Form + hours + tag selection → institutionFieldsSchema-shaped body.
 * Shared by both the "submit new" and "propose edit" paths — same schema on
 * the backend (submitInstitutionSchema / updateInstitutionSchema), so one
 * builder is enough.
 */
function toApiPayload(
  form: FormState,
  hours: Record<string, DayRow>,
  tagIds: string[],
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: form.name.trim(),
    type: form.type,
    address: form.address.trim(),
    area: form.area,
    lat: Number(form.lat),
    lng: Number(form.lng),
    hasResidency: form.hasResidency,
    hasSocial: form.hasSocial,
    tagIds,
  };

  // Optional strings: omit when blank. `website`/`email`/`mapUrl` are
  // `.url()`/`.email()` — an empty string fails validation, so leaving one
  // blank must mean "not provided", not "provided as empty".
  const optional: (keyof FormState)[] = [
    "description",
    "subArea",
    "mapUrl",
    "website",
    "instagram",
    "phone",
    "email",
    "notes",
    "subCategoryId",
  ];
  for (const key of optional) {
    const value = String(form[key] ?? "").trim();
    if (value) payload[key] = value;
  }

  const openingHours = hoursToApi(hours);
  if (openingHours) payload.openingHours = openingHours;

  return payload;
}

export function SubmitInstitutionPage() {
  const [mode, setMode] = useState<"new" | "edit">("new");

  const [form, setForm] = useState<FormState>(emptyForm);
  const [hours, setHours] = useState<Record<string, DayRow>>(emptyHours);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [geocodePaste, setGeocodePaste] = useState("");
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  // "new" mode only — uploaded right after the submission row is created,
  // mirroring the two-step create+upload pattern on InstitutionsPage.
  const [newFile, setNewFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // "edit" mode only — pick an existing, already-approved institution to
  // propose a change to. Its live values seed the form above.
  const [allInstitutions, setAllInstitutions] = useState<Institution[]>([]);
  const [institutionsLoading, setInstitutionsLoading] = useState(true);
  const [institutionSearch, setInstitutionSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [allSubCategories, setAllSubCategories] = useState<SubCategory[]>([]);

  const [saving, setSaving] = useState(false);
  const [saveStage, setSaveStage] = useState<"submitting" | "uploading" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function loadInstitutions() {
      setInstitutionsLoading(true);
      try {
        const first = await adminApi.institutions(1);
        const totalPages = first.pagination?.totalPages || 1;
        let combined: Institution[] = first.data || [];
        if (totalPages > 1) {
          const rest = await Promise.all(
            Array.from({ length: totalPages - 1 }, (_, i) => adminApi.institutions(i + 2)),
          );
          combined = combined.concat(...rest.map((r) => r.data || []));
        }
        setAllInstitutions(combined);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setInstitutionsLoading(false);
      }
    }

    async function loadTags() {
      try {
        const first = await adminApi.tags(1);
        const totalPages = first.pagination?.totalPages || 1;
        let combined: Tag[] = first.data || [];
        if (totalPages > 1) {
          const rest = await Promise.all(
            Array.from({ length: totalPages - 1 }, (_, i) => adminApi.tags(i + 2)),
          );
          combined = combined.concat(...rest.map((r) => r.data || []));
        }
        setAllTags(combined);
      } catch (err: any) {
        setError(err.message);
      }
    }

    async function loadSubCategories() {
      try {
        const first = await adminApi.subcategories(1);
        const totalPages = first.pagination?.totalPages || 1;
        let combined: SubCategory[] = first.data || [];
        if (totalPages > 1) {
          const rest = await Promise.all(
            Array.from({ length: totalPages - 1 }, (_, i) => adminApi.subcategories(i + 2)),
          );
          combined = combined.concat(...rest.map((r) => r.data || []));
        }
        setAllSubCategories(combined);
      } catch (err: any) {
        setError(err.message);
      }
    }

    loadInstitutions();
    loadTags();
    loadSubCategories();
  }, []);

  const tagsByCategory = useMemo(() => {
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

  const subCategoryOptions = useMemo(
    () => allSubCategories.filter((sc) => sc.type === form.type),
    [allSubCategories, form.type],
  );

  const visibleInstitutions = useMemo(() => {
    const q = institutionSearch.trim().toLowerCase();
    const filtered = q
      ? allInstitutions.filter((inst) => inst.name.toLowerCase().includes(q))
      : allInstitutions;
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [allInstitutions, institutionSearch]);

  function resetForm() {
    setForm(emptyForm);
    setHours(emptyHours());
    setTagIds([]);
    setGeocodePaste("");
    setGeocodeError(null);
    setNewFile(null);
    setFileError(null);
  }

  function switchMode(next: "new" | "edit") {
    setMode(next);
    setSelectedId(null);
    setSuccess(null);
    setError(null);
    resetForm();
  }

  function selectInstitution(inst: Institution) {
    setSelectedId(inst.id);
    setSuccess(null);
    setError(null);
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
      subCategoryId: inst.subCategoryId || "",
    });
    setHours(hoursFromApi(inst.openingHours));
    setTagIds((inst.tags || []).map((t) => t.id));
    setGeocodePaste("");
    setGeocodeError(null);
  }

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

  function toggleTag(id: string) {
    setTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const payload = toApiPayload(form, hours, tagIds);

      if (mode === "edit") {
        if (!selectedId) {
          setError("Pick an institution to edit first.");
          return;
        }
        setSaveStage("submitting");
        await adminApi.proposeInstitutionEdit(selectedId, payload);
        setSuccess(
          `Edit submitted for "${payload.name}". It will stay live as-is until a reviewer approves the change.`,
        );
        setSelectedId(null);
        resetForm();
        return;
      }

      setSaveStage("submitting");
      const created = await adminApi.submitInstitution(payload);
      const newId: string | undefined = created?.data?.id;

      if (newFile && newId) {
        setSaveStage("uploading");
        try {
          await adminApi.uploadInstitutionImage(newId, newFile);
        } catch (uploadErr: any) {
          setSuccess(
            `"${payload.name}" was submitted for review, but the image did not upload: ${uploadErr.message}. ` +
              `You can attach it from the Institutions page once the submission is approved.`,
          );
          resetForm();
          return;
        }
      }

      setSuccess(`"${payload.name}" was submitted and is now pending review.`);
      resetForm();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
      setSaveStage(null);
    }
  }

  const canSubmit = mode === "new" || Boolean(selectedId);

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Submit Institution</h1>
      </div>
      <p className="admin-page-note">
        Sends a venue to the review queue instead of publishing it directly. New venues are created
        PENDING and unpublished; edits to an already-approved venue are held separately and only
        applied once a reviewer approves them — the live venue is untouched until then. Review from
        the Submissions page.
      </p>

      <div className="admin-form-row" style={{ maxWidth: 480 }}>
        <label>What are you submitting?</label>
        <select value={mode} onChange={(e) => switchMode(e.target.value as "new" | "edit")}>
          <option value="new">A new institution</option>
          <option value="edit">A change to an existing institution</option>
        </select>
      </div>

      {mode === "edit" && (
        <div className="admin-form-card" style={{ maxWidth: 480 }}>
          <strong>Pick an institution</strong>
          <div className="admin-form-row">
            <input
              type="text"
              placeholder="Search by name..."
              value={institutionSearch}
              onChange={(e) => setInstitutionSearch(e.target.value)}
            />
          </div>
          {institutionsLoading && <p className="admin-page-note">Loading institutions...</p>}
          {!institutionsLoading && (
            <select
              size={6}
              value={selectedId || ""}
              onChange={(e) => {
                const inst = allInstitutions.find((i) => i.id === e.target.value);
                if (inst) selectInstitution(inst);
              }}
            >
              {visibleInstitutions.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {(mode === "new" || selectedId) && (
        <form className="admin-form-card" onSubmit={handleSubmit}>
          <div className="admin-form-row">
            <label>Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="admin-form-row">
            <label>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="admin-form-row">
            <label>Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as InstitutionType, subCategoryId: "" })}
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
            <label>Sub-category</label>
            <select
              value={form.subCategoryId}
              onChange={(e) => setForm({ ...form, subCategoryId: e.target.value })}
            >
              <option value="">None</option>
              {subCategoryOptions.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.name}
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
            <select value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value as AreaEnum })} required>
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
            <input placeholder="+234…" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
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
          <strong>Tags</strong>
          {tagsByCategory.length === 0 && <p className="admin-page-note">No tags defined yet.</p>}
          {tagsByCategory.map(({ category, tags }) => (
            <div key={category} className="admin-form-row">
              <label>{category.charAt(0) + category.slice(1).toLowerCase()}</label>
              {tags.map((t) => (
                <label key={t.id} style={{ display: "block", fontWeight: "normal" }}>
                  <input type="checkbox" checked={tagIds.includes(t.id)} onChange={() => toggleTag(t.id)} /> {t.label}
                </label>
              ))}
            </div>
          ))}

          <hr className="admin-form-divider" />
          <strong>Opening hours</strong>
          <p className="admin-page-note" style={{ marginTop: 0 }}>
            Tick a day to record it. Untick means "not recorded", which is not the same as closed.
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
                        <input type="time" value={row.open} onChange={(e) => setDay(key, { open: e.target.value })} />
                        <input type="time" value={row.close} onChange={(e) => setDay(key, { close: e.target.value })} />
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

          {mode === "new" && (
            <>
              <hr className="admin-form-divider" />
              <strong>Image</strong>
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
                  automatically once the submission is created.
                </p>
              )}
              {fileError && <p className="admin-error">{fileError}</p>}
            </>
          )}

          <hr className="admin-form-divider" />
          {error && <p className="admin-error">{error}</p>}
          {success && <p className="admin-success">{success}</p>}
          <button className="admin-btn admin-btn-primary" type="submit" disabled={saving || !canSubmit}>
            {saveStage === "submitting"
              ? "Submitting..."
              : saveStage === "uploading"
                ? "Uploading image..."
                : mode === "edit"
                  ? "Submit edit for approval"
                  : "Submit for approval"}
          </button>
        </form>
      )}
    </div>
  );
}
