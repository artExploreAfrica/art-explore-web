import React, { useEffect, useState } from "react";
import { adminApi, Pagination } from "../api";

/** An exhibition awaiting review — from a contributor or the public form. */
interface ExhibitionSubmission {
  id: string;
  name: string;
  description?: string | null;
  link?: string | null;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  notes?: string | null;
  institution?: { id: string; name: string } | null;
  submittedBy?: { fullName: string; email: string } | null;
  createdAt: string;
}

const day = (iso: string) => new Date(iso).toLocaleDateString();

/**
 * Review queue for submitted exhibitions, shown under Submissions. Approving
 * doesn't put a show live — it still needs activating from the venue's
 * exhibitions on the Institutions page (approved ≠ published, as for venues).
 */
export function ExhibitionSubmissions() {
  const [items, setItems] = useState<ExhibitionSubmission[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  function load() {
    setLoading(true);
    setError(null);
    adminApi
      .exhibitionSubmissions(page)
      .then((result) => {
        setItems(result.data);
        setPagination(result.pagination);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [page]);

  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      await adminApi.approveExhibition(id);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    if (!reason.trim()) return;
    setBusyId(id);
    try {
      await adminApi.rejectExhibition(id, reason.trim());
      setRejectingId(null);
      setReason("");
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ marginTop: 40 }}>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Exhibition submissions</h1>
      </div>
      <p className="admin-page-note">
        Approving keeps a show inactive; switch it on from the venue’s exhibitions on the Institutions page.
      </p>

      {error && <p className="admin-error">{error}</p>}
      {loading && <p>Loading...</p>}
      {!loading && items.length === 0 && <p className="admin-page-note">No exhibitions waiting for review.</p>}

      {!loading && items.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Exhibition</th>
              <th>Venue</th>
              <th>Dates</th>
              <th>From</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <React.Fragment key={item.id}>
                <tr>
                  <td>
                    <strong>{item.name}</strong>
                  </td>
                  <td>{item.institution?.name ?? "—"}</td>
                  <td>
                    {day(item.startDate)} – {day(item.endDate)}
                    <div className="admin-table-sub">
                      {item.startTime}–{item.endTime}
                    </div>
                  </td>
                  <td>
                    {item.submittedBy ? (
                      <>
                        {item.submittedBy.fullName}
                        <div className="admin-table-sub">{item.submittedBy.email}</div>
                      </>
                    ) : (
                      <span className="admin-badge admin-badge-neutral">Public form</span>
                    )}
                  </td>
                  <td>
                    <button className="admin-btn" onClick={() => setViewingId(viewingId === item.id ? null : item.id)}>
                      {viewingId === item.id ? "Hide" : "View"}
                    </button>
                    <button
                      className="admin-btn admin-btn-primary"
                      disabled={busyId === item.id}
                      onClick={() => handleApprove(item.id)}
                    >
                      Approve
                    </button>
                    <button className="admin-btn admin-btn-danger" onClick={() => setRejectingId(item.id)}>
                      Reject
                    </button>
                  </td>
                </tr>
                {viewingId === item.id && (
                  <tr className="admin-detail-row">
                    <td colSpan={5}>
                      <div className="admin-form-card" style={{ maxWidth: "none", margin: 0 }}>
                        <div className="admin-form-row">
                          <label>About</label>
                          <p className="admin-page-note" style={{ marginTop: 0 }}>
                            {item.description || "—"}
                          </p>
                        </div>
                        <div className="admin-form-row">
                          <label>Link</label>
                          {item.link ? (
                            <a href={item.link} target="_blank" rel="noreferrer">
                              {item.link}
                            </a>
                          ) : (
                            "—"
                          )}
                        </div>
                        <div className="admin-form-row">
                          <label>Internal notes</label>
                          <p className="admin-page-note" style={{ marginTop: 0, whiteSpace: "pre-wrap" }}>
                            {item.notes || "—"}
                          </p>
                        </div>
                        <div className="admin-form-row">
                          <label>Received</label>
                          {day(item.createdAt)}
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
                        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Kept on record with the submission" />
                      </div>
                      <button
                        className="admin-btn admin-btn-danger"
                        disabled={busyId === item.id || !reason.trim()}
                        onClick={() => handleReject(item.id)}
                      >
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
    </div>
  );
}
