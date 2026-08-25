import React, { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";

const isClickableContextMenuTarget = (target: EventTarget | null) =>
  target instanceof Element &&
  target.closest('button, [role="button"]') !== null;

function App() {
  useEffect(() => {
    const preventClickableContextMenu = (event: MouseEvent) => {
      if (isClickableContextMenuTarget(event.target)) {
        event.preventDefault();
      }
    };

    document.addEventListener("contextmenu", preventClickableContextMenu, true);
    return () => {
      document.removeEventListener(
        "contextmenu",
        preventClickableContextMenu,
        true,
      );
    };
  }, []);

  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<AdminDashboard />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
