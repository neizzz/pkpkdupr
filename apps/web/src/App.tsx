import { Navigate, Route, Routes } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <Routes>
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
  return (
    <div className="min-h-screen flex justify-center bg-gray-900">
      <div className="w-full max-w-[430px] bg-white min-h-screen shadow-lg">
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </div>
    </div>
  );
}

export default App;
