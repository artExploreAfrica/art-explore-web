import React, { useEffect, useMemo, useState } from "react";
import { adminApi, Pagination } from "../api";
import "./TagsPage.css";

/** A space as the tag form shows it. */
interface Space {
  id: string;
  name: string;
  images: string[];
  isPublished: boolean;
}

interface TagRow {
  id: string;
  name: string;
  label: string;
  coverInstitutionId: string | null;
  coverInstitution?: Space | null;
  _count?: { institutions: number };
}

interface FormState {
  label: string;
  /** Machine name of the tag being edited; generated from the label for a new one. */
  name: string;
  spaceIds: string[];
  /** "" = automatic. */
  coverId: string;
}

const emptyForm: FormState = { label: "", name: "", spaceIds: [], coverId: "" };

/**
 * Mirrors the backend's tagNameFromLabel (src/services/tag.service.ts) so the
 * admin sees the machine name before saving. The server is the authority.
 */
const tagNameFromLabel = (text: string): string =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);

const photo = (s?: Space | null) => s?.images?.[0] ?? null;

function Thumb({ space, size = 36 }: { space?: Space | null; size?: number }) {
  const src = photo(space);
  const style = { width: size, height: size };
  if (!src) {
    return (
      <span className="tag-thumb tag-thumb--empty" style={style} aria-hidden="true">
        {space ? space.name.slice(0, 1).toUpperCase() : "—"}
      </span>
    );
  }
  return <img className="tag-thumb" style={style} src={src} alt="" loading="lazy" />;
}

export function TagsPage() {
  const [items, setItems] = useState<TagRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formLoading, setFormLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Every space, loaded once the first time the form opens.
  const [allSpaces, setAllSpaces] = useState<Space[] | null>(null);
  const [search, setSearch] = useState("");

  function load() {
    setLoading(true);
    adminApi
      .tags(page)
      .then((result) => {
        setItems(result.data);
        setPagination(result.pagination);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [page]);

  async function ensureSpaces() {
    if (allSpaces) return;
    const result = await adminApi.tagSpaceOptions();
    setAllSpaces(result.data);
  }

  async function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setSearch("");
    setFormError(null);
    setShowForm(true);
    setFormLoading(true);
    try {
      await ensureSpaces();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  }

  async function startEdit(tag: TagRow) {
    setEditingId(tag.id);
    setForm({ label: tag.label, name: tag.name, spaceIds: [], coverId: tag.coverInstitutionId ?? "" });
    setSearch("");
    setFormError(null);
    setShowForm(true);
    setFormLoading(true);
    try {
      const [detail] = await Promise.all([adminApi.tag(tag.id), ensureSpaces()]);
      const t = detail.data;
      setForm({
        label: t.label,
        name: t.name,
        spaceIds: (t.institutions ?? []).map((s: Space) => s.id),
        coverId: t.coverInstitutionId ?? "",
      });
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  const spaceById = useMemo(() => new Map((allSpaces ?? []).map((s) => [s.id, s])), [allSpaces]);
  const selected = useMemo(() => new Set(form.spaceIds), [form.spaceIds]);

  // Ticked spaces first, then the rest, each alphabetical; filtered by the search box.
  const visibleSpaces = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (allSpaces ?? [])
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .sort((a, b) => Number(selected.has(b.id)) - Number(selected.has(a.id)) || a.name.localeCompare(b.name));
  }, [allSpaces, search, selected]);

  // The cover can only be one of the ticked spaces.
  const coverChoices = useMemo(
    () => form.spaceIds.map((id) => spaceById.get(id)).filter(Boolean) as Space[],
    [form.spaceIds, spaceById],
  );
  const coverSpace = form.coverId ? spaceById.get(form.coverId) : undefined;

  function toggleSpace(id: string) {
    setForm((f) => {
      const on = f.spaceIds.includes(id);
      const spaceIds = on ? f.spaceIds.filter((x) => x !== id) : [...f.spaceIds, id];
      // Unticking the cover's space resets the cover to automatic.
      const coverId = on && f.coverId === id ? "" : f.coverId;
      return { ...f, spaceIds, coverId };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const payload = {
      label: form.label.trim(),
      institutionIds: form.spaceIds,
      coverInstitutionId: form.coverId || null,
    };
    try {
      if (editingId) {
        await adminApi.updateTag(editingId, payload);
      } else {
        await adminApi.createTag(payload);
      }
      closeForm();
      load();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(tag: TagRow) {
    const n = tag._count?.institutions ?? 0;
    const onSpaces = n ? ` It will be removed from ${n} space${n === 1 ? "" : "s"}.` : "";
    if (!confirm(`Delete the tag "${tag.label}"?${onSpaces} This can't be undone.`)) return;
    try {
      await adminApi.deleteTag(tag.id);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const generatedName = editingId ? form.name : tagNameFromLabel(form.label);

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Tags</h1>
        <button className="admin-btn admin-btn-primary" onClick={startCreate}>
          + New tag
        </button>
      </div>

      {showForm && (
        <form className="admin-form-card tag-form" onSubmit={handleSubmit}>
          <strong>{editingId ? `Edit tag — ${form.label || form.name}` : "New tag"}</strong>

          <div className="admin-form-row">
            <label htmlFor="tag-label">Tag name (what people see, e.g. Yoruba History)</label>
            <input
              id="tag-label"
              value={form.label}
              maxLength={60}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              required
              autoFocus
            />
            <p className="tag-hint">
              Machine name: <code>{generatedName || "—"}</code>
              {editingId ? " (stays the same when you rename the tag)" : " (created automatically)"}
            </p>
          </div>

          <div className="admin-form-row">
            <label htmlFor="tag-space-search">
              Spaces with this tag <span className="tag-count">{form.spaceIds.length} selected</span>
            </label>
            <input
              id="tag-space-search"
              type="search"
              placeholder="Search spaces…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={formLoading}
            />
            <div className="tag-space-list" role="group" aria-label="Spaces">
              {formLoading && <p className="tag-hint">Loading spaces…</p>}
              {!formLoading && visibleSpaces.length === 0 && (
                <p className="tag-hint">No spaces match “{search}”.</p>
              )}
              {!formLoading &&
                visibleSpaces.map((s) => (
                  <label key={s.id} className={`tag-space${selected.has(s.id) ? " is-on" : ""}`}>
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSpace(s.id)} />
                    <Thumb space={s} />
                    <span className="tag-space-name">{s.name}</span>
                    {!s.isPublished && <span className="tag-badge">Draft</span>}
                    {!photo(s) && <span className="tag-badge tag-badge--muted">No photo</span>}
                  </label>
                ))}
            </div>
          </div>

          <div className="admin-form-row">
            <label htmlFor="tag-cover">Cover (the photo shown for this tag on the home page)</label>
            <div className="tag-cover-row">
              <Thumb space={coverSpace} size={56} />
              <select
                id="tag-cover"
                value={form.coverId}
                onChange={(e) => setForm({ ...form, coverId: e.target.value })}
                disabled={formLoading || coverChoices.length === 0}
              >
                <option value="">Automatic</option>
                {coverChoices.map((s) => (
                  <option key={s.id} value={s.id} disabled={!photo(s)}>
                    {s.name}
                    {!photo(s) ? " (no photo)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <p className="tag-hint">
              {coverChoices.length === 0
                ? "Tick at least one space above to choose a cover."
                : "Choose from the spaces ticked above. Automatic picks one for you."}
            </p>
          </div>

          {formError && <p className="admin-error">{formError}</p>}

          <button className="admin-btn admin-btn-primary" type="submit" disabled={saving || formLoading}>
            {saving ? "Saving..." : editingId ? "Save changes" : "Create tag"}
          </button>
          <button className="admin-btn" type="button" onClick={closeForm}>
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
              <th>Cover</th>
              <th>Label</th>
              <th>Name</th>
              <th>Spaces</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <span className="tag-cover-cell" title={item.coverInstitution?.name ?? "Automatic"}>
                    <Thumb space={item.coverInstitution} />
                    <span className="tag-hint">{item.coverInstitution ? item.coverInstitution.name : "Automatic"}</span>
                  </span>
                </td>
                <td>{item.label}</td>
                <td>
                  <code>{item.name}</code>
                </td>
                <td>{item._count?.institutions ?? 0}</td>
                <td>
                  <button className="admin-btn" onClick={() => startEdit(item)}>
                    Edit
                  </button>
                  <button className="admin-btn admin-btn-danger" onClick={() => handleDelete(item)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="admin-pagination">
          <button className="admin-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {pagination.page} of {pagination.totalPages} — {pagination.total} total
          </span>
          <button className="admin-btn" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
