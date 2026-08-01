import React from "react";
import { Routes, Route } from "react-router-dom";
import { AdminLayout } from "./AdminLayout";
import { RequireRole } from "./RequireRole";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { InstitutionsPage } from "./pages/InstitutionsPage";
import { SubmissionsPage } from "./pages/SubmissionsPage";
import { TagsPage } from "./pages/TagsPage";
import { SubcategoriesPage } from "./pages/SubcategoriesPage";
import { UsersPage } from "./pages/UsersPage";
import { AuditLogPage } from "./pages/AuditLogPage";

export function AdminRoutes() {
  return (
    <Routes>
      <Route path="/admin/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <RequireRole allowed={["ADMIN", "SUPER_ADMIN"]}>
            <AdminLayout />
          </RequireRole>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="institutions" element={<InstitutionsPage />} />
        <Route path="submissions" element={<SubmissionsPage />} />
        <Route path="tags" element={<TagsPage />} />
        <Route path="subcategories" element={<SubcategoriesPage />} />
        <Route
          path="users"
          element={
            <RequireRole allowed={["SUPER_ADMIN"]}>
              <UsersPage />
            </RequireRole>
          }
        />
        <Route
          path="audit-log"
          element={
            <RequireRole allowed={["SUPER_ADMIN"]}>
              <AuditLogPage />
            </RequireRole>
          }
        />
      </Route>
    </Routes>
  );
}
