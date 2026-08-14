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
 * @param {string} [token] - bearer token, for endpoints that require auth (e.g. /auth/me)
 * @returns {Promise<{ data: any, pagination?: object, message: string }>}
 */
export async function apiGet(path, params = {}, token) {
  const url = new URL(`${BASE_URL}${API_PREFIX}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });

  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, { headers });
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

/**
 * POST a JSON (or multipart) body and return the parsed envelope.
 * @param {string} path - path after /api/v1
 * @param {object|FormData} body
 * @param {{ token?: string, isFormData?: boolean, method?: string }} [opts]
 */
export async function apiPost(path, body, opts = {}) {
  const { token, isFormData = false, method = 'POST' } = opts;
  const headers = { Accept: 'application/json' };
  if (!isFormData) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${API_PREFIX}${path}`, {
      method,
      headers,
      body: isFormData ? body : JSON.stringify(body),
    });
  } catch {
    throw new Error('Could not reach the API. Is the backend running on ' + BASE_URL + '?');
  }

  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.success) {
    throw new Error(describeApiError(json, res.status));
  }
  return json;
}

/**
 * The backend's error envelope is `{ success, message, errors? }`. For a Zod
 * failure `message` is always the literal string "Validation failed" and every
 * piece of usable information lives in `errors`, an array of
 * `{ field, message }` — flatten it into the thrown message rather than
 * discarding it, so a field-level rejection stays actionable.
 */
function describeApiError(json, status) {
  const base = json?.message || `Request failed (${status})`;
  const errors = json?.errors;

  if (Array.isArray(errors) && errors.length > 0) {
    const fields = errors
      .map((e) => (e?.field ? `${e.field}: ${e.message}` : e?.message))
      .filter(Boolean)
      .join(' · ');
    return fields ? `${base} — ${fields}` : base;
  }

  return base;
}

export { BASE_URL };
