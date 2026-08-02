import React, { useEffect, useState } from "react";
import { adminApi, Pagination } from "../api";

interface AuditEntry {
  id: string;
  action: string;
  actorEmail?: string;
  targetType?: string;
  targetId?: string;
  createdAt?: string;
  [key: string]: any;
}

export function AuditLogPage() {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    adminApi
      .auditLogs(page)
      .then((result) => {
        setItems(result.data);
        setPagination(result.pagination);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [page]);

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Audit Log</h1>
      </div>
      <p className="admin-page-note">Read-only history of admin actions. This page never writes anything.</p>

      {error && <p className="admin-error">{error}</p>}
      {loading && <p>Loading...</p>}

      {!loading && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}</td>
                <td>{item.actorEmail || "—"}</td>
                <td>{item.action}</td>
                <td>
                  {item.targetType || ""} {item.targetId ? `#${item.targetId.slice(0, 8)}` : ""}
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
