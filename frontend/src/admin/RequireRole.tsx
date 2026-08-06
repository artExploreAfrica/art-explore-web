import React, { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth, Role } from "./AuthContext";

interface RequireRoleProps {
  allowed: Role[];
  children: ReactNode;
}

export function RequireRole({ allowed, children }: RequireRoleProps) {
  const { user, loading } = useAuth();
  if (loading) return <div className="admin-loading">Checking your session...</div>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (!allowed.includes(user.role)) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}
