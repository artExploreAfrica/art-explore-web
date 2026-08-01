import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { adminApi, setTokens, clearTokens, getAccessToken } from "./api";

export type Role = "USER" | "ADMIN" | "SUPER_ADMIN";

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
}

interface AuthContextValue {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      const token = getAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const result = await adminApi.me();
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

  async function login(email: string, password: string) {
    const result = await adminApi.login(email, password);
    setTokens(result.data.accessToken, result.data.refreshToken);
    setUser(result.data.user ?? result.data);
  }

  function logout() {
    clearTokens();
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an <AuthProvider>");
  return ctx;
}
