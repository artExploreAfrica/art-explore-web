// API client for the Super Admin Panel.
// Talks directly to the endpoints confirmed working during testing.

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4555';

const ACCESS_TOKEN_KEY = 'artexplore_access_token';
const REFRESH_TOKEN_KEY = 'artexplore_refresh_token';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}
export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}
export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  skipAuth?: boolean;
  isFormData?: boolean;
}

// Tries once, and if it gets a 401 (expired token), refreshes and retries
// exactly once before giving up. Mirrors the token-expiry behaviour we ran
// into constantly during manual testing (15-minute token lifespan).
export async function apiRequest<T = any>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, skipAuth = false, isFormData = false } = options;

  const doFetch = async () => {
    const headers: Record<string, string> = {};
    if (!isFormData) headers['Content-Type'] = 'application/json';
    if (!skipAuth) {
      const token = getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    return fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
    });
  };

  let res = await doFetch();

  if (res.status === 401 && !skipAuth) {
    const refreshed = await tryRefreshToken();
    if (refreshed) res = await doFetch();
  }

  const json = await res.json().catch(() => null);

  if (!res.ok || (json && json.success === false)) {
    throw new Error(describeApiError(json, res.status));
  }

  return json;
}

/**
 * The backend's error envelope is `{ success, message, errors? }`. For a Zod
 * failure `message` is always the literal string "Validation failed" and every
 * piece of usable information lives in `errors`, an array of
 * `{ field, message }`. Throwing only `message` is what turned a precise
 * field-level rejection into an unactionable "validation failed" toast — so
 * flatten `errors` into the thrown message instead of discarding it.
 */
function describeApiError(json: any, status: number): string {
  const base = json?.message || `Request failed with status ${status}`;
  const errors = json?.errors;

  if (Array.isArray(errors) && errors.length > 0) {
    const fields = errors
      .map((e: any) => (e?.field ? `${e.field}: ${e.message}` : e?.message))
      .filter(Boolean)
      .join(' · ');
    return fields ? `${base} — ${fields}` : base;
  }

  if (errors && typeof errors === 'object') {
    return `${base} — ${JSON.stringify(errors)}`;
  }

  return base;
}

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const json = await res.json();
    if (json?.success && json.data?.accessToken) {
      setTokens(json.data.accessToken, json.data.refreshToken);
      return true;
    }
  } catch {
    // fall through
  }
  clearTokens();
  return false;
}

// Every list endpoint on this backend paginates (default 20 per page) and
// returns a `pagination` object alongside `data`. Pass `page` to fetch a
// specific page — the page components use this to add Previous/Next controls
// instead of silently only ever showing the first 20 results.
export const adminApi = {
  // auth
  login: (email: string, password: string) =>
    apiRequest('/api/v1/auth/login', { method: 'POST', body: { email, password }, skipAuth: true }),
  me: () => apiRequest('/api/v1/auth/me'),

  // dashboard
  dashboard: () => apiRequest('/api/v1/admin/dashboard'),

  // institutions
  institutions: (page = 1) => apiRequest(`/api/v1/admin/institutions?page=${page}`),
  createInstitution: (data: Record<string, unknown>) =>
    apiRequest('/api/v1/admin/institutions', { method: 'POST', body: data }),
  updateInstitution: (id: string, data: Record<string, unknown>) =>
    apiRequest(`/api/v1/admin/institutions/${id}`, { method: 'PUT', body: data }),
  publishInstitution: (id: string) =>
    apiRequest(`/api/v1/admin/institutions/${id}/publish`, { method: 'POST' }),
  deleteInstitution: (id: string) =>
    apiRequest(`/api/v1/admin/institutions/${id}`, { method: 'DELETE' }),
  uploadInstitutionImage: (id: string, file: File) => {
    const form = new FormData();
    form.append('image', file);
    return apiRequest(`/api/v1/admin/institutions/${id}/images`, {
      method: 'POST',
      body: form,
      isFormData: true,
    });
  },
  removeInstitutionImage: (id: string, url: string) =>
    apiRequest(`/api/v1/admin/institutions/${id}/images`, { method: 'DELETE', body: { url } }),
  setInstitutionCoverImage: (id: string, url: string) =>
    apiRequest(`/api/v1/admin/institutions/${id}/images/cover`, { method: 'PATCH', body: { url } }),

  // exhibitions (nested under an institution)
  createExhibition: (institutionId: string, data: Record<string, unknown>) =>
    apiRequest(`/api/v1/admin/institutions/${institutionId}/exhibitions`, {
      method: 'POST',
      body: data,
    }),
  updateExhibition: (institutionId: string, exhibitionId: string, data: Record<string, unknown>) =>
    apiRequest(`/api/v1/admin/institutions/${institutionId}/exhibitions/${exhibitionId}`, {
      method: 'PUT',
      body: data,
    }),
  deleteExhibition: (institutionId: string, exhibitionId: string) =>
    apiRequest(`/api/v1/admin/institutions/${institutionId}/exhibitions/${exhibitionId}`, {
      method: 'DELETE',
    }),
  // Admin-scoped list — unlike the public /api/v1/institutions/:id/exhibitions
  // endpoint, this returns exhibitions for unpublished/draft institutions too,
  // and does not filter to APPROVED + isActive + currently-running.
  institutionExhibitions: (institutionId: string) =>
    apiRequest(`/api/v1/admin/institutions/${institutionId}/exhibitions?scope=all`),

  // submissions
  submissionsQueue: (page = 1) => apiRequest(`/api/v1/admin/submissions?page=${page}`),
  approveSubmission: (id: string) =>
    apiRequest(`/api/v1/admin/institutions/${id}/approve`, { method: 'POST' }),
  rejectSubmission: (id: string, reviewNote: string) =>
    apiRequest(`/api/v1/admin/institutions/${id}/reject`, { method: 'POST', body: { reviewNote } }),
  // Admin-panel counterpart to the public POST /api/v1/submissions (which
  // requires a contributor USER session) — same PENDING/unpublished pipeline,
  // reachable from an ADMIN/SUPER_ADMIN session instead.
  submitInstitution: (data: Record<string, unknown>) =>
    apiRequest('/api/v1/admin/institutions/submit', { method: 'POST', body: data }),

  // pending edits — proposed changes to an already-approved institution
  pendingEdits: (page = 1) => apiRequest(`/api/v1/admin/institutions/pending-edits?page=${page}`),
  proposeInstitutionEdit: (id: string, data: Record<string, unknown>) =>
    apiRequest(`/api/v1/admin/institutions/${id}/propose-edit`, { method: 'POST', body: data }),
  approveInstitutionEdit: (id: string) =>
    apiRequest(`/api/v1/admin/institutions/${id}/edit/approve`, { method: 'POST' }),
  rejectInstitutionEdit: (id: string, reviewNote: string) =>
    apiRequest(`/api/v1/admin/institutions/${id}/edit/reject`, {
      method: 'POST',
      body: { reviewNote },
    }),

  // tags
  tags: (page = 1) => apiRequest(`/api/v1/admin/tags?page=${page}`),
  createTag: (data: Record<string, unknown>) =>
    apiRequest('/api/v1/admin/tags', { method: 'POST', body: data }),
  updateTag: (id: string, data: Record<string, unknown>) =>
    apiRequest(`/api/v1/admin/tags/${id}`, { method: 'PUT', body: data }),
  deleteTag: (id: string) => apiRequest(`/api/v1/admin/tags/${id}`, { method: 'DELETE' }),

  // subcategories
  subcategories: (page = 1) => apiRequest(`/api/v1/admin/subcategories?page=${page}`),
  createSubcategory: (data: Record<string, unknown>) =>
    apiRequest('/api/v1/admin/subcategories', { method: 'POST', body: data }),
  updateSubcategory: (id: string, data: Record<string, unknown>) =>
    apiRequest(`/api/v1/admin/subcategories/${id}`, { method: 'PUT', body: data }),
  deleteSubcategory: (id: string) =>
    apiRequest(`/api/v1/admin/subcategories/${id}`, { method: 'DELETE' }),

  // users
  users: (page = 1) => apiRequest(`/api/v1/admin/users?page=${page}`),
  createAdminUser: (data: Record<string, unknown>) =>
    apiRequest('/api/v1/admin/users', { method: 'POST', body: data }),
  deactivateUser: (id: string) =>
    apiRequest(`/api/v1/admin/users/${id}/deactivate`, { method: 'PATCH' }),

  // audit log
  auditLogs: (page = 1) => apiRequest(`/api/v1/admin/audit-logs?page=${page}`),
};
