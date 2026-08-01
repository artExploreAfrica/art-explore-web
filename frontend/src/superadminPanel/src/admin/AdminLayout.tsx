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
        <p className="admin-sidebar-title">Art Explore admin</p>
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
          <span className="admin-header-user">
            {user?.fullName} - {user?.role}
          </span>
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
