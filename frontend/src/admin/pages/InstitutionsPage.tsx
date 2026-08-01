import React, { useEffect, useState } from "react";
import { adminApi } from "../api";

interface Institution {
  id: string;
  name: string;
  type: string;
  address: string;
  area: string;
  lat: number;
  lng: number;
  isPublished: boolean;
}

interface Exhibition {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
}

const emptyInstitutionForm = {
  name: "",
  type: "ART_GALLERY",
  address: "",
  area: "MAINLAND",
  lat: "",
  lng: "",
};

const emptyExhibitionForm = { name: "", startDate: "", endDate: "", startTime: "10:00", endTime: "18:00" };

export function InstitutionsPage() {
  const [items, setItems] = useState<Institution[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyInstitutionForm);
  const [saving, setSaving] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [exhibitionsLoading, setExhibitionsLoading] = useState(false);
  const [showExhibitionForm, setShowExhibitionForm] = useState(false);
  const [exhibitionForm, setExhibitionForm] = useState(emptyExhibitionForm);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    adminApi
      .institutions()
      .then((result) => setItems(result.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function startCreate() {
    setEditingId(null);
    setForm(emptyInstitutionForm);
    setShowCreateForm(true);
  }

  function startEdit(item: Institution) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      type: item.type,
      address: item.address,
      area: item.area,
      lat: String(item.lat),
      lng: String(item.lng),
    });
    setShowCreateForm(true);
    setExpandedId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = { ...form, lat: parseFloat(form.lat), lng: parseFloat(form.lng) };
    try {
      if (editingId) {
        await adminApi.updateInstitution(editingId, payload);
      } else {
        await adminApi.createInstitution(payload);
      }
      setShowCreateForm(false);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublishToggle(item: Institution) {
    try {
      await adminApi.publishInstitution(item.id);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This is a soft delete and can be reversed by a developer, but it disappears from the site immediately.`))
      return;
    try {
      await adminApi.deleteInstitution(id);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setShowExhibitionForm(false);
    setExhibitionsLoading(true);
    adminApi
      .institutionExhibitions(id)
      .then((result) => setExhibitions(result.data))
      .catch((err) => setError(err.message))
      .finally(() => setExhibitionsLoading(false));
  }

  async function handleImageUpload(id: string, file: File) {
    setUploadingId(id);
    setError(null);
    try {
      await adminApi.uploadInstitutionImage(id, file);
      load();
    } catch (err: any) {
      // Known issue from testing: the backend's storage bucket may not exist yet.
      // If you see "the specified bucket does not exist", that's a backend config
      // problem, not this frontend code — see the endpoint testing report.
      setError(err.message);
    } finally {
      setUploadingId(null);
    }
  }

  async function handleCreateExhibition(institutionId: string, e: React.FormEvent) {
    e.preventDefault();
    try {
      await adminApi.createExhibition(institutionId, {
        ...exhibitionForm,
        startDate: new Date(exhibitionForm.startDate).toISOString(),
        endDate: new Date(exhibitionForm.endDate).toISOString(),
      });
      setShowExhibitionForm(false);
      setExhibitionForm(emptyExhibitionForm);
      toggleExpand(institutionId);
      toggleExpand(institutionId);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDeleteExhibition(institutionId: string, exhibitionId: string, name: string) {
    if (!confirm(`Delete the exhibition "${name}"?`)) return;
    try {
      await adminApi.deleteExhibition(institutionId, exhibitionId);
      setExhibitions((prev) => prev.filter((e) => e.id !== exhibitionId));
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Institutions</h1>
        <button className="admin-btn admin-btn-primary" onClick={startCreate}>
          + New gallery
        </button>
      </div>

      {showCreateForm && (
        <form className="admin-form-card" onSubmit={handleSubmit}>
          <div className="admin-form-row">
            <label>Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="admin-form-row">
            <label>Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="ART_GALLERY">Art gallery</option>
              <option value="STUDIO">Studio</option>
              <option value="CULTURAL_SPACE">Cultural space</option>
              <option value="MUSEUM">Museum</option>
            </select>
          </div>
          <div className="admin-form-row">
            <label>Address</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
          </div>
          <div className="admin-form-row">
            <label>Area</label>
            <select value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}>
              <option value="MAINLAND">Mainland</option>
              <option value="ISLAND">Island</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="admin-form-row">
            <label>Latitude</label>
            <input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} required />
          </div>
          <div className="admin-form-row">
            <label>Longitude</label>
            <input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} required />
          </div>
          <button className="admin-btn admin-btn-primary" type="submit" disabled={saving}>
            {saving ? "Saving..." : editingId ? "Save changes" : "Create gallery"}
          </button>
          <button className="admin-btn" type="button" onClick={() => setShowCreateForm(false)}>
            Cancel
          </button>
        </form>
      )}

      {error && <p className="admin-error">{error}</p>}
      {loading && <p>Loading...</p>}

      {!loading && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Published</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <React.Fragment key={item.id}>
                <tr>
                  <td>{item.name}</td>
                  <td>{item.type}</td>
                  <td>
                    <span className={"admin-badge " + (item.isPublished ? "admin-badge-success" : "admin-badge-neutral")}>
                      {item.isPublished ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td>
                    <button className="admin-btn" onClick={() => toggleExpand(item.id)}>
                      {expandedId === item.id ? "Close" : "Manage"}
                    </button>
                    <button className="admin-btn" onClick={() => startEdit(item)}>
                      Edit
                    </button>
                    <button className="admin-btn admin-btn-success" onClick={() => handlePublishToggle(item)}>
                      {item.isPublished ? "Unpublish" : "Publish"}
                    </button>
                    <button className="admin-btn admin-btn-danger" onClick={() => handleDelete(item.id, item.name)}>
                      Delete
                    </button>
                  </td>
                </tr>

                {expandedId === item.id && (
                  <tr className="admin-detail-row">
                    <td colSpan={4}>
                      <p className="admin-page-note" style={{ marginTop: 0 }}>
                        Photo upload
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingId === item.id}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(item.id, file);
                        }}
                      />
                      {uploadingId === item.id && <span> Uploading...</span>}

                      <p className="admin-page-note">Exhibitions</p>
                      {exhibitionsLoading && <p>Loading exhibitions...</p>}
                      {!exhibitionsLoading && exhibitions.length === 0 && <p>No exhibitions yet.</p>}
                      {!exhibitionsLoading && exhibitions.length > 0 && (
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Dates</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {exhibitions.map((ex) => (
                              <tr key={ex.id}>
                                <td>{ex.name}</td>
                                <td>
                                  {new Date(ex.startDate).toLocaleDateString()} - {new Date(ex.endDate).toLocaleDateString()}
                                </td>
                                <td>
                                  <button
                                    className="admin-btn admin-btn-danger"
                                    onClick={() => handleDeleteExhibition(item.id, ex.id, ex.name)}
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      {!showExhibitionForm && (
                        <button className="admin-btn" onClick={() => setShowExhibitionForm(true)}>
                          + Add exhibition
                        </button>
                      )}

                      {showExhibitionForm && (
                        <form className="admin-form-card" onSubmit={(e) => handleCreateExhibition(item.id, e)}>
                          <div className="admin-form-row">
                            <label>Name</label>
                            <input
                              value={exhibitionForm.name}
                              onChange={(e) => setExhibitionForm({ ...exhibitionForm, name: e.target.value })}
                              required
                            />
                          </div>
                          <div className="admin-form-row">
                            <label>Start date</label>
                            <input
                              type="date"
                              value={exhibitionForm.startDate}
                              onChange={(e) => setExhibitionForm({ ...exhibitionForm, startDate: e.target.value })}
                              required
                            />
                          </div>
                          <div className="admin-form-row">
                            <label>End date</label>
                            <input
                              type="date"
                              value={exhibitionForm.endDate}
                              onChange={(e) => setExhibitionForm({ ...exhibitionForm, endDate: e.target.value })}
                              required
                            />
                          </div>
                          <button className="admin-btn admin-btn-primary" type="submit">
                            Create exhibition
                          </button>
                          <button className="admin-btn" type="button" onClick={() => setShowExhibitionForm(false)}>
                            Cancel
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
