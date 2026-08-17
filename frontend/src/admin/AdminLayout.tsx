import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";
import "./AdminLayout.css";

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

const baseNavItems: NavItem[] = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/institutions", label: "Institutions" },
  { to: "/admin/submissions", label: "Submissions" },
  { to: "/admin/tags", label: "Tags" },
  { to: "/admin/subcategories", label: "Subcategories" },
];

const superAdminNavItems: NavItem[] = [
  { to: "/admin/users", label: "Users" },
  { to: "/admin/audit-log", label: "Audit log" },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navItems = user?.role === "SUPER_ADMIN" ? [...baseNavItems, ...superAdminNavItems] : baseNavItems;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <NavLink to="/admin" end className="admin-sidebar-brand">
          <img src="/brand/wordmark-white.png" alt="Art Explore" />
        </NavLink>
        <p className="admin-sidebar-title">Admin</p>
        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => "admin-nav-item" + (isActive ? " admin-nav-item-active" : "")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="admin-main">
        <header className="admin-header">
          <h4>Art Explore Admin</h4>
          <button className="admin-logout-button" onClick={logout}>
            Log out
          </button>
        </header>
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
