import React, { useEffect, useState } from "react";
import { adminApi } from "../api";

interface Tag {
  id: string;
  name: string;
  label: string;
  category: string;
}

const emptyForm = { name: "", label: "", category: "STYLE" };

export function TagsPage() {
  const [items, setItems] = useState<Tag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    adminApi
      .tags()
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

  function startEdit(tag: Tag) {
    setEditingId(tag.id);
    setForm({ name: tag.name, label: tag.label, category: tag.category });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await adminApi.updateTag(editingId, form);
      } else {
        await adminApi.createTag(form);
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Delete the tag "${label}"? This can't be undone.`)) return;
    try {
      await adminApi.deleteTag(id);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Tags</h1>
        <button className="admin-btn admin-btn-primary" onClick={startCreate}>
          + New tag
        </button>
      </div>

      {showForm && (
        <form className="admin-form-card" onSubmit={handleSubmit}>
          <div className="admin-form-row">
            <label>Machine name (e.g. CONTEMPORARY)</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="admin-form-row">
            <label>Display label (e.g. Contemporary)</label>
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              required
            />
          </div>
          <div className="admin-form-row">
            <label>Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="STYLE">Style</option>
              <option value="MEDIUM">Medium</option>
              <option value="THEME">Theme</option>
            </select>
          </div>
          <button className="admin-btn admin-btn-primary" type="submit" disabled={saving}>
            {saving ? "Saving..." : editingId ? "Save changes" : "Create tag"}
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
              <th>Label</th>
              <th>Name</th>
              <th>Category</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.label}</td>
                <td>{item.name}</td>
                <td>{item.category}</td>
                <td>
                  <button className="admin-btn" onClick={() => startEdit(item)}>
                    Edit
                  </button>
                  <button className="admin-btn admin-btn-danger" onClick={() => handleDelete(item.id, item.label)}>
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
