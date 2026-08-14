import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import Navbar from "../layout/Navbar.jsx";
import { useAuth } from "../../lib/AuthContext.jsx";
import { apiGet, apiPost } from "../../lib/api.js";
import {
  AREAS,
  DAYS,
  emptyHours,
  formatOpeningHours,
  hoursFromApi,
  hoursToApi,
  INSTITUTION_TYPES,
  MAX_IMAGE_BYTES,
  parseGeocode,
} from "../../admin/institutionShared";
import "./SubmitGalleryPage.scss";

const emptyForm = {
  name: "",
  description: "",
  type: "ART_GALLERY",
  address: "",
  area: "ISLAND",
  subArea: "",
  lat: "",
  lng: "",
  mapUrl: "",
  website: "",
  instagram: "",
  phone: "",
  email: "",
  hasResidency: false,
  hasSocial: false,
};

/**
 * Deliberately narrower than the admin submission form: sub-category and tags
 * are curatorial decisions, not facts a public contributor is expected to
 * know, and `notes` is admin-internal — none of the three belong here.
 */
function toApiPayload(form, hours) {
  const payload = {
    name: form.name.trim(),
    type: form.type,
    address: form.address.trim(),
    area: form.area,
    lat: Number(form.lat),
    lng: Number(form.lng),
    hasResidency: form.hasResidency,
    hasSocial: form.hasSocial,
  };

  const optional = ["description", "subArea", "mapUrl", "website", "instagram", "phone", "email"];
  for (const key of optional) {
    const value = String(form[key] ?? "").trim();
    if (value) payload[key] = value;
  }

  const openingHours = hoursToApi(hours);
  if (openingHours) payload.openingHours = openingHours;

  return payload;
}

export default function SubmitGalleryPage() {
  const { user, loading: authLoading, getAccessToken } = useAuth();

  const [form, setForm] = useState(emptyForm);
  const [hours, setHours] = useState(emptyHours);
  const [geocodePaste, setGeocodePaste] = useState("");
  const [geocodeError, setGeocodeError] = useState(null);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [saveStage, setSaveStage] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [mine, setMine] = useState([]);
  const [mineLoading, setMineLoading] = useState(true);
  const [viewingId, setViewingId] = useState(null);

  // Fixing and resubmitting a REJECTED submission — the only submission
  // state that's still editable (see PUT /api/v1/submissions/:id). null
  // means the form below is for a brand-new submission.
  const [editingId, setEditingId] = useState(null);
  const [editingReviewNote, setEditingReviewNote] = useState(null);

  const loadMine = useCallback(() => {
    const token = getAccessToken();
    if (!token) return;
    setMineLoading(true);
    apiGet("/submissions/mine", {}, token)
      .then((result) => setMine(result.data || []))
      .catch(() => {})
      .finally(() => setMineLoading(false));
  }, [getAccessToken]);

  useEffect(() => {
    if (user) loadMine();
  }, [user, loadMine]);

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

  function setDay(key, patch) {
    setHours((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  function startEdit(item) {
    setEditingId(item.id);
    setEditingReviewNote(item.reviewNote || null);
    setForm({
      name: item.name || "",
      description: item.description || "",
      type: item.type || "ART_GALLERY",
      address: item.address || "",
      area: item.area || "ISLAND",
      subArea: item.subArea || "",
      lat: item.lat === undefined || item.lat === null ? "" : String(item.lat),
      lng: item.lng === undefined || item.lng === null ? "" : String(item.lng),
      mapUrl: item.mapUrl || "",
      website: item.website || "",
      instagram: item.instagram || "",
      phone: item.phone || "",
      email: item.email || "",
      hasResidency: Boolean(item.hasResidency),
      hasSocial: Boolean(item.hasSocial),
    });
    setHours(hoursFromApi(item.openingHours));
    setGeocodePaste("");
    setGeocodeError(null);
    setFile(null);
    setFileError(null);
    setError(null);
    setSuccess(null);
    setViewingId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingReviewNote(null);
    setForm(emptyForm);
    setHours(emptyHours());
    setError(null);
    setSuccess(null);
  }

  function pickFile(picked) {
    setFileError(null);
    if (!picked) {
      setFile(null);
      return;
    }
    if (!picked.type.startsWith("image/")) {
      setFileError(`"${picked.name}" is not an image.`);
      setFile(null);
      return;
    }
    if (picked.size > MAX_IMAGE_BYTES) {
      setFileError(
        `"${picked.name}" is ${(picked.size / 1024 / 1024).toFixed(1)} MB — the limit is ` +
          `${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
      );
      setFile(null);
      return;
    }
    setFile(picked);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    const token = getAccessToken();
    try {
      const payload = toApiPayload(form, hours);

      if (editingId) {
        // Fixing a REJECTED submission — PUT only touches the fields below;
        // the image (if any) is untouched and unaffected by this call.
        setSaveStage("submitting");
        await apiPost(`/submissions/${editingId}`, payload, { token, method: "PUT" });
        setSuccess(`"${payload.name}" was resubmitted and is now pending review.`);
        cancelEdit();
        loadMine();
        return;
      }

      setSaveStage("submitting");
      const created = await apiPost("/submissions", payload, { token });
      const newId = created?.data?.id;

      if (file && newId) {
        setSaveStage("uploading");
        const body = new FormData();
        body.append("image", file);
        try {
          await apiPost(`/submissions/${newId}/images`, body, { token, isFormData: true });
        } catch (uploadErr) {
          setSuccess(
            `"${payload.name}" was submitted for review, but the image did not upload: ${uploadErr.message}.`,
          );
          setForm(emptyForm);
          setHours(emptyHours());
          setFile(null);
          loadMine();
          return;
        }
      }

      setSuccess(`"${payload.name}" was submitted and is now pending review.`);
      setForm(emptyForm);
      setHours(emptyHours());
      setFile(null);
      loadMine();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
      setSaveStage(null);
    }
  }

  if (authLoading) {
    return (
      <div className="app">
        <Navbar />
        <div className="loader">
          <div className="loader-spinner" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app">
      <Navbar />
      <div className="submit-gallery-page">
      <div className="submit-gallery-card">
        <div className="section-header">
          <h2>{editingId ? "Fix & Resubmit" : "Submit a Gallery"}</h2>
          <p>
            {editingId
              ? "Update the fields below and resubmit for review."
              : "Know a gallery, studio, or cultural space we're missing? Submit it below for review."}
          </p>
        </div>

        {editingId && editingReviewNote && (
          <p className="auth-error">Reviewer note: {editingReviewNote}</p>
        )}
        {error && <p className="auth-error">{error}</p>}
        {success && <p className="auth-success">{success}</p>}

        <form className="submit-form" onSubmit={handleSubmit}>
          <label>
            Name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Description
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <label>
            Type
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required>
              {INSTITUTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Address
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
          </label>
          <label>
            Area
            <select value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} required>
              {AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sub-area
            <input
              placeholder="Lekki Phase 1, Ikoyi, Yaba…"
              value={form.subArea}
              onChange={(e) => setForm({ ...form, subArea: e.target.value })}
            />
          </label>

          <div className="submit-form-divider">Location</div>

          <label>
            Paste coordinates from Google Maps
            <div className="geocode-row">
              <input
                placeholder="6.4638, 3.4342"
                value={geocodePaste}
                onChange={(e) => setGeocodePaste(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyGeocode();
                  }
                }}
              />
              <button className="btn btn-outline" type="button" onClick={applyGeocode} disabled={!geocodePaste.trim()}>
                Apply
              </button>
            </div>
          </label>
          {geocodeError && <p className="auth-error">{geocodeError}</p>}

          <label>
            Latitude
            <input
              type="number"
              step="any"
              min={-90}
              max={90}
              value={form.lat}
              onChange={(e) => setForm({ ...form, lat: e.target.value })}
              required
            />
          </label>
          <label>
            Longitude
            <input
              type="number"
              step="any"
              min={-180}
              max={180}
              value={form.lng}
              onChange={(e) => setForm({ ...form, lng: e.target.value })}
              required
            />
          </label>
          <label>
            Map URL
            <input
              type="url"
              placeholder="https://maps.app.goo.gl/… (optional)"
              value={form.mapUrl}
              onChange={(e) => setForm({ ...form, mapUrl: e.target.value })}
            />
          </label>

          <div className="submit-form-divider">Contact</div>

          <label>
            Website
            <input
              type="url"
              placeholder="https://example.com (optional)"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </label>
          <label>
            Instagram
            <input
              placeholder="@handle or profile URL"
              value={form.instagram}
              onChange={(e) => setForm({ ...form, instagram: e.target.value })}
            />
          </label>
          <label>
            Phone
            <input placeholder="+234…" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label>
            Email
            <input
              type="email"
              placeholder="hello@example.com (optional)"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>

          <div className="submit-form-divider">Opening hours</div>
          <p className="form-hint">Tick a day if you know its hours. Leave it unticked if you're not sure.</p>
          {DAYS.map(({ key, label }) => {
            const row = hours[key];
            return (
              <div className="hours-row" key={key}>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={row.recorded}
                    onChange={(e) => setDay(key, { recorded: e.target.checked })}
                  />
                  {label}
                </label>
                {row.recorded && (
                  <>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={row.closed}
                        onChange={(e) => setDay(key, { closed: e.target.checked })}
                      />
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

          <div className="submit-form-divider">A few more details</div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.hasResidency}
              onChange={(e) => setForm({ ...form, hasResidency: e.target.checked })}
            />
            Runs a residency programme
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.hasSocial}
              onChange={(e) => setForm({ ...form, hasSocial: e.target.checked })}
            />
            Has a social presence
          </label>

          {!editingId && (
            <>
              <div className="submit-form-divider">Cover image (optional)</div>
              <label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {file && (
                <p className="form-hint">
                  Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(0)} KB)
                </p>
              )}
              {fileError && <p className="auth-error">{fileError}</p>}
            </>
          )}

          <div className="submit-form-actions">
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {saveStage === "submitting"
                ? editingId
                  ? "Resubmitting..."
                  : "Submitting..."
                : saveStage === "uploading"
                  ? "Uploading image..."
                  : editingId
                    ? "Resubmit for review"
                    : "Submit for review"}
            </button>
            {editingId && (
              <button className="btn btn-outline" type="button" onClick={cancelEdit} disabled={submitting}>
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="my-submissions">
          <h3>Your submissions</h3>
          {mineLoading && <p className="form-hint">Loading...</p>}
          {!mineLoading && mine.length === 0 && <p className="form-hint">You haven't submitted anything yet.</p>}
          {!mineLoading && mine.length > 0 && (
            <ul>
              {mine.map((item) => {
                const hours = formatOpeningHours(item.openingHours);
                const isViewing = viewingId === item.id;
                return (
                  <li key={item.id}>
                    <div className="submission-row">
                      <span>
                        <strong>{item.name}</strong> —{" "}
                        <span className={`status status-${item.approvalStatus?.toLowerCase()}`}>
                          {item.approvalStatus}
                        </span>
                      </span>
                      <div className="submission-row-actions">
                        {item.approvalStatus === "REJECTED" && (
                          <button
                            type="button"
                            className="btn btn-primary btn-small"
                            onClick={() => startEdit(item)}
                          >
                            Fix & resubmit
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-outline btn-small"
                          onClick={() => setViewingId(isViewing ? null : item.id)}
                        >
                          {isViewing ? "Hide" : "View"}
                        </button>
                      </div>
                    </div>

                    {isViewing && (
                      <div className="submission-detail">
                        {item.reviewNote && item.approvalStatus === "REJECTED" && (
                          <p className="auth-error">Reviewer note: {item.reviewNote}</p>
                        )}
                        <dl>
                          <dt>Description</dt>
                          <dd>{item.description || "—"}</dd>
                          <dt>Type</dt>
                          <dd>{item.type ? item.type.replace(/_/g, " ") : "—"}</dd>
                          <dt>Address</dt>
                          <dd>{[item.address, item.subArea, item.area].filter(Boolean).join(", ") || "—"}</dd>
                          <dt>Coordinates</dt>
                          <dd>
                            {item.lat !== undefined && item.lng !== undefined ? `${item.lat}, ${item.lng}` : "—"}
                            {item.mapUrl && (
                              <>
                                {" — "}
                                <a href={item.mapUrl} target="_blank" rel="noreferrer">
                                  Map link
                                </a>
                              </>
                            )}
                          </dd>
                          <dt>Website</dt>
                          <dd>
                            {item.website ? (
                              <a href={item.website} target="_blank" rel="noreferrer">
                                {item.website}
                              </a>
                            ) : (
                              "—"
                            )}
                          </dd>
                          <dt>Instagram</dt>
                          <dd>{item.instagram || "—"}</dd>
                          <dt>Phone</dt>
                          <dd>{item.phone || "—"}</dd>
                          <dt>Email</dt>
                          <dd>{item.email || "—"}</dd>
                          <dt>Opening hours</dt>
                          <dd>
                            {hours.length === 0 ? (
                              "Not recorded"
                            ) : (
                              <ul className="hours-list">
                                {hours.map((row) => (
                                  <li key={row.label}>
                                    {row.label}: {row.value}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </dd>
                          <dt>Details</dt>
                          <dd>
                            {[item.hasResidency && "Runs a residency programme", item.hasSocial && "Has a social presence"]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </dd>
                          {item.images && item.images.length > 0 && (
                            <>
                              <dt>Images</dt>
                              <dd>
                                <div className="submission-images">
                                  {item.images.map((url) => (
                                    <img key={url} src={url} alt="" />
                                  ))}
                                </div>
                              </dd>
                            </>
                          )}
                        </dl>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
