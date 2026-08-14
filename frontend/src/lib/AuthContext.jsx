// Public-site auth context — a regular visitor's account (Role.USER), used to
// submit a gallery for review. Deliberately separate storage keys from the
// admin panel's (src/admin/api.ts): the same browser could have both an admin
// session and a visitor session open, and they must never collide or leak
// into each other.
import { createContext, useContext, useEffect, useState } from "react";
import { apiGet, apiPost } from "./api";

const ACCESS_TOKEN_KEY = "artexplore_public_access_token";
const REFRESH_TOKEN_KEY = "artexplore_public_refresh_token";

function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}
function setTokens(accessToken, refreshToken) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}
function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      const token = getAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const result = await apiGet("/auth/me", {}, token);
        setUser(result.data);
      } catch {
        clearTokens();
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
  }, []);

  async function signup(fullName, email, password) {
    await apiPost("/auth/signup", { fullName, email, password });
    // Signup does not return tokens — log in right after so the visitor
    // doesn't have to fill the same email/password in twice.
    await login(email, password);
  }

  async function login(email, password) {
    const result = await apiPost("/auth/login", { email, password });
    setTokens(result.data.accessToken, result.data.refreshToken);
    setUser(result.data.user ?? result.data);
  }

  function logout() {
    clearTokens();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, getAccessToken }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook belongs with its provider
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an <AuthProvider>");
  return ctx;
}
