import React, { useEffect, useState } from "react";
import { adminApi } from "../api";

interface Submission {
  id: string;
  name: string;
  approvalStatus: string;
  submittedById: string;
}

export function SubmissionsPage() {
  const [items, setItems] = useState<Submission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);

  function load() {
    setLoading(true);
    adminApi
      .submissionsQueue()
      .then((result) => setItems(result.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleApprove(id: string, name: string) {
    if (!confirm(`Approve "${name}"? It will become a real, visible gallery. Note: you'll still need to publish it separately afterward.`)) return;
    setActingOn(id);
    try {
      await adminApi.approveSubmission(id);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActingOn(null);
    }
  }

  async function handleReject(id: string, name: string) {
    const reviewNote = prompt(`Reason for rejecting "${name}"? (shown to the person who submitted it)`);
    if (reviewNote === null) return; // cancelled
    setActingOn(id);
    try {
      await adminApi.rejectSubmission(id, reviewNote || "No reason given");
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActingOn(null);
    }
  }

  return (
    <div>
      <h1 className="admin-page-title">Submissions</h1>
      {error && <p className="admin-error">{error}</p>}
      {loading && <p>Loading...</p>}
      {!loading && items.length === 0 && <p>No pending submissions right now.</p>}
      {!loading && items.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Submitted by</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>
                  <span className="admin-badge admin-badge-neutral">{item.approvalStatus}</span>
                </td>
                <td>{item.submittedById}</td>
                <td>
                  <button
                    className="admin-btn admin-btn-success"
                    disabled={actingOn === item.id}
                    onClick={() => handleApprove(item.id, item.name)}
                  >
                    Approve
                  </button>
                  <button
                    className="admin-btn admin-btn-danger"
                    disabled={actingOn === item.id}
                    onClick={() => handleReject(item.id, item.name)}
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
