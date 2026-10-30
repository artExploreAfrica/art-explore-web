import React, { useEffect, useState } from "react";
import { adminApi, Pagination } from "../api";

/** A message from the home-page contact form ("Reach out" / "Learn more"). */
interface Enquiry {
  id: string;
  intent: "REACH_OUT" | "LEARN_MORE";
  name: string;
  email: string;
  organisation?: string | null;
  message: string;
  status: "NEW" | "HANDLED";
  handledAt?: string | null;
  handledBy?: { fullName: string; email: string } | null;
  createdAt: string;
}

const INTENT_LABEL: Record<Enquiry["intent"], string> = {
  REACH_OUT: "Reach out",
  LEARN_MORE: "Learn more",
};

export function EnquiriesPage() {
  const [status, setStatus] = useState<Enquiry["status"]>("NEW");
  const [items, setItems] = useState<Enquiry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    adminApi
      .enquiries(status, page)
      .then((result) => {
        setItems(result.data);
        setPagination(result.pagination);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [status, page]);

  function showStatus(next: Enquiry["status"]) {
    setStatus(next);
    setPage(1);
  }

  async function setEnquiryStatus(id: string, next: Enquiry["status"]) {
    setBusyId(id);
    try {
      await adminApi.updateEnquiry(id, next);
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
        <h1 className="admin-page-title">Enquiries</h1>
        <div>
          <button
            className={`admin-btn${status === "NEW" ? " admin-btn-primary" : ""}`}
            onClick={() => showStatus("NEW")}
            aria-pressed={status === "NEW"}
          >
            New
          </button>
          <button
            className={`admin-btn${status === "HANDLED" ? " admin-btn-primary" : ""}`}
            onClick={() => showStatus("HANDLED")}
            aria-pressed={status === "HANDLED"}
          >
            Handled
          </button>
        </div>
      </div>
      <p className="admin-page-note">
        Messages from the home page’s “Get involved” form. Reply by email, then mark them handled.
      </p>

      {error && <p className="admin-error">{error}</p>}
      {loading && <p>Loading...</p>}

      {!loading && items.length === 0 && (
        <p className="admin-page-note">{status === "NEW" ? "No new enquiries." : "Nothing handled yet."}</p>
      )}

      {!loading && items.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>From</th>
              <th>About</th>
              <th>Message</th>
              <th>Received</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.name}</strong>
                  <div className="admin-table-sub">
                    <a href={`mailto:${item.email}`}>{item.email}</a>
                  </div>
                  {item.organisation && <div className="admin-table-sub">{item.organisation}</div>}
                </td>
                <td>
                  <span className="admin-badge admin-badge-neutral">{INTENT_LABEL[item.intent]}</span>
                </td>
                <td style={{ whiteSpace: "pre-wrap", maxWidth: 420 }}>{item.message}</td>
                <td>
                  {new Date(item.createdAt).toLocaleDateString()}
                  {item.status === "HANDLED" && item.handledBy && (
                    <div className="admin-table-sub">
                      Handled by {item.handledBy.fullName}
                      {item.handledAt ? ` on ${new Date(item.handledAt).toLocaleDateString()}` : ""}
                    </div>
                  )}
                </td>
                <td>
                  {item.status === "NEW" ? (
                    <button
                      className="admin-btn admin-btn-primary"
                      disabled={busyId === item.id}
                      onClick={() => setEnquiryStatus(item.id, "HANDLED")}
                    >
                      Mark handled
                    </button>
                  ) : (
                    <button className="admin-btn" disabled={busyId === item.id} onClick={() => setEnquiryStatus(item.id, "NEW")}>
                      Reopen
                    </button>
                  )}
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
