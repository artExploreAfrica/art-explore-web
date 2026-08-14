import React, { useEffect, useState } from "react";
import { adminApi } from "../api";

/**
 * Mirrors `DashboardCounts` in src/services/dashboard.service.ts. The counts
 * the cards need are nested under `institutions`, not flat on `data` — reading
 * `data.total` gave `undefined`, which is why every card rendered blank.
 *
 * Response shape: { success, message, data: { institutions: {...}, ... } }
 */
interface DashboardStats {
  institutions: {
    total: number;
    published: number;
    drafts: number;
  };
  pendingSubmissions: number;
  pendingExhibitions: number;
  pendingReviews: number;
  admins: number;
  publicUsers: number;
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
            <p className="admin-stat-value">{stats.institutions.total}</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-label">Published</p>
            <p className="admin-stat-value">{stats.institutions.published}</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-label">Drafts</p>
            <p className="admin-stat-value">{stats.institutions.drafts}</p>
          </div>
          {/* The remaining counts are already returned by GET /admin/dashboard
              and were simply not being rendered. Nothing here is derived or
              hardcoded — every value comes straight off the response. */}
          <div className="admin-stat-card">
            <p className="admin-stat-label">Pending submissions</p>
            <p className="admin-stat-value">{stats.pendingSubmissions}</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-label">Pending exhibitions</p>
            <p className="admin-stat-value">{stats.pendingExhibitions}</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-label">Pending reviews</p>
            <p className="admin-stat-value">{stats.pendingReviews}</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-label">Admins</p>
            <p className="admin-stat-value">{stats.admins}</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-label">Public users</p>
            <p className="admin-stat-value">{stats.publicUsers}</p>
          </div>
        </div>
      )}
    </div>
  );
}
