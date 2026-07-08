import { Spinner } from "@heroui/react";
import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import OfflineBanner from "./components/OfflineBanner";
import PwaInstallPrompt from "./components/PwaInstallPrompt";
import { AuthProvider, useAuth } from "./context/AuthContext";
import DevQrs from "./pages/DevQrs";
import ForceChangePassword from "./pages/ForceChangePassword";
import Login from "./pages/Login";

function AppRoutes() {
  const { isAuthenticated, isLoading, requiresPasswordChange } = useAuth();
  const authenticatedHome = requiresPasswordChange ? "/force-change-password" : "/";

  if (isLoading) {
    return (
      <div className="flex app-page-fill items-center justify-center overflow-hidden">
        <Spinner
          aria-label="앱 로딩 중"
          className="text-[#409eff]"
          color="current"
          size="md"
        />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/dev/qrs"
        element={import.meta.env.DEV ? <DevQrs /> : <Navigate to="/" replace />}
      />
      <Route
        path="/"
        element={
          isAuthenticated ? <BottomNav /> : <Navigate to="/login" replace />
        }
      />
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />}
      />
    </Routes>
  );
}

function App() {
  const location = useLocation();
  const isFullWidthDevPage =
    import.meta.env.DEV && location.pathname === "/dev/qrs";

  return (
    <div
      className={
        isFullWidthDevPage
          ? "min-h-screen bg-amber-50"
          : "min-h-screen flex justify-center bg-gray-900"
      }
    >
      <main
        className={
          isFullWidthDevPage
            ? "w-full min-h-screen"
            : "w-full max-w-[430px] bg-white min-h-screen shadow-lg"
        }
      >
        <AuthProvider>
          <OfflineBanner />
          <PwaInstallPrompt />
          <AppRoutes />
        </AuthProvider>
      </main>
    </div>
  );
}

export default App;
