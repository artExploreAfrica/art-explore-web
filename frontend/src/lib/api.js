// Thin fetch wrapper for the Art Explore backend.
//
// Every backend response uses one envelope:
//   success: { success: true,  message, data, pagination? }
//   error:   { success: false, message, errors? }
// This wrapper unwraps that envelope so callers get `data` directly and a
// thrown Error (with the backend's message) on failure.

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4555';
const API_PREFIX = '/api/v1';

/**
 * GET a JSON endpoint and return the parsed envelope.
 * @param {string} path  - path after /api/v1, e.g. "/institutions"
 * @param {Record<string, string|number|boolean>} [params] - query params
 * @returns {Promise<{ data: any, pagination?: object, message: string }>}
 */
export async function apiGet(path, params = {}) {
  const url = new URL(`${BASE_URL}${API_PREFIX}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });

  let res;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch {
    // Network-level failure (server down, CORS, no internet).
    throw new Error('Could not reach the API. Is the backend running on ' + BASE_URL + '?');
  }

  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.success) {
    throw new Error(json?.message || `Request failed (${res.status})`);
  }
  return json;
}

export { BASE_URL };
