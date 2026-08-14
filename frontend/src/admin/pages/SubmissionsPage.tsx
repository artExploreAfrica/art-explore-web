import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi, Pagination } from "../api";
import { formatOpeningHours, Tag } from "../institutionShared";

interface Submission {
  id: string;
  name: string;
  description?: string | null;
  type?: string;
  address?: string;
  area?: string;
  subArea?: string | null;
  lat?: number;
  lng?: number;
  mapUrl?: string | null;
  website?: string | null;
  instagram?: string | null;
  phone?: string | null;
  email?: string | null;
  openingHours?: any;
  hasResidency?: boolean;
  hasSocial?: boolean;
  images?: string[];
  tags?: { id: string; label: string }[];
  subCategory?: { name: string } | null;
  submittedBy?: { fullName: string; email: string } | null;
  status: string;
  createdAt?: string;
  [key: string]: any;
}

/** A live, already-approved institution carrying a proposed change. */
interface PendingEdit {
  id: string;
  name: string;
  tags?: { id: string; name: string }[];
  pendingChanges: Record<string, any>;
  pendingChangesSubmittedBy?: { fullName: string; email: string } | null;
  [key: string]: any;
}

/** Human-readable labels for the fields a pending edit can touch. */
const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  description: "Description",
  type: "Type",
  address: "Address",
  area: "Area",
  subArea: "Sub-area",
  lat: "Latitude",
  lng: "Longitude",
  mapUrl: "Map URL",
  website: "Website",
  instagram: "Instagram",
  phone: "Phone",
  email: "Email",
  notes: "Internal notes",
  hasResidency: "Runs a residency programme",
  hasSocial: "Has a social presence",
  subCategoryId: "Sub-category",
  openingHours: "Opening hours",
  tagIds: "Tags",
};

/** One row of a diff: label, the live value, and the proposed value. */
interface DiffRow {
  field: string;
  before: string;
  after: string;
}

export function SubmissionsPage() {
  const [items, setItems] = useState<Submission[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  // Pending edits — proposed changes to already-approved institutions. A
  // separate queue from the table above: those are brand-new venues awaiting
  // their first approval, these are edits to venues already live.
  const [edits, setEdits] = useState<PendingEdit[]>([]);
  const [editsPagination, setEditsPagination] = useState<Pagination | null>(null);
  const [editsPage, setEditsPage] = useState(1);
  const [editsError, setEditsError] = useState<string | null>(null);
  const [editsLoading, setEditsLoading] = useState(true);
  const [rejectingEditId, setRejectingEditId] = useState<string | null>(null);
  const [editReason, setEditReason] = useState("");
  const [editBusyId, setEditBusyId] = useState<string | null>(null);
  // Tag names for the diff view — pendingChanges.tagIds is just ids.
  const [allTags, setAllTags] = useState<Tag[]>([]);

  function load() {
    setLoading(true);
    adminApi
      .submissionsQueue(page)
      .then((result) => {
        setItems(result.data);
        setPagination(result.pagination);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [page]);

  function loadEdits() {
    setEditsLoading(true);
    adminApi
      .pendingEdits(editsPage)
      .then((result) => {
        setEdits(result.data);
        setEditsPagination(result.pagination);
      })
      .catch((err) => setEditsError(err.message))
      .finally(() => setEditsLoading(false));
  }

  useEffect(loadEdits, [editsPage]);

  useEffect(() => {
    async function loadAllTags() {
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
      } catch {
        // Non-fatal: the diff below just falls back to showing raw tag ids.
      }
    }
    loadAllTags();
  }, []);

  const tagNameById = useMemo(() => {
    const map = new Map<string, string>();
    allTags.forEach((t) => map.set(t.id, t.label));
    return map;
  }, [allTags]);

  function formatValue(field: string, value: any): string {
    if (value === null || value === undefined || value === "") return "—";
    if (field === "tagIds" && Array.isArray(value)) {
      return value.length === 0 ? "—" : value.map((id) => tagNameById.get(id) || id).join(", ");
    }
    if (field === "openingHours") return "(changed — see the institution's edit form for detail)";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
  }

  /** Live value vs proposed value for every field the edit actually touches. */
  function computeDiff(item: PendingEdit): DiffRow[] {
    const liveTagIds = (item.tags || []).map((t) => t.id);
    return Object.keys(item.pendingChanges)
      .map((field) => {
        const before = field === "tagIds" ? liveTagIds : item[field];
        const after = item.pendingChanges[field];
        return { field, before, after };
      })
      .filter(({ before, after }) => JSON.stringify(before) !== JSON.stringify(after))
      .map(({ field, before, after }) => ({
        field: FIELD_LABELS[field] || field,
        before: formatValue(field, before),
        after: formatValue(field, after),
      }));
  }

  async function handleApprove(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await adminApi.approveSubmission(id);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await adminApi.rejectSubmission(id, reason);
      setRejectingId(null);
      setReason("");
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleApproveEdit(id: string) {
    setEditBusyId(id);
    setEditsError(null);
    try {
      await adminApi.approveInstitutionEdit(id);
      loadEdits();
    } catch (err: any) {
      setEditsError(err.message);
    } finally {
      setEditBusyId(null);
    }
  }

  async function handleRejectEdit(id: string) {
    setEditBusyId(id);
    setEditsError(null);
    try {
      await adminApi.rejectInstitutionEdit(id, editReason);
      setRejectingEditId(null);
      setEditReason("");
      loadEdits();
    } catch (err: any) {
      setEditsError(err.message);
    } finally {
      setEditBusyId(null);
    }
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Submissions</h1>
        <Link className="admin-btn admin-btn-primary" to="/admin/submit">
          + Submit institution
        </Link>
      </div>
      <p className="admin-page-note">Galleries waiting for review before they go live on the public site.</p>

      {error && <p className="admin-error">{error}</p>}
      {loading && <p>Loading...</p>}

      {!loading && items.length === 0 && <p className="admin-page-note">No pending submissions.</p>}

      {!loading && items.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Location</th>
              <th>Submitted by</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <React.Fragment key={item.id}>
                <tr>
                  <td>{item.name}</td>
                  <td>{[item.area, item.subArea].filter(Boolean).join(", ") || "—"}</td>
                  <td>{item.submittedBy?.email || "—"}</td>
                  <td>
                    <span className="admin-badge admin-badge-neutral">{item.status}</span>
                  </td>
                  <td>
                    <button
                      className="admin-btn"
                      onClick={() => setViewingId(viewingId === item.id ? null : item.id)}
                    >
                      {viewingId === item.id ? "Hide" : "View"}
                    </button>
                    <button
                      className="admin-btn admin-btn-success"
                      disabled={busyId === item.id}
                      onClick={() => handleApprove(item.id)}
                    >
                      Approve
                    </button>
                    <button
                      className="admin-btn admin-btn-danger"
                      disabled={busyId === item.id}
                      onClick={() => setRejectingId(rejectingId === item.id ? null : item.id)}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
                {viewingId === item.id && (
                  <tr className="admin-detail-row">
                    <td colSpan={5}>
                      <div className="admin-form-card" style={{ maxWidth: "none", margin: 0 }}>
                        <strong>Details</strong>
                        <div className="admin-form-row">
                          <label>Description</label>
                          <p className="admin-page-note" style={{ marginTop: 0 }}>
                            {item.description || "—"}
                          </p>
                        </div>
                        <div className="admin-form-row">
                          <label>Type</label>
                          {item.type ? item.type.replace(/_/g, " ") : "—"}
                        </div>
                        <div className="admin-form-row">
                          <label>Address</label>
                          {item.address || "—"}
                        </div>
                        <div className="admin-form-row">
                          <label>Coordinates</label>
                          {item.lat !== undefined && item.lng !== undefined ? `${item.lat}, ${item.lng}` : "—"}
                          {item.mapUrl && (
                            <>
                              {" — "}
                              <a href={item.mapUrl} target="_blank" rel="noreferrer">
                                Map link
                              </a>
                            </>
                          )}
                        </div>
                        <div className="admin-form-row">
                          <label>Website</label>
                          {item.website ? (
                            <a href={item.website} target="_blank" rel="noreferrer">
                              {item.website}
                            </a>
                          ) : (
                            "—"
                          )}
                        </div>
                        <div className="admin-form-row">
                          <label>Instagram</label>
                          {item.instagram || "—"}
                        </div>
                        <div className="admin-form-row">
                          <label>Phone</label>
                          {item.phone || "—"}
                        </div>
                        <div className="admin-form-row">
                          <label>Email</label>
                          {item.email || "—"}
                        </div>
                        <div className="admin-form-row">
                          <label>Sub-category</label>
                          {item.subCategory?.name || "—"}
                        </div>
                        <div className="admin-form-row">
                          <label>Tags</label>
                          {item.tags && item.tags.length > 0 ? item.tags.map((t) => t.label).join(", ") : "—"}
                        </div>
                        <div className="admin-form-row">
                          <label>Flags</label>
                          {[item.hasResidency && "Runs a residency programme", item.hasSocial && "Has a social presence"]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </div>
                        <div className="admin-form-row">
                          <label>Opening hours</label>
                          {formatOpeningHours(item.openingHours).length === 0 ? (
                            "Not recorded"
                          ) : (
                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                              {formatOpeningHours(item.openingHours).map((row) => (
                                <li key={row.label}>
                                  {row.label}: {row.value}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div className="admin-form-row">
                          <label>Images</label>
                          {item.images && item.images.length > 0 ? (
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {item.images.map((url) => (
                                <img key={url} src={url} alt="" className="admin-thumb" title={url} />
                              ))}
                            </div>
                          ) : (
                            "None uploaded"
                          )}
                        </div>
                        <div className="admin-form-row">
                          <label>Submitted by</label>
                          {item.submittedBy
                            ? `${item.submittedBy.fullName} (${item.submittedBy.email})`
                            : "—"}
                          {item.createdAt ? ` on ${new Date(item.createdAt).toLocaleDateString()}` : ""}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                {rejectingId === item.id && (
                  <tr className="admin-detail-row">
                    <td colSpan={5}>
                      <div className="admin-form-row">
                        <label>Reason for rejection</label>
                        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Let the submitter know why" />
                      </div>
                      <button className="admin-btn admin-btn-danger" disabled={busyId === item.id} onClick={() => handleReject(item.id)}>
                        Confirm reject
                      </button>
                      <button className="admin-btn" onClick={() => setRejectingId(null)}>
                        Cancel
                      </button>
                    </td>
                  </tr>
                )}
              </React.Fragment>
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

      <hr className="admin-form-divider" />

      <div className="admin-page-header">
        <h1 className="admin-page-title">Pending Edits</h1>
      </div>
      <p className="admin-page-note">
        Changes proposed to already-approved, live institutions. The institution stays exactly as it
        is now — including staying published if it already was — until you approve the change below.
      </p>

      {editsError && <p className="admin-error">{editsError}</p>}
      {editsLoading && <p>Loading...</p>}

      {!editsLoading && edits.length === 0 && <p className="admin-page-note">No pending edits.</p>}

      {!editsLoading &&
        edits.map((item) => {
          const diff = computeDiff(item);
          return (
            <div key={item.id} className="admin-form-card">
              <strong>{item.name}</strong>
              <p className="admin-page-note" style={{ marginTop: 4 }}>
                Proposed by {item.pendingChangesSubmittedBy?.fullName || "unknown"}
                {item.pendingChangesSubmittedBy?.email ? ` (${item.pendingChangesSubmittedBy.email})` : ""}
              </p>

              {diff.length === 0 ? (
                <p className="admin-page-note">No fields differ from the live values.</p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Current</th>
                      <th>Proposed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diff.map((row) => (
                      <tr key={row.field}>
                        <td>{row.field}</td>
                        <td>{row.before}</td>
                        <td>{row.after}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div style={{ marginTop: 10 }}>
                <button
                  className="admin-btn admin-btn-success"
                  disabled={editBusyId === item.id}
                  onClick={() => handleApproveEdit(item.id)}
                >
                  Approve edit
                </button>
                <button
                  className="admin-btn admin-btn-danger"
                  disabled={editBusyId === item.id}
                  onClick={() => setRejectingEditId(rejectingEditId === item.id ? null : item.id)}
                >
                  Reject edit
                </button>
              </div>

              {rejectingEditId === item.id && (
                <div className="admin-form-row" style={{ marginTop: 10 }}>
                  <label>Reason for rejection</label>
                  <input
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="Let the submitter know why"
                  />
                  <button
                    className="admin-btn admin-btn-danger"
                    disabled={editBusyId === item.id}
                    onClick={() => handleRejectEdit(item.id)}
                  >
                    Confirm reject
                  </button>
                  <button className="admin-btn" onClick={() => setRejectingEditId(null)}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })}

      {editsPagination && editsPagination.totalPages > 1 && (
        <div className="admin-pagination">
          <button className="admin-btn" disabled={editsPage <= 1} onClick={() => setEditsPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {editsPagination.page} of {editsPagination.totalPages} — {editsPagination.total} total
          </span>
          <button
            className="admin-btn"
            disabled={editsPage >= editsPagination.totalPages}
            onClick={() => setEditsPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
