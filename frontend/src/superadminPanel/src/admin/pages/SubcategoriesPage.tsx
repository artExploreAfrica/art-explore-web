import React, { useEffect, useState } from "react";
import { adminApi } from "../api";

interface Subcategory {
  id: string;
  name: string;
  type: string;
}

const emptyForm = { name: "", type: "ART_GALLERY" };

export function SubcategoriesPage() {
  const [items, setItems] = useState<Subcategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    adminApi
      .subcategories()
      .then((result) => setItems(result.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function startEdit(item: Subcategory) {
    setEditingId(item.id);
    setForm({ name: item.name, type: item.type });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await adminApi.updateSubcategory(editingId, form);
      } else {
        await adminApi.createSubcategory(form);
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    try {
      await adminApi.deleteSubcategory(id);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Subcategories</h1>
        <button className="admin-btn admin-btn-primary" onClick={startCreate}>
          + New subcategory
        </button>
      </div>

      {showForm && (
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
          <button className="admin-btn admin-btn-primary" type="submit" disabled={saving}>
            {saving ? "Saving..." : editingId ? "Save changes" : "Create"}
          </button>
          <button className="admin-btn" type="button" onClick={() => setShowForm(false)}>
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.type}</td>
                <td>
                  <button className="admin-btn" onClick={() => startEdit(item)}>
                    Edit
                  </button>
                  <button className="admin-btn admin-btn-danger" onClick={() => handleDelete(item.id, item.name)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
