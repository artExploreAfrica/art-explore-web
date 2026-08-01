// API client for the Super Admin Panel.
// Talks directly to the endpoints confirmed working during testing.

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "http://localhost:4555";

const ACCESS_TOKEN_KEY = "artexplore_access_token";
const REFRESH_TOKEN_KEY = "artexplore_refresh_token";

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

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  skipAuth?: boolean;
  isFormData?: boolean;
}

// Tries once, and if it gets a 401 (expired token), refreshes and retries
// exactly once before giving up. This mirrors the token-expiry behaviour
// we ran into constantly during manual testing (15-minute token lifespan).
export async function apiRequest<T = any>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, skipAuth = false, isFormData = false } = options;

  const doFetch = async () => {
    const headers: Record<string, string> = {};
    if (!isFormData) headers["Content-Type"] = "application/json";
    if (!skipAuth) {
      const token = getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
    });
    return res;
  };

  let res = await doFetch();

  if (res.status === 401 && !skipAuth) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      res = await doFetch();
    }
  }

  const json = await res.json().catch(() => null);

  if (!res.ok || (json && json.success === false)) {
    const message = json?.message || `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  return json;
}

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    const json = await res.json();
    if (json?.success && json.data?.accessToken) {
      setTokens(json.data.accessToken, json.data.refreshToken);
      return true;
    }
  } catch {
    // fall through to false below
  }

  clearTokens();
  return false;
}

export const adminApi = {
  // auth
  login: (email: string, password: string) =>
    apiRequest("/api/v1/auth/login", { method: "POST", body: { email, password }, skipAuth: true }),
  me: () => apiRequest("/api/v1/auth/me"),

  // dashboard
  dashboard: () => apiRequest("/api/v1/admin/dashboard"),

  // institutions
  institutions: () => apiRequest("/api/v1/admin/institutions"),
  createInstitution: (data: Record<string, unknown>) =>
    apiRequest("/api/v1/admin/institutions", { method: "POST", body: data }),
  updateInstitution: (id: string, data: Record<string, unknown>) =>
    apiRequest(`/api/v1/admin/institutions/${id}`, { method: "PUT", body: data }),
  publishInstitution: (id: string) =>
    apiRequest(`/api/v1/admin/institutions/${id}/publish`, { method: "POST" }),
  deleteInstitution: (id: string) =>
    apiRequest(`/api/v1/admin/institutions/${id}`, { method: "DELETE" }),
  uploadInstitutionImage: (id: string, file: File) => {
    const form = new FormData();
    form.append("image", file);
    return apiRequest(`/api/v1/admin/institutions/${id}/images`, { method: "POST", body: form, isFormData: true });
  },

  // exhibitions (nested under an institution)
  createExhibition: (institutionId: string, data: Record<string, unknown>) =>
    apiRequest(`/api/v1/admin/institutions/${institutionId}/exhibitions`, { method: "POST", body: data }),
  updateExhibition: (institutionId: string, exhibitionId: string, data: Record<string, unknown>) =>
    apiRequest(`/api/v1/admin/institutions/${institutionId}/exhibitions/${exhibitionId}`, { method: "PUT", body: data }),
  deleteExhibition: (institutionId: string, exhibitionId: string) =>
    apiRequest(`/api/v1/admin/institutions/${institutionId}/exhibitions/${exhibitionId}`, { method: "DELETE" }),

  // submissions
  submissionsQueue: () => apiRequest("/api/v1/admin/submissions"),
  approveSubmission: (id: string) => apiRequest(`/api/v1/admin/institutions/${id}/approve`, { method: "POST" }),
  rejectSubmission: (id: string, reviewNote: string) =>
    apiRequest(`/api/v1/admin/institutions/${id}/reject`, { method: "POST", body: { reviewNote } }),

  // tags
  tags: () => apiRequest("/api/v1/admin/tags"),
  createTag: (data: Record<string, unknown>) => apiRequest("/api/v1/admin/tags", { method: "POST", body: data }),
  updateTag: (id: string, data: Record<string, unknown>) =>
    apiRequest(`/api/v1/admin/tags/${id}`, { method: "PUT", body: data }),
  deleteTag: (id: string) => apiRequest(`/api/v1/admin/tags/${id}`, { method: "DELETE" }),

  // subcategories
  subcategories: () => apiRequest("/api/v1/admin/subcategories"),
  createSubcategory: (data: Record<string, unknown>) =>
    apiRequest("/api/v1/admin/subcategories", { method: "POST", body: data }),
  updateSubcategory: (id: string, data: Record<string, unknown>) =>
    apiRequest(`/api/v1/admin/subcategories/${id}`, { method: "PUT", body: data }),
  deleteSubcategory: (id: string) => apiRequest(`/api/v1/admin/subcategories/${id}`, { method: "DELETE" }),

  // users
  users: () => apiRequest("/api/v1/admin/users"),
  createAdminUser: (data: Record<string, unknown>) => apiRequest("/api/v1/admin/users", { method: "POST", body: data }),
  deactivateUser: (id: string) => apiRequest(`/api/v1/admin/users/${id}/deactivate`, { method: "PATCH" }),

  // audit log
  auditLogs: () => apiRequest("/api/v1/admin/audit-logs"),

  // public read used by the admin panel to list an institution's exhibitions
  institutionExhibitions: (institutionId: string) =>
    apiRequest(`/api/v1/institutions/${institutionId}/exhibitions`),
};
