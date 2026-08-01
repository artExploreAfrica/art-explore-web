import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AdminRoutes } from "./admin/routes";

// Standalone entry point. When you merge this into the main frontend project,
// AdminRoutes is the piece you actually want — this App.tsx is just a runner
// so the admin panel has somewhere to boot from on its own for now.
export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/*" element={<AdminRoutes />} />
    </Routes>
  );
}
