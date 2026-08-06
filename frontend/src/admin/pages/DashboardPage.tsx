import React, { useEffect, useState } from "react";
import { adminApi } from "../api";

interface DashboardStats {
  total: number;
  published: number;
  drafts: number;
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .dashboard()
      .then((result) => setStats(result.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="admin-page-title">Dashboard</h1>
      {loading && <p>Loading...</p>}
      {error && <p className="admin-error">{error}</p>}
      {stats && (
        <div className="admin-stat-grid">
          <div className="admin-stat-card">
            <p className="admin-stat-label">Total galleries</p>
            <p className="admin-stat-value">{stats.total}</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-label">Published</p>
            <p className="admin-stat-value">{stats.published}</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-label">Drafts</p>
            <p className="admin-stat-value">{stats.drafts}</p>
          </div>
        </div>
      )}
    </div>
  );
}
