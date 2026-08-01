import React, { useEffect, useState } from "react";
import { adminApi } from "../api";

interface AuditLogEntry {
  id: string;
  action: string;
  createdAt: string;
}

export function AuditLogPage() {
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .auditLogs()
      .then((result) => setItems(result.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="admin-page-title">Audit log</h1>
      {loading && <p>Loading...</p>}
      {error && <p className="admin-error">{error}</p>}
      {!loading && !error && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.action}</td>
                <td>{new Date(item.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
