import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Inbox,
  Tag,
  FolderTree,
  Users,
  History,
  LogOut,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import "./AdminLayout.css";

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  icon: React.ComponentType<{ size?: number }>;
}

const baseNavItems: NavItem[] = [
  { to: "/admin", label: "Dashboard", end: true, icon: LayoutDashboard },
  { to: "/admin/institutions", label: "Institutions", icon: Building2 },
  { to: "/admin/submissions", label: "Submissions", icon: Inbox },
  { to: "/admin/tags", label: "Tags", icon: Tag },
  { to: "/admin/subcategories", label: "Subcategories", icon: FolderTree },
];

const superAdminNavItems: NavItem[] = [
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/audit-log", label: "Audit log", icon: History },
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
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => "admin-nav-item" + (isActive ? " admin-nav-item-active" : "")}
              >
                <Icon size={16} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <div className="admin-main">
        <header className="admin-header">
          <span className="admin-header-user">
            {user?.fullName}
            {user?.role && <span className="admin-header-role">{user.role.replace("_", " ")}</span>}
          </span>
          <button className="admin-logout-button" onClick={logout}>
            <LogOut size={14} />
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
