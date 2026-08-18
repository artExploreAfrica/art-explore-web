import React, { useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  FileEdit,
  Inbox,
  CalendarClock,
  MessageSquareWarning,
  MapPin,
  LayoutGrid,
  Clock,
  AlertCircle,
} from "lucide-react";
import { adminApi } from "../api";
import { formatInstitutionType } from "../institutionShared";

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
  byType: { type: string; count: number }[];
  byArea: { area: string; count: number }[];
  recent: {
    id: string;
    name: string;
    type: string;
    area: string | null;
    isPublished: boolean;
    createdAt: string;
  }[];
}

/** "2026-08-14T..." → "3 days ago" / "just now" / "Aug 14". Small, self-contained —
 * not worth pulling in a date library for one relative-time label. */
function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Bars({ rows, total, altColor }: { rows: { label: string; count: number }[]; total: number; altColor?: boolean }) {
  if (rows.length === 0) {
    return <p className="admin-page-note" style={{ marginTop: 0 }}>No data yet.</p>;
  }
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="admin-bar-list">
      {rows.map((row) => (
        <div className="admin-bar-row" key={row.label}>
          <span className="admin-bar-row-label" title={row.label}>{row.label}</span>
          <div className="admin-bar-track">
            <div
              className={"admin-bar-fill" + (altColor ? " admin-bar-fill-alt" : "")}
              style={{ width: `${Math.max((row.count / max) * 100, 4)}%` }}
            />
          </div>
          <span className="admin-bar-row-value">
            {row.count}
            <span style={{ opacity: 0.6 }}> · {total > 0 ? Math.round((row.count / total) * 100) : 0}%</span>
          </span>
        </div>
      ))}
    </div>
  );
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

  const pendingTotal = stats
    ? stats.pendingSubmissions + stats.pendingExhibitions + stats.pendingReviews
    : 0;

  return (
    <div>
      <div className="admin-page-header">
        <div className="admin-page-header-text">
          <h1 className="admin-page-title">Dashboard</h1>
          <p className="admin-page-subtitle">Overview of institutions, distribution, and recent activity.</p>
        </div>
      </div>

      {loading && (
        <div className="admin-loading">
          <span className="admin-spinner" />
          Loading dashboard...
        </div>
      )}
      {error && (
        <p className="admin-error">
          <AlertCircle size={16} />
          {error}
        </p>
      )}

      {stats && (
        <>
          <div className="admin-kpi-grid">
            <div className="admin-kpi-card">
              <div className="admin-kpi-top">
                <p className="admin-kpi-label">Total institutions</p>
                <span className="admin-kpi-icon admin-kpi-icon-brown"><Building2 size={17} /></span>
              </div>
              <p className="admin-kpi-value">{stats.institutions.total}</p>
              <p className="admin-kpi-foot">Across every type and location</p>
            </div>
            <div className="admin-kpi-card">
              <div className="admin-kpi-top">
                <p className="admin-kpi-label">Published</p>
                <span className="admin-kpi-icon"><CheckCircle2 size={17} /></span>
              </div>
              <p className="admin-kpi-value">{stats.institutions.published}</p>
              <p className="admin-kpi-foot">
                {stats.institutions.total > 0
                  ? Math.round((stats.institutions.published / stats.institutions.total) * 100)
                  : 0}
                % of total live on the public site
              </p>
            </div>
            <div className="admin-kpi-card">
              <div className="admin-kpi-top">
                <p className="admin-kpi-label">Drafts</p>
                <span className="admin-kpi-icon admin-kpi-icon-warn"><FileEdit size={17} /></span>
              </div>
              <p className="admin-kpi-value">{stats.institutions.drafts}</p>
              <p className="admin-kpi-foot">Saved but not yet published</p>
            </div>
            <div className="admin-kpi-card">
              <div className="admin-kpi-top">
                <p className="admin-kpi-label">Pending review</p>
                <span className="admin-kpi-icon admin-kpi-icon-warn"><Inbox size={17} /></span>
              </div>
              <p className="admin-kpi-value">{pendingTotal}</p>
              <p className="admin-kpi-foot">
                {stats.pendingSubmissions} submissions · {stats.pendingExhibitions} exhibitions · {stats.pendingReviews} reviews
              </p>
            </div>
          </div>

          <div className="admin-dash-grid">
            <div className="admin-panel">
              <div className="admin-panel-head">
                <h2 className="admin-section-title"><LayoutGrid size={16} /> By type</h2>
              </div>
              <Bars
                rows={stats.byType.map((r) => ({ label: formatInstitutionType(r.type), count: r.count }))}
                total={stats.institutions.total}
              />
            </div>

            <div className="admin-panel">
              <div className="admin-panel-head">
                <h2 className="admin-section-title"><MapPin size={16} /> By location</h2>
              </div>
              <Bars
                rows={stats.byArea.map((r) => ({ label: r.area.charAt(0) + r.area.slice(1).toLowerCase(), count: r.count }))}
                total={stats.institutions.total}
                altColor
              />
            </div>

            <div className="admin-panel admin-panel-full">
              <div className="admin-panel-head">
                <h2 className="admin-section-title"><Clock size={16} /> Recent additions</h2>
              </div>
              {stats.recent.length === 0 ? (
                <p className="admin-page-note" style={{ marginTop: 0 }}>Nothing added yet.</p>
              ) : (
                <div className="admin-recent-list">
                  {stats.recent.map((item) => (
                    <div className="admin-recent-row" key={item.id}>
                      <span className="admin-recent-icon"><Building2 size={16} /></span>
                      <div className="admin-recent-body">
                        <p className="admin-recent-name">{item.name}</p>
                        <p className="admin-recent-meta">
                          {formatInstitutionType(item.type)}
                          {item.area ? ` · ${item.area.charAt(0) + item.area.slice(1).toLowerCase()}` : ""}
                        </p>
                      </div>
                      <span className={`admin-badge ${item.isPublished ? "admin-badge-success" : "admin-badge-neutral"}`}>
                        {item.isPublished ? "Published" : "Draft"}
                      </span>
                      <span className="admin-recent-time"><CalendarClock size={12} style={{ verticalAlign: -2, marginRight: 4 }} />{timeAgo(item.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {pendingTotal > 0 && (
            <p className="admin-notice" style={{ marginTop: "var(--ae-sp-4)" }}>
              <MessageSquareWarning size={16} />
              You have {pendingTotal} item{pendingTotal === 1 ? "" : "s"} waiting for review across submissions, exhibitions, and reviews.
            </p>
          )}
        </>
      )}
    </div>
  );
}
