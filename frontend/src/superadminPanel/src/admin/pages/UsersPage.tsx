import React, { useEffect, useState } from "react";
import { adminApi } from "../api";

interface AdminUserRow {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
}

const emptyForm = { fullName: "", email: "", password: "", role: "ADMIN" };

export function UsersPage() {
  const [items, setItems] = useState<AdminUserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    adminApi
      .users()
      .then((result) => setItems(result.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await adminApi.createAdminUser(form);
      setShowForm(false);
      setForm(emptyForm);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: string, name: string) {
    if (!confirm(`Deactivate ${name}? They won't be able to log in until reactivated.`)) return;
    try {
      await adminApi.deactivateUser(id);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Users</h1>
        <button className="admin-btn admin-btn-primary" onClick={() => setShowForm(true)}>
          + New admin
        </button>
      </div>

      {showForm && (
        <form className="admin-form-card" onSubmit={handleSubmit}>
          <div className="admin-form-row">
            <label>Full name</label>
            <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
          </div>
          <div className="admin-form-row">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="admin-form-row">
            <label>Temporary password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <div className="admin-form-row">
            <label>Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="ADMIN">Admin</option>
              <option value="SUPER_ADMIN">Super admin</option>
            </select>
          </div>
          <button className="admin-btn admin-btn-primary" type="submit" disabled={saving}>
            {saving ? "Creating..." : "Create admin"}
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
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.fullName}</td>
                <td>{item.email}</td>
                <td>{item.role}</td>
                <td>
                  <span className={"admin-badge " + (item.isActive ? "admin-badge-success" : "admin-badge-danger")}>
                    {item.isActive ? "Active" : "Deactivated"}
                  </span>
                </td>
                <td>
                  {item.isActive && (
                    <button className="admin-btn admin-btn-danger" onClick={() => handleDeactivate(item.id, item.fullName)}>
                      Deactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
