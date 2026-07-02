import { Spinner } from "@heroui/react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import OfflineBanner from "./components/OfflineBanner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import DevQrs from "./pages/DevQrs";
import Login from "./pages/Login";

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
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
        element={isAuthenticated ? <BottomNav /> : <Navigate to="/login" replace />}
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
      <div
        className={
          isFullWidthDevPage
            ? "w-full min-h-screen"
            : "w-full max-w-[430px] bg-white min-h-screen shadow-lg"
        }
      >
        <AuthProvider>
          <OfflineBanner />
          <AppRoutes />
        </AuthProvider>
      </div>
    </div>
  );
}

export default App;
