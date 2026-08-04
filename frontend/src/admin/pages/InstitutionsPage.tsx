import React, { useEffect, useMemo, useState } from "react";
import { adminApi, Pagination } from "../api";

interface Institution {
  id: string;
  name: string;
  description?: string;
  address?: string;
  city?: string;
  country?: string;
  website?: string;
  isPublished?: boolean;
  imageUrl?: string | null;
  coverImageUrl?: string | null;
  logoUrl?: string | null;
  image?: string | null;
  [key: string]: any;
}

interface Exhibition {
  id: string;
  title: string;
  startDate?: string;
  endDate?: string;
  [key: string]: any;
}

const emptyForm = { name: "", description: "", address: "", city: "", country: "", website: "" };

// The backend model doesn't always use the same field name for the cover
// image (imageUrl / coverImageUrl / logoUrl / image), so check all of them
// rather than guessing wrong and showing "no image" for institutions that
// actually have one.
function getImageUrl(inst: Institution): string | null {
  return inst.imageUrl || inst.coverImageUrl || inst.logoUrl || inst.image || null;
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
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // expandable "Manage" row state
  const [manageId, setManageId] = useState<string | null>(null);
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [exLoading, setExLoading] = useState(false);
  const [exForm, setExForm] = useState({ title: "", startDate: "", endDate: "" });
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
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
  // search box (matches on name, city, or country so you can also type
  // a location to narrow things down).
  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? allItems.filter((inst) =>
          [inst.name, inst.city, inst.country].filter(Boolean).some((field) => String(field).toLowerCase().includes(q))
        )
      : allItems;
    return [...filtered].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [allItems, search]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function startEdit(inst: Institution) {
    setEditingId(inst.id);
    setForm({
      name: inst.name || "",
      description: inst.description || "",
      address: inst.address || "",
      city: inst.city || "",
      country: inst.country || "",
      website: inst.website || "",
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await adminApi.updateInstitution(editingId, form);
      } else {
        await adminApi.createInstitution(form);
      }
      setShowForm(false);
      loadAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
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
      // The two upload endpoints on this backend are known to fail with
      // "The specified bucket does not exist" until the S3 bucket config
      // is fixed server-side — surface that clearly instead of a vague error.
      setUploadError(err.message);
    } finally {
      setUploadTargetId(null);
    }
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
    try {
      await adminApi.createExhibition(institutionId, exForm);
      setExForm({ title: "", startDate: "", endDate: "" });
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
            <label>Address</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="admin-form-row">
            <label>City</label>
            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="admin-form-row">
            <label>Country</label>
            <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </div>
          <div className="admin-form-row">
            <label>Website</label>
            <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          </div>
          <p className="admin-page-note" style={{ marginTop: 0 }}>
            If your backend needs more fields here (opening hours, category, coordinates), tell Claude and they'll get added.
          </p>
          <button className="admin-btn admin-btn-primary" type="submit" disabled={saving}>
            {saving ? "Saving..." : editingId ? "Save changes" : "Create institution"}
          </button>
          <button className="admin-btn" type="button" onClick={() => setShowForm(false)}>
            Cancel
          </button>
        </form>
      )}

      {error && <p className="admin-error">{error}</p>}
      {uploadError && (
        <p className="admin-error">
          Image upload failed: {uploadError}. This matches the known backend bug where the image-storage bucket is
          misconfigured — it isn't something this panel can fix on its own.
        </p>
      )}

      <div className="admin-search-bar">
        <input
          type="text"
          placeholder="Search institutions by name or location..."
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
              return (
                <React.Fragment key={item.id}>
                  <tr>
                    <td>
                      {imgUrl ? (
                        <img className="admin-thumb" src={imgUrl} alt={item.name} onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                      ) : (
                        <div className="admin-thumb-placeholder">No image</div>
                      )}
                    </td>
                    <td>{item.name}</td>
                    <td>{[item.city, item.country].filter(Boolean).join(", ") || "—"}</td>
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
                      <button className="admin-btn" onClick={() => setUploadTargetId(uploadTargetId === item.id ? null : item.id)}>
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
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUpload(item.id, file);
                            }}
                          />
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
                                {ex.title} {ex.startDate ? `(${ex.startDate}${ex.endDate ? ` – ${ex.endDate}` : ""})` : ""}{" "}
                                <button className="admin-btn admin-btn-danger" onClick={() => handleDeleteExhibition(item.id, ex.id)}>
                                  Delete
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="admin-form-row">
                          <label>New exhibition title</label>
                          <input value={exForm.title} onChange={(e) => setExForm({ ...exForm, title: e.target.value })} />
                        </div>
                        <div className="admin-form-row">
                          <label>Start date</label>
                          <input type="date" value={exForm.startDate} onChange={(e) => setExForm({ ...exForm, startDate: e.target.value })} />
                        </div>
                        <div className="admin-form-row">
                          <label>End date</label>
                          <input type="date" value={exForm.endDate} onChange={(e) => setExForm({ ...exForm, endDate: e.target.value })} />
                        </div>
                        <button className="admin-btn admin-btn-primary" onClick={() => handleAddExhibition(item.id)}>
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
