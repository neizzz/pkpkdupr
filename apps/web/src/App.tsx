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
        element={
          import.meta.env.DEV ? (
            !isAuthenticated ? (
              <Navigate to="/login" replace />
            ) : requiresPasswordChange ? (
              <Navigate to="/force-change-password" replace />
            ) : (
              <DevQrs />
            )
          ) : (
            <Navigate to={authenticatedHome} replace />
          )
        }
      />
      <Route
        path="/"
        element={
          !isAuthenticated ? (
            <Navigate to="/login" replace />
          ) : requiresPasswordChange ? (
            <Navigate to="/force-change-password" replace />
          ) : (
            <BottomNav />
          )
        }
      />
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to={authenticatedHome} replace /> : <Login />
        }
      />
      <Route
        path="/force-change-password"
        element={
          !isAuthenticated ? (
            <Navigate to="/login" replace />
          ) : requiresPasswordChange ? (
            <ForceChangePassword />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route
        path="*"
        element={
          <Navigate to={isAuthenticated ? authenticatedHome : "/login"} replace />
        }
      />
    </Routes>
  );
}

function App() {
  const location = useLocation();
  const isFullWidthDevPage =
    import.meta.env.DEV && location.pathname === "/dev/qrs";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateViewportMetrics = () => {
      const visualViewport = window.visualViewport;
      const visualViewportWidth = visualViewport?.width ?? window.innerWidth;
      const shellWidth = Math.min(window.innerWidth, visualViewportWidth);
      const bottomOffset = Math.max(
        0,
        window.innerHeight -
          (visualViewport?.height ?? window.innerHeight) -
          (visualViewport?.offsetTop ?? 0),
      );

      document.documentElement.style.setProperty(
        "--app-shell-width",
        `${Math.round(shellWidth)}px`,
      );
      document.documentElement.style.setProperty(
        "--app-bottom-offset",
        `${Math.round(bottomOffset)}px`,
      );
    };

    updateViewportMetrics();

    window.addEventListener("resize", updateViewportMetrics);
    window.visualViewport?.addEventListener("resize", updateViewportMetrics);
    window.visualViewport?.addEventListener("scroll", updateViewportMetrics);

    return () => {
      window.removeEventListener("resize", updateViewportMetrics);
      window.visualViewport?.removeEventListener("resize", updateViewportMetrics);
      window.visualViewport?.removeEventListener("scroll", updateViewportMetrics);
    };
  }, []);

  return (
    <div
      className={
        isFullWidthDevPage
          ? "app-shell-height w-full overflow-hidden bg-amber-50"
          : "app-shell-height flex w-full min-w-0 justify-center overflow-hidden bg-gray-900"
      }
    >
      <main
        className={
          isFullWidthDevPage
            ? "app-shell-height w-full min-w-0 overflow-y-auto overflow-x-hidden"
            : "app-shell-height w-full min-w-0 max-w-[430px] overflow-hidden bg-white shadow-lg"
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
