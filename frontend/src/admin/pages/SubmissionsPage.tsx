import React, { useEffect, useState } from "react";
import { adminApi, Pagination } from "../api";

interface Submission {
  id: string;
  name: string;
  area?: string;
  subArea?: string;
  submittedByEmail?: string;
  status: string;
  createdAt?: string;
  [key: string]: any;
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

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Submissions</h1>
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
                  <td>{item.submittedByEmail || "—"}</td>
                  <td>
                    <span className="admin-badge admin-badge-neutral">{item.status}</span>
                  </td>
                  <td>
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
    </div>
  );
}
